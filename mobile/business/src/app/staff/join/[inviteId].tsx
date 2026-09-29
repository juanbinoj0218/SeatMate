import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

import { Banner, Button, Card, colors, Eyebrow, Loading, Muted, Screen, Title } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useSession } from "@/lib/session";

type Invite = {
  businessId: string;
  businessName: string;
  active: boolean;
};

// Opened from an invite link (seatmatebusiness://staff/join/{id}) or the
// "Join as staff" screen. Same rules as the web page: one staff account
// belongs to one business, and disabled staff can't re-enable themselves.
export default function JoinStaffScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const session = useSession();
  const user = session.state === "loading" || session.state === "signedOut" ? null : session.user;

  const [invite, setInvite] = useState<Invite | null>(null);
  // Which invite has finished loading, so a new link shows the spinner again.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");

  const uid = user?.uid;

  useEffect(() => {
    // Firebase only lets signed-in people read invites.
    if (!uid || !inviteId) return;

    getDoc(doc(db, "staffInvites", inviteId))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setInvite(snapshot.data() as Invite);
        } else {
          setMessage("This staff invite does not exist.");
        }
      })
      .catch((error) => {
        console.error(error);
        setMessage("Could not load this invitation.");
      })
      .finally(() => setLoadedFor(`${uid}/${inviteId}`));
  }, [uid, inviteId]);

  const loading = Boolean(uid) && loadedFor !== `${uid}/${inviteId}`;

  if (session.state === "loading" || loading) {
    return <Loading label="Loading invitation…" />;
  }

  if (!user) {
    return (
      <Screen>
        <Card>
          <Eyebrow>Staff invitation</Eyebrow>
          <Title>Join SeatMate staff</Title>
          <Muted style={{ marginTop: 8 }}>Sign in or create an account first to accept your staff invitation.</Muted>
          <Button
            title="Sign in to continue"
            onPress={() => router.push({ pathname: "/login", params: { next: `/staff/join/${inviteId}` } })}
            style={{ marginTop: 18 }}
          />
        </Card>
      </Screen>
    );
  }

  if (!invite) {
    return (
      <Screen>
        <Card>
          <Title>Invite unavailable</Title>
          <Muted style={{ marginTop: 8 }}>{message || "This invitation could not be loaded."}</Muted>
        </Card>
      </Screen>
    );
  }

  const accept = async () => {
    setMessage("");
    setAccepting(true);

    const inviteRef = doc(db, "staffInvites", inviteId);
    const staffRef = doc(db, "staffUsers", user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const inviteSnap = await transaction.get(inviteRef);

        if (!inviteSnap.exists()) throw new Error("Invite does not exist.");

        const inviteData = inviteSnap.data();

        if (!inviteData.active) throw new Error("Invite already used.");

        const staffSnap = await transaction.get(staffRef);
        const claim = { active: false, claimedBy: user.uid, claimedAt: serverTimestamp() };

        if (staffSnap.exists()) {
          const existing = staffSnap.data();

          if (existing.businessId === inviteData.businessId && existing.active === true) {
            transaction.update(inviteRef, claim);
            return;
          }

          if (existing.businessId === inviteData.businessId && existing.active === false) {
            throw new Error("Your staff access was disabled by the business owner.");
          }

          throw new Error("This account already belongs to another business.");
        }

        transaction.set(staffRef, {
          businessId: inviteData.businessId,
          businessName: inviteData.businessName,
          inviteId,
          role: "staff",
          active: true,
          email: user.email || "",
          joinedAt: serverTimestamp(),
        });

        transaction.update(inviteRef, claim);
      });

      router.replace("/staff");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "This invite could not be accepted.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Eyebrow>Staff invitation</Eyebrow>
        <Title>Join {invite.businessName}</Title>
        <Muted style={{ marginTop: 8 }}>You&apos;ll be able to update live seat availability for this location.</Muted>

        <View style={{ backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: colors.faint, fontWeight: "700" }}>SIGNED IN AS</Text>
          <Text style={{ fontWeight: "700", marginTop: 4, color: colors.ink }}>{user.email}</Text>
        </View>

        {invite.active ? (
          <Button title="Accept staff invite" variant="green" onPress={accept} busy={accepting} style={{ marginTop: 18 }} />
        ) : (
          <Banner tone="error">This invitation has already been used.</Banner>
        )}

        {message && invite.active ? <Banner tone="error">{message}</Banner> : null}
      </Card>
    </Screen>
  );
}

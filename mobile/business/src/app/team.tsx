import { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import WrongAccount from "@/components/gate";
import { Banner, Button, Card, colors, Muted, Screen, Title } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useOwner } from "@/lib/session";
import { businessUrl } from "@/lib/site-urls";

type StaffMember = {
  id: string;
  email: string;
  active: boolean;
};

// Invite staff with a one-time link and turn their access on or off.
export default function TeamScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return;

    return onSnapshot(
      query(collection(db, "staffUsers"), where("businessId", "==", businessId)),
      (snapshot) =>
        setStaff(
          snapshot.docs.map((item) => ({
            id: item.id,
            email: item.data().email || "",
            active: item.data().active ?? false,
          }))
        ),
      (err) => {
        console.error(err);
        setError("Could not load staff members.");
        setStaff([]);
      }
    );
  }, [businessId]);

  if (!owner) {
    return <WrongAccount />;
  }

  const createInvite = async () => {
    try {
      setError("");
      setCreating(true);
      setCopied(false);

      const invite = await addDoc(collection(db, "staffInvites"), {
        businessId: owner.business.id,
        businessName: owner.business.name,
        role: "staff",
        active: true,
        createdAt: serverTimestamp(),
      });

      // The web link works in any browser; staff using this app can paste
      // it into "Join as staff".
      const inviteLink = businessUrl(`/staff/join/${invite.id}`);
      setLink(inviteLink);

      await Share.share({
        message: `Join ${owner.business.name} on SeatMate to update live seats: ${inviteLink}`,
      }).catch(() => {});
    } catch (err) {
      console.error(err);
      setError("Could not create the invite link.");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (member: StaffMember) => {
    try {
      await updateDoc(doc(db, "staffUsers", member.id), { active: !member.active });
    } catch (err) {
      console.error(err);
      setError("Could not update this staff member.");
    }
  };

  return (
    <Screen>
      <Title>Staff</Title>
      <Muted style={{ marginTop: 4, marginBottom: 16 }}>
        Invite your team to update seats at {owner.business.name}. Each link works once.
      </Muted>

      <Card>
        <Button title="Create invite link" onPress={createInvite} busy={creating} />
        {link ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.faint }}>LATEST INVITE LINK</Text>
            <Text selectable style={{ marginTop: 6, color: colors.ink }}>
              {link}
            </Text>
            <Button
              title={copied ? "Copied" : "Copy link"}
              variant="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setCopied(true);
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : null}
      </Card>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 24, marginBottom: 10 }}>
        Team members
      </Text>

      {staff === null ? (
        <Muted>Loading…</Muted>
      ) : staff.length === 0 ? (
        <Card>
          <Muted>No staff yet. Create an invite link and send it to someone on your team.</Muted>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {staff.map((member) => (
            <Card key={member.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.ink }}>{member.email || "Staff member"}</Text>
                <Text style={{ marginTop: 2, color: member.active ? colors.green : colors.faint, fontWeight: "600" }}>
                  {member.active ? "Active" : "Disabled"}
                </Text>
              </View>
              <Button
                title={member.active ? "Disable" : "Enable"}
                variant={member.active ? "danger" : "secondary"}
                onPress={() => void toggle(member)}
              />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

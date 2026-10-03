import { useState } from "react";
import { router } from "expo-router";

import { Banner, Button, Card, Field, Muted, Screen, Title } from "@/components/ui";

// "https://seatmate360.net/staff/join/abc123" (or just "abc123") → "abc123".
const inviteIdFrom = (value: string) => {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/\/staff\/join\/([\w-]+)/);
  if (fromLink) return fromLink[1];
  return /^[\w-]+$/.test(trimmed) ? trimmed : null;
};

export default function JoinScreen() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const open = () => {
    const inviteId = inviteIdFrom(value);
    if (!inviteId) return setError("Paste the whole invite link your manager sent you.");
    router.push({ pathname: "/staff/join/[inviteId]", params: { inviteId } });
  };

  return (
    <Screen>
      <Title>Join as staff</Title>
      <Muted style={{ marginTop: 6, marginBottom: 16 }}>
        Paste the staff invite link from your manager to start updating seats for their business.
      </Muted>
      <Card>
        <Field
          label="Invite link"
          value={value}
          onChangeText={setValue}
          placeholder="https://seatmate360.net/staff/join/…"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={open}
        />
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button title="Continue" onPress={open} style={{ marginTop: 18 }} />
      </Card>
    </Screen>
  );
}

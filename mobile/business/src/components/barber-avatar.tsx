import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { initials } from "@seatmate/shared/barbers";

// A barber's profile picture (their first photo), or their initials.
export default function Avatar({ name, uri, size = 52 }: { name: string; uri?: string; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.32 }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { backgroundColor: "#101811", alignItems: "center", justifyContent: "center" },
});

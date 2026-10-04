import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Button, colors, styles as ui } from "@/components/ui";

// A calm full-screen message with one action, for the app-wide error screen
// and unknown links. Brings its own safe-area provider because the root
// error screen replaces the whole app, providers included.
export default function StatusScreen({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <View style={styles.icon}>{icon}</View>
          <Text style={styles.title}>{title}</Text>
          <Text style={[ui.muted, styles.text]}>{text}</Text>
          <Button title={action} onPress={onAction} style={styles.button} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#eceee9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 18, textAlign: "center" },
  text: { textAlign: "center", marginTop: 8 },
  button: { marginTop: 24, alignSelf: "stretch" },
});

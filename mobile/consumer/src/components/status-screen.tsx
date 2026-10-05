import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { colors, EmptyState, readable } from "@/components/ui";

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
        <View style={[styles.body, readable]}>
          <EmptyState icon={icon} title={title} text={text} action={action} onAction={onAction} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { flex: 1, justifyContent: "center", maxWidth: 480 },
});

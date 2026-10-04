import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, shadow } from "@/components/ui";

// Slides down from the top of every screen while the phone has no
// connection, and back up once it reconnects.
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;

  // 0 = hidden above the screen, 1 = shown.
  const shown = useSharedValue(0);
  const hiddenOffset = -(insets.top + 96);

  useEffect(() => {
    shown.set(withTiming(offline ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [offline, shown]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.get()) * hiddenOffset }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!offline}
      importantForAccessibility={offline ? "auto" : "no-hide-descendants"}
      style={[styles.wrap, { top: insets.top + 8 }, slide]}
    >
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
        <WifiOff size={18} color="#fff" strokeWidth={2.2} />
        <Text style={styles.text}>You&apos;re offline. Seats will update when you reconnect.</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 100, elevation: 100, alignItems: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 520,
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow,
  },
  text: { color: "#fff", fontSize: 14, lineHeight: 19, fontWeight: "700", flexShrink: 1 },
});

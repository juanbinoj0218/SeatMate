import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Haptics for meaningful actions: seat and door taps, toggles, saves, and a
// warning when a change didn't go through. Phones only; a browser has none.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

export function tap() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

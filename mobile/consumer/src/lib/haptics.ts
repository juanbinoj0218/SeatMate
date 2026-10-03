import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Light taps on buttons and toggles. Phones only; a browser has no haptics.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

export function tap() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

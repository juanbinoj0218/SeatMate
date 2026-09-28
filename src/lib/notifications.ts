// Push notifications ("tell me when a seat opens").
//
// The app asks permission and gets this phone's Expo push token (its
// notification address). The Cloud Function in functions/index.js sends the
// notification when a seat opens, even when the app is closed.

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Show notifications as a banner even while SeatMate is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "denied" | "simulator" | "not-configured" | "error" };

// Android groups notifications into channels (the function sends to this one)
export const SEAT_ALERT_CHANNEL = "seat-alerts";

export async function getPushToken(): Promise<PushTokenResult> {
  // Simulators can't receive push notifications
  if (!Device.isDevice) {
    return { ok: false, reason: "simulator" };
  }

  // Set by `npx eas-cli init` (saved in app.json)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    return { ok: false, reason: "not-configured" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(SEAT_ALERT_CHANNEL, {
      name: "Seat alerts",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  const allowed =
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!allowed) {
    return { ok: false, reason: "denied" };
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return { ok: true, token };
  } catch (error) {
    console.error("Could not get push token:", error);
    return { ok: false, reason: "error" };
  }
}

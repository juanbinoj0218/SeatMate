import { router, Stack } from "expo-router";
import { MapPinOff } from "lucide-react-native";

import StatusScreen from "@/components/status-screen";
import { colors } from "@/components/ui";

// Any link the app doesn't have a screen for.
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <StatusScreen
        icon={<MapPinOff size={40} color={colors.muted} strokeWidth={1.9} />}
        title="We couldn't find that page"
        text="The link may be old, or the place may have left SeatMate."
        action="Back to Explore"
        onAction={() => router.replace("/")}
      />
    </>
  );
}

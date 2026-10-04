import { router, Stack } from "expo-router";
import { SearchX } from "lucide-react-native";

import StatusScreen from "@/components/status-screen";
import { colors } from "@/components/ui";

// Any link the app doesn't have a screen for.
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <StatusScreen
        icon={<SearchX size={36} color={colors.muted} strokeWidth={1.9} />}
        title="We couldn't find that page"
        text="The link may be old or mistyped."
        action="Go home"
        onAction={() => router.replace("/")}
      />
    </>
  );
}

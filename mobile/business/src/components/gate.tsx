import { Redirect } from "expo-router";

import { Loading } from "@/components/ui";
import { useSession } from "@/lib/session";

// Shown by a screen that isn't for the current account: waits while the
// account loads, then hands over to "/", which picks the right screen.
export default function WrongAccount() {
  const session = useSession();
  return session.state === "loading" ? <Loading /> : <Redirect href="/" />;
}

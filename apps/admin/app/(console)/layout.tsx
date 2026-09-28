import AdminShell from "@/components/admin-shell";
import { AdminSessionProvider } from "@/lib/admin-session";

export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}

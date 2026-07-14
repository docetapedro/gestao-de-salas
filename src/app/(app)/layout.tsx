import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = {
    id: session.sub,
    name: session.name,
    email: session.email,
    role: session.role,
  };

  return (
    <AppShell user={user}>
      {children}
      <Toaster />
    </AppShell>
  );
}

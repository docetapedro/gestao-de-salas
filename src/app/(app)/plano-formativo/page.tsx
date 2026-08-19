import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import PlanoFormativoClient from "./PlanoFormativoClient";

export default async function PlanoFormativoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "plano-formativo", "view")) redirect("/dashboard");

  return <PlanoFormativoClient canManage={can(session, "plano-formativo", "manage")} />;
}

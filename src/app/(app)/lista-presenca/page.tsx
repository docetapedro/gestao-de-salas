import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import ListaPresencaForm from "@/components/ListaPresencaForm";

export default async function ListaPresencaPage() {
  const session = await getSession();
  if (!can(session, "projetos", "view")) redirect("/dashboard");
  return <ListaPresencaForm />;
}

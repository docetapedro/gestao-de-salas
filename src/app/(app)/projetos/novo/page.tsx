import Link from "next/link";
import ProjectForm from "@/components/ProjectForm";

export default function NovoProjetoPage() {
  return (
    <div>
      <div className="mb-4">
        <Link href="/projetos" className="text-sm text-brand-600 hover:underline">
          ← Projectos
        </Link>
        <h1 className="text-2xl font-bold text-navy mt-1">Novo projecto</h1>
      </div>
      <ProjectForm />
    </div>
  );
}

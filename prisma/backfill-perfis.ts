// Cria os perfis de sistema (Administrador/Gestor/Visualizador) com permissões
// por módulo e liga os utilizadores existentes (sem perfil) ao perfil do seu role.
// Idempotente: correr várias vezes é seguro (não sobrescreve permissões já editadas).
// Uso: tsx prisma/backfill-perfis.ts  (corre também no build da Vercel)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULOS = [
  "agenda",
  "eventos",
  "salas",
  "projetos",
  "stock",
  "cadastros",
  "usuarios",
] as const;

function perms(nivel: "view" | "manage", exceto: string[] = []) {
  const o: Record<string, "view" | "manage"> = {};
  for (const m of MODULOS) if (!exceto.includes(m)) o[m] = nivel;
  return o;
}

const SISTEMA = [
  {
    nome: "Administrador",
    descricao: "Acesso total, incluindo gestão de utilizadores e perfis.",
    permissoes: perms("manage"),
    role: "ADMIN",
  },
  {
    nome: "Gestor",
    descricao: "Gere todos os módulos, excepto utilizadores.",
    permissoes: perms("manage", ["usuarios"]),
    role: "MANAGER",
  },
  {
    nome: "Visualizador",
    descricao: "Apenas visualiza os módulos (sem gestão).",
    permissoes: perms("view", ["usuarios"]),
    role: "VIEWER",
  },
];

async function main() {
  const byRole: Record<string, string> = {};
  for (const s of SISTEMA) {
    const perfil = await prisma.perfil.upsert({
      where: { nome: s.nome },
      // Não sobrescreve `permissoes` se o perfil já existir (pode ter sido editado).
      update: { sistema: true },
      create: {
        nome: s.nome,
        descricao: s.descricao,
        permissoes: JSON.stringify(s.permissoes),
        sistema: true,
      },
    });
    byRole[s.role] = perfil.id;
    console.log(`  Perfil "${s.nome}" pronto (${perfil.id})`);
  }

  for (const role of ["ADMIN", "MANAGER", "VIEWER"]) {
    const res = await prisma.user.updateMany({
      where: { perfilId: null, role },
      data: { perfilId: byRole[role] },
    });
    if (res.count) console.log(`  ${res.count} utilizador(es) ${role} ligado(s) ao perfil`);
  }

  console.log("Concluído: perfis de sistema prontos e utilizadores ligados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

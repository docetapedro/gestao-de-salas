import type { SessionPayload } from "./jwt";

export type Role = "ADMIN" | "MANAGER" | "VIEWER";

/* ------------------------- Perfis & permissões ---------------------------- */

export type Nivel = "view" | "manage";
export type ModuloKey =
  | "agenda"
  | "eventos"
  | "salas"
  | "projetos"
  | "stock"
  | "gamificacao"
  | "cadastros"
  | "usuarios";

// Módulos configuráveis nos perfis (ordem = ordem no menu/matriz).
export const MODULOS: { key: ModuloKey; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "eventos", label: "Eventos" },
  { key: "salas", label: "Salas" },
  { key: "projetos", label: "Projectos" },
  { key: "stock", label: "Stock" },
  { key: "gamificacao", label: "Gamificação" },
  { key: "cadastros", label: "Cadastros" },
  { key: "usuarios", label: "Utilizadores" },
];

export type Permissoes = Partial<Record<ModuloKey, Nivel>>;

/** Aceita só módulos e níveis válidos (para guardar em segurança). */
export function normPermissoes(v: unknown): Permissoes {
  const out: Permissoes = {};
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    for (const m of MODULOS) {
      const n = rec[m.key];
      if (n === "view" || n === "manage") out[m.key] = n;
    }
  }
  return out;
}

// Permissões derivadas do papel antigo (retrocompatibilidade / fallback).
function permsFromRole(role: Role): Permissoes {
  const out: Permissoes = {};
  for (const m of MODULOS) {
    if (role === "ADMIN") out[m.key] = "manage";
    else if (m.key === "usuarios") continue; // só ADMIN gere utilizadores
    else out[m.key] = role === "MANAGER" ? "manage" : "view";
  }
  return out;
}

type Principal = Pick<SessionPayload, "role" | "perm">;

/** Permissões efetivas: ADMIN = tudo; senão o perfil; senão o role. */
export function permsFor(session: Principal): Permissoes {
  if (session.role === "ADMIN") return permsFromRole("ADMIN");
  if (session.perm && Object.keys(session.perm).length > 0)
    return session.perm as Permissoes;
  return permsFromRole(session.role);
}

/** Pode `nivel` (view/manage) no `modulo`? Serve tanto no servidor como no cliente. */
export function can(
  session: Principal | null | undefined,
  modulo: ModuloKey,
  nivel: Nivel
): boolean {
  if (!session) return false;
  const p = permsFor(session)[modulo];
  if (!p) return false;
  return nivel === "view" ? p === "view" || p === "manage" : p === "manage";
}

/** Garante permissão `nivel` no `modulo`; lança HttpError caso contrário. */
export function assertCan(
  session: SessionPayload | null,
  modulo: ModuloKey,
  nivel: Nivel
): SessionPayload {
  if (!session) throw new HttpError(401, "Não autenticado");
  if (!can(session, modulo, nivel)) throw new HttpError(403, "Sem permissão");
  return session;
}

/** Pode criar/editar/excluir salas e eventos. */
export function canManage(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Pode gerenciar usuários e permissões. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

/** Garante que a sessão exista e tenha permissão de gestão. Lança em caso contrário. */
export function assertCanManage(session: SessionPayload | null): SessionPayload {
  if (!session) throw new HttpError(401, "Não autenticado");
  if (!canManage(session.role)) throw new HttpError(403, "Sem permissão");
  return session;
}

export function assertCanManageUsers(
  session: SessionPayload | null
): SessionPayload {
  if (!session) throw new HttpError(401, "Não autenticado");
  if (!canManageUsers(session.role)) throw new HttpError(403, "Sem permissão");
  return session;
}

export function assertAuthenticated(
  session: SessionPayload | null
): SessionPayload {
  if (!session) throw new HttpError(401, "Não autenticado");
  return session;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  VIEWER: "Visualizador",
};

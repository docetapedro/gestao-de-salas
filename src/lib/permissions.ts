import type { SessionPayload } from "./jwt";

export type Role = "ADMIN" | "MANAGER" | "VIEWER";

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

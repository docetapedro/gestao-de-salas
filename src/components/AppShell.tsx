"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  BriefcaseIcon,
  CalendarIcon,
  DoorIcon,
  GridIcon,
  KeyIcon,
  LogoutIcon,
  MenuIcon,
  PanelLeftIcon,
  SlidersIcon,
  UsersIcon,
} from "@/components/icons";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const NAV = [
  { href: "/dashboard", label: "Agenda", Icon: GridIcon, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/eventos", label: "Eventos", Icon: CalendarIcon, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/salas", label: "Salas", Icon: DoorIcon, roles: ["ADMIN", "MANAGER"] },
  { href: "/projetos", label: "Projectos", Icon: BriefcaseIcon, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/cadastros", label: "Cadastros", Icon: SlidersIcon, roles: ["ADMIN", "MANAGER"] },
  { href: "/usuarios", label: "Usuários", Icon: UsersIcon, roles: ["ADMIN"] },
] as const;

const COLLAPSE_KEY = "salas_sidebar_collapsed";

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // drawer no mobile
  const [collapsed, setCollapsed] = useState(false); // recolhido no desktop

  // Alterar a própria senha
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    if (pwd.next !== pwd.confirm) {
      setPwdError("A confirmação não coincide com a nova senha");
      return;
    }
    setPwdSaving(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: pwd.current,
          newPassword: pwd.next,
        }),
      });
      setPwdOk(true);
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwdError((err as Error).message);
    } finally {
      setPwdSaving(false);
    }
  }

  function openPwd() {
    setPwd({ current: "", next: "", confirm: "" });
    setPwdError(null);
    setPwdOk(false);
    setShowPwd(true);
    setOpen(false);
  }

  // Restaura a preferência de recolhido.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(user.role));

  // Esconde rótulos só no desktop quando recolhido (no mobile o drawer mostra tudo).
  const hideOnCollapse = collapsed ? "lg:hidden" : "";

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-30 inset-y-0 left-0 w-64 bg-navy text-white flex flex-col transition-all duration-200 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        } ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div
          className={`px-3 py-4 border-b border-white/10 flex items-center gap-2 ${
            collapsed ? "lg:justify-center" : ""
          }`}
        >
          <div className={`flex-1 min-w-0 ${hideOnCollapse}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo.png"
              alt="Gestão de Salas"
              className="h-11 w-full object-contain object-left"
            />
          </div>
          {/* Botão recolher (desktop) */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="ml-auto hidden lg:flex shrink-0 h-7 w-7 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10 transition"
          >
            <PanelLeftIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  collapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  active
                    ? "bg-brand-500 text-white"
                    : "text-brand-100 hover:bg-white/10"
                }`}
              >
                <item.Icon className="h-5 w-5 shrink-0" />
                <span className={hideOnCollapse}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className={`px-3 py-2 ${hideOnCollapse}`}>
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-[11px] text-brand-200">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <button
            onClick={openPwd}
            title="Alterar senha"
            className={`w-full px-3 py-2 rounded-lg text-sm text-brand-100 hover:bg-white/10 transition flex items-center gap-2 ${
              collapsed ? "lg:justify-center lg:px-0" : "text-left"
            }`}
          >
            <KeyIcon className="h-5 w-5 shrink-0" />
            <span className={hideOnCollapse}>Alterar senha</span>
          </button>
          <button
            onClick={logout}
            title="Sair"
            className={`w-full mt-1 px-3 py-2 rounded-lg text-sm text-brand-100 hover:bg-white/10 transition flex items-center gap-2 ${
              collapsed ? "lg:justify-center lg:px-0" : "text-left"
            }`}
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            <span className={hideOnCollapse}>Sair</span>
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-navy text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <MenuIcon className="h-6 w-6" />
          </button>
          <span className="font-semibold">Gestão de Salas</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>

      {/* Modal: alterar a própria senha */}
      {showPwd && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPwd(false)}
        >
          <form
            onSubmit={changePassword}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full"
          >
            <div className="bg-navy text-white px-5 py-4 font-bold rounded-t-2xl">
              Alterar senha
            </div>
            <div className="p-5 space-y-3">
              {pwdOk ? (
                <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 border border-green-200">
                  Senha alterada com sucesso.
                </div>
              ) : (
                <>
                  {pwdError && (
                    <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                      {pwdError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Senha atual
                    </label>
                    <input
                      type="password"
                      required
                      value={pwd.current}
                      onChange={(e) =>
                        setPwd({ ...pwd, current: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nova senha
                    </label>
                    <input
                      type="password"
                      required
                      value={pwd.next}
                      onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                      placeholder="mín. 6 caracteres"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      required
                      value={pwd.confirm}
                      onChange={(e) =>
                        setPwd({ ...pwd, confirm: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowPwd(false)}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm font-medium text-slate-700"
              >
                {pwdOk ? "Fechar" : "Cancelar"}
              </button>
              {!pwdOk && (
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="flex-1 rounded-lg bg-navy text-white py-2 text-sm font-semibold hover:bg-navy-light disabled:opacity-60"
                >
                  {pwdSaving ? "Salvando…" : "Salvar"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

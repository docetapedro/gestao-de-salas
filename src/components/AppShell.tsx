"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  BuildingIcon,
  CalendarIcon,
  DoorIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  PanelLeftIcon,
  UsersIcon,
} from "@/components/icons";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const NAV = [
  { href: "/dashboard", label: "Grade", Icon: GridIcon, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/eventos", label: "Eventos", Icon: CalendarIcon, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/salas", label: "Salas", Icon: DoorIcon, roles: ["ADMIN", "MANAGER"] },
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
        <div className="px-3 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-sky-soft text-navy flex items-center justify-center">
            <BuildingIcon className="h-5 w-5" />
          </div>
          <div className={`min-w-0 ${hideOnCollapse}`}>
            <div className="font-bold leading-tight truncate">Gestão de Salas</div>
            <div className="text-[11px] text-brand-200">tempo real</div>
          </div>
          {/* Botão recolher (desktop) */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={`ml-auto hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10 transition ${
              collapsed ? "lg:mx-auto lg:ml-0" : ""
            }`}
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
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import {
  ROLE_LABELS,
  can,
  type Role,
  type ModuloKey,
  type Permissoes,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BoxIcon,
  BriefcaseIcon,
  CalendarIcon,
  DoorIcon,
  GridIcon,
  KeyIcon,
  LogoutIcon,
  MenuIcon,
  PanelLeftIcon,
  SlidersIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  perm?: Permissoes;
};

const NAV: {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  modulo: ModuloKey;
  children?: { href: string; label: string }[];
}[] = [
  { href: "/dashboard", label: "Agenda", Icon: GridIcon, modulo: "agenda" },
  { href: "/eventos", label: "Eventos", Icon: CalendarIcon, modulo: "eventos" },
  { href: "/salas", label: "Salas", Icon: DoorIcon, modulo: "salas" },
  {
    href: "/projetos",
    label: "Projectos",
    Icon: BriefcaseIcon,
    modulo: "projetos",
    children: [{ href: "/projetos/despesas", label: "Despesas e Custos" }],
  },
  { href: "/stock", label: "Gestão de Stock", Icon: BoxIcon, modulo: "stock" },
  {
    href: "/gamificacao",
    label: "Gamificação",
    Icon: TrophyIcon,
    modulo: "gamificacao",
  },
  { href: "/cadastros", label: "Cadastros", Icon: SlidersIcon, modulo: "cadastros" },
  { href: "/usuarios", label: "Usuários", Icon: UsersIcon, modulo: "usuarios" },
  { href: "/perfis", label: "Perfis", Icon: KeyIcon, modulo: "usuarios" },
];

const COLLAPSE_KEY = "salas_sidebar_collapsed";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

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

  const items = NAV.filter((n) => can(user, n.modulo, "view"));
  const current = items.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/")
  );
  const pageTitle = current?.label ?? "Gestão de Salas";

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

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-200/70">
              Menu
            </p>
          )}
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            // Sub-menu só aparece quando a secção está activa e o menu não está recolhido.
            const children = item.children?.filter((c) =>
              can(user, item.modulo, "view")
            );
            const hasChildren = !!children?.length;
            const showChildren = hasChildren && active && !collapsed;
            // Realça a fundo cheio quando é a própria página; quando o activo é um
            // sub-item, mantém um realce subtil para o pai continuar a parecer clicável.
            const onOwnPage = pathname === item.href;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  title={item.label}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    collapsed ? "lg:justify-center lg:px-0" : ""
                  } ${
                    onOwnPage
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-900/30"
                      : active
                        ? "bg-white/10 text-white"
                        : "text-brand-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.Icon className="h-5 w-5 shrink-0" />
                  <span className={hideOnCollapse}>{item.label}</span>
                  {hasChildren && (
                    <ChevronDown
                      className={`ml-auto h-4 w-4 shrink-0 transition-transform ${hideOnCollapse} ${
                        showChildren ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </Link>
                {showChildren && (
                  <div className="mt-1 space-y-1 border-l border-white/10 pl-3 ml-5">
                    {children!.map((child) => {
                      const childActive =
                        pathname === child.href ||
                        pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-sm transition ${
                            childActive
                              ? "bg-white/10 font-medium text-white"
                              : "text-brand-100 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div
            className={`flex items-center gap-3 px-2 py-2 ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initials(user.name)}
            </div>
            <div className={`min-w-0 flex-1 ${hideOnCollapse}`}>
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="text-[11px] text-brand-200">
                {ROLE_LABELS[user.role]}
              </div>
            </div>
          </div>
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
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="lg:hidden text-slate-600 hover:text-navy"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-navy">{pageTitle}</h1>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                    {initials(user.name)}
                  </span>
                  <span className="hidden text-sm font-medium text-slate-700 sm:block">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold text-slate-800">
                    {user.name}
                  </div>
                  <div className="text-xs font-normal text-slate-400">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openPwd}>
                  <KeyIcon className="h-4 w-4" /> Alterar senha
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogoutIcon className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>

      {/* Modal: alterar a própria senha */}
      <Dialog open={showPwd} onOpenChange={setShowPwd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
          </DialogHeader>
          {pwdOk ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Senha alterada com sucesso.
            </div>
          ) : (
            <form onSubmit={changePassword} className="space-y-3">
              {pwdError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {pwdError}
                </div>
              )}
              <div>
                <Label className="mb-1 block">Senha atual</Label>
                <Input
                  type="password"
                  required
                  value={pwd.current}
                  onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">Nova senha</Label>
                <Input
                  type="password"
                  required
                  value={pwd.next}
                  onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                  placeholder="mín. 6 caracteres"
                />
              </div>
              <div>
                <Label className="mb-1 block">Confirmar nova senha</Label>
                <Input
                  type="password"
                  required
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPwd(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="navy" disabled={pwdSaving}>
                  {pwdSaving ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
          {pwdOk && (
            <DialogFooter>
              <Button variant="navy" onClick={() => setShowPwd(false)}>
                Fechar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

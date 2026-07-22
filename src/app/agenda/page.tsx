import Link from "next/link";
import RoomGrid from "@/components/RoomGrid";

export const metadata = {
  title: "Agenda de Ocupação",
  description: "Consulta pública da ocupação das salas.",
};

// Página pública (sem sessão): mostra a agenda em leitura apenas.
export default function AgendaPublicaPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Logo.png"
          alt="Gestão de Salas"
          className="h-9 object-contain object-left"
        />
        <Link
          href="/login"
          className="ml-auto rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          Entrar
        </Link>
      </header>
      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
        <RoomGrid publicMode />
      </main>
    </div>
  );
}

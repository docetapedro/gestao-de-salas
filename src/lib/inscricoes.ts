// Utilitários do módulo de Eventos de Inscrição.

// Tipos de evento sugeridos (o utilizador pode escrever outro à mão).
export const TIPOS_EVENTO = [
  "Workshop",
  "Palestra",
  "Formação",
  "Seminário",
  "Conferência",
  "Webinar",
  "Outro",
] as const;

/** Converte um título em "slug" legível: minúsculas, sem acentos, com hífens. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Sufixo aleatório curto (base36) para tornar o slug único e não adivinhável. */
export function sufixoAleatorio(n = 6): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  const alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (const b of bytes) out += alfabeto[b % alfabeto.length];
  return out;
}

/** Gera um slug candidato a partir do título (base + sufixo aleatório). */
export function gerarSlug(titulo: string): string {
  const base = slugify(titulo) || "evento";
  return `${base}-${sufixoAleatorio()}`;
}

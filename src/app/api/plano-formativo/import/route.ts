import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import {
  parseTemplateBuffer,
  normCompetencia,
  normTipo,
  normPrioridade,
} from "@/lib/plano-formativo-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

// Importa um template .xlsx preenchido para o ano/plano indicado.
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");

    const form = await req.formData();
    const file = form.get("file");
    const planoId = String(form.get("planoId") ?? "").trim();

    if (!(file instanceof File)) return json({ error: "Nenhum ficheiro enviado" }, 400);
    if (!file.name.toLowerCase().endsWith(".xlsx"))
      return json({ error: "O ficheiro tem de ser .xlsx" }, 400);
    if (file.size > 8 * 1024 * 1024)
      return json({ error: "Ficheiro demasiado grande (máx. 8 MB)" }, 400);
    if (!planoId) return json({ error: "Ano/plano é obrigatório" }, 400);

    const plano = await prisma.pfPlano.findUnique({ where: { id: planoId } });
    if (!plano) return json({ error: "Plano não encontrado" }, 404);

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseTemplateBuffer(buffer);
    if (rows.length === 0)
      return json({ error: "O ficheiro não tem linhas válidas para importar" }, 400);

    const colabCache = new Map<string, string>();
    const formacaoCache = new Map<string, string>();
    let colaboradoresNovos = 0;
    let formacoesNovas = 0;
    let criadas = 0;
    let actualizadas = 0;

    for (const row of rows) {
      // --- Colaborador (por nome exacto) ---
      const nome = row.nome!.trim();
      let colaboradorId = colabCache.get(nome);
      if (!colaboradorId) {
        const existente = await prisma.colaborador.findFirst({ where: { nome } });
        const dados = {
          nome,
          funcao: clean(row.funcao),
          direcao: clean(row.direcao),
          area: clean(row.area),
          liderancaDirecta: clean(row.liderancaDirecta),
        };
        const c = existente
          ? await prisma.colaborador.update({ where: { id: existente.id }, data: dados })
          : ((colaboradoresNovos += 1), await prisma.colaborador.create({ data: dados }));
        colaboradorId = c.id;
        colabCache.set(nome, colaboradorId);
      }

      // --- Formação (por nome único; só preenche atributos ainda vazios) ---
      const nomeFormacao = row.formacao!.trim();
      let formacaoId = formacaoCache.get(nomeFormacao);
      if (!formacaoId) {
        const existente = await prisma.pfFormacao.findUnique({ where: { nome: nomeFormacao } });
        if (!existente) formacoesNovas += 1;
        const f = await prisma.pfFormacao.upsert({
          where: { nome: nomeFormacao },
          update: {
            competencia: normCompetencia(row.competencia, row.tipoAccao) ?? undefined,
            tipoAccao: normTipo(row.tipoAccao) ?? undefined,
            pilar: clean(row.pilar) ?? undefined,
            entidadeSugerida: clean(row.entidade) ?? undefined,
          },
          create: {
            nome: nomeFormacao,
            competencia: normCompetencia(row.competencia, row.tipoAccao),
            tipoAccao: normTipo(row.tipoAccao),
            pilar: clean(row.pilar),
            entidadeSugerida: clean(row.entidade),
          },
        });
        formacaoId = f.id;
        formacaoCache.set(nomeFormacao, formacaoId);
      }

      // --- Inscrição (por [plano, colaborador, formação]) ---
      const chave = {
        planoId_colaboradorId_formacaoId: { planoId, colaboradorId, formacaoId },
      };
      const ja = await prisma.pfInscricao.findUnique({ where: chave });
      if (ja) {
        await prisma.pfInscricao.update({
          where: { id: ja.id },
          data: {
            prioridade: normPrioridade(row.prioridade) ?? undefined,
            motivo: clean(row.motivo) ?? undefined,
          },
        });
        actualizadas += 1;
      } else {
        await prisma.pfInscricao.create({
          data: {
            planoId,
            colaboradorId,
            formacaoId,
            prioridade: normPrioridade(row.prioridade),
            motivo: clean(row.motivo),
          },
        });
        criadas += 1;
      }
    }

    return json({
      ano: plano.ano,
      linhas: rows.length,
      colaboradoresNovos,
      formacoesNovas,
      inscricoesCriadas: criadas,
      inscricoesActualizadas: actualizadas,
    });
  } catch (err) {
    return handleError(err);
  }
}

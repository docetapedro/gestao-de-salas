import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { handleError } from "@/lib/http";
import { gerarListaPresenca } from "@/lib/lista-presenca/generate";

export const runtime = "nodejs";

/** Nome de ficheiro seguro (ASCII) a partir de um texto qualquer. */
function slug(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "projetos", "view");
    const body = await req.json();

    const buffer = gerarListaPresenca({
      assunto: body.assunto,
      turma: body.turma,
      local: body.local,
      data: body.data,
      periodo: body.periodo,
      horario: body.horario,
      participantes: Array.isArray(body.participantes) ? body.participantes : [],
      linhasEmBranco: body.linhasEmBranco,
    });

    const partes = ["Lista_Presenca", slug(body.turma || ""), slug(body.data || "")]
      .filter(Boolean)
      .join("_");
    const filename = `${partes || "Lista_Presenca"}.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

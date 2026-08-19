import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { handleError } from "@/lib/http";
import { buildImportTemplateWorkbook } from "@/lib/plano-formativo-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Descarrega o modelo (.xlsx) de importação de necessidades — para preencher.
export async function GET() {
  try {
    assertCan(await getSession(), "plano-formativo", "view");
    const buffer = await buildImportTemplateWorkbook();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="modelo-plano-formativo.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

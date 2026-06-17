import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Gestão de Salas <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

type UpcomingEvent = {
  title: string;
  roomName: string;
  startAt: Date;
  description?: string | null;
};

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(d);
}

/** Envia o aviso de evento prestes a começar para a lista de administradores. */
export async function sendUpcomingEventEmail(
  to: string[],
  event: UpcomingEvent
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }
  if (to.length === 0) {
    return { ok: false, error: "Sem administradores para notificar" };
  }

  const quando = formatDateTime(event.startAt);

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#e0f2fe;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #bfdbfe">
      <div style="background:#0a1f44;color:#fff;padding:20px 24px">
        <h1 style="margin:0;font-size:18px">Evento prestes a começar</h1>
      </div>
      <div style="padding:24px;color:#0f172a">
        <p style="margin:0 0 16px">Olá, administrador. Um evento vai começar em breve:</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#64748b;width:120px">Evento</td>
            <td style="padding:8px 0;font-weight:600">${escapeHtml(event.title)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Sala</td>
            <td style="padding:8px 0;font-weight:600">${escapeHtml(event.roomName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Início</td>
            <td style="padding:8px 0;font-weight:600">${escapeHtml(quando)}</td>
          </tr>
          ${
            event.description
              ? `<tr><td style="padding:8px 0;color:#64748b">Descrição</td><td style="padding:8px 0">${escapeHtml(
                  event.description
                )}</td></tr>`
              : ""
          }
        </table>
      </div>
      <div style="background:#f1f5f9;color:#64748b;padding:14px 24px;font-size:12px">
        Gestão de Ocupação de Salas — aviso automático
      </div>
    </div>
  </div>`;

  try {
    await resend.emails.send({
      from,
      to,
      subject: `🔔 ${event.title} começa em breve — ${event.roomName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

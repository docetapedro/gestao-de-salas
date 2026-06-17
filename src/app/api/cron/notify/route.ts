import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUpcomingEventEmail } from "@/lib/email";
import { json, handleError } from "@/lib/http";

// Chamada periodicamente pelo Vercel Cron (ver vercel.json).
// Também pode ser disparada manualmente para testar.

export async function GET(req: NextRequest) {
  try {
    // Proteção: o Vercel Cron envia "Authorization: Bearer <CRON_SECRET>".
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return json({ error: "Não autorizado" }, 401);
      }
    }

    const windowMin = Number(process.env.NOTIFY_WINDOW_MINUTES || "30");
    const now = new Date();
    const limit = new Date(now.getTime() + windowMin * 60 * 1000);

    // Eventos que começam entre agora e a janela, ainda não avisados.
    const events = await prisma.event.findMany({
      where: {
        notifiedAt: null,
        startAt: { gte: now, lte: limit },
      },
      include: { room: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    });

    if (events.length === 0) {
      return json({ ok: true, checked: 0, notified: 0 });
    }

    // Administradores ativos que querem receber avisos.
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true, notify: true },
      select: { email: true },
    });
    const recipients = admins.map((a) => a.email);

    let notified = 0;
    const errors: string[] = [];

    for (const ev of events) {
      const result = await sendUpcomingEventEmail(recipients, {
        title: ev.title,
        roomName: ev.room.name,
        startAt: ev.startAt,
        description: ev.description,
      });
      if (result.ok) {
        await prisma.event.update({
          where: { id: ev.id },
          data: { notifiedAt: new Date() },
        });
        notified++;
      } else {
        errors.push(`${ev.title}: ${result.error}`);
      }
    }

    return json({
      ok: true,
      checked: events.length,
      notified,
      recipients: recipients.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return handleError(err);
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Slots disjuntos dentro do horário de trabalho (08h–18h) → sem sobreposição por sala.
const SLOTS: [number, number, number, number][] = [
  // [horaInício, minInício, horaFim, minFim]
  [8, 0, 9, 0],
  [9, 30, 11, 0],
  [11, 0, 12, 0],
  [13, 0, 14, 30],
  [14, 30, 15, 30],
  [16, 0, 17, 30],
];

const TITLES = [
  "Reunião de Equipa",
  "Formação Interna",
  "Entrevista de Candidato",
  "Workshop de UX",
  "Planeamento de Sprint",
  "Apresentação a Cliente",
  "Daily Standup",
  "Revisão Financeira",
  "Onboarding de Colaborador",
  "Comité Diretivo",
  "Sessão de Brainstorming",
  "Demonstração de Produto",
  "Alinhamento de Marketing",
  "Retrospetiva",
];

const DESCRIPTIONS = [
  "Sessão de trabalho com a equipa.",
  "Encontro periódico de acompanhamento.",
  null,
  "Reservado com antecedência.",
  "Participação de convidados externos.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const rooms = await prisma.room.findMany({ where: { active: true } });
  if (rooms.length === 0) {
    console.log("Nenhuma sala ativa. Rode o seed principal primeiro (npm run db:seed).");
    return;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  // Limpa eventos existentes para um conjunto de teste limpo.
  await prisma.event.deleteMany({});

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data: {
    title: string;
    description: string | null;
    roomId: string;
    startAt: Date;
    endAt: Date;
    createdById: string | null;
  }[] = [];

  // Cobre de 7 dias atrás até 21 dias à frente (preenche dia/semana/mês).
  for (let offset = -7; offset <= 21; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    const dow = day.getDay(); // 0=domingo, 6=sábado
    if (dow === 0 || dow === 6) continue; // apenas dias úteis

    for (const room of rooms) {
      // Embaralha os slots e escolhe 1–3 por sala/dia.
      const shuffled = [...SLOTS].sort(() => Math.random() - 0.5);
      const count = 1 + Math.floor(Math.random() * 3);
      for (const slot of shuffled.slice(0, count)) {
        const [sh, sm, eh, em] = slot;
        const startAt = new Date(day);
        startAt.setHours(sh, sm, 0, 0);
        const endAt = new Date(day);
        endAt.setHours(eh, em, 0, 0);
        data.push({
          title: pick(TITLES),
          description: pick(DESCRIPTIONS),
          roomId: room.id,
          startAt,
          endAt,
          createdById: admin?.id ?? null,
        });
      }
    }
  }

  await prisma.event.createMany({ data });
  console.log(`Criados ${data.length} eventos de teste em ${rooms.length} salas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

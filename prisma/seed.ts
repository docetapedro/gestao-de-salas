import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@salas.local";
  const adminPassword = "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Administrador",
      email: adminEmail,
      password: passwordHash,
      role: "ADMIN",
      notify: true,
      active: true,
    },
  });

  // Salas
  const salas = [
    { name: "Kiala", location: "Piso 1", capacity: 12, color: "#1d4ed8" },
    { name: "Ndjila", location: "Piso 2", capacity: 30, color: "#0ea5e9" },
    { name: "SkyOne", location: "Piso 0", capacity: 120, color: "#0a1f44" },
  ];

  for (const s of salas) {
    await prisma.room.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }

  console.log("Seed concluído.");
  console.log(`Login admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Admin id: ${admin.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

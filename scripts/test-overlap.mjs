// Testa que a API rejeita eventos sobrepostos na mesma sala.
const BASE = "http://localhost:3000";

function cookieFrom(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0]; // salas_session=...
}

async function main() {
  // 1) Login
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@salas.local", password: "admin123" }),
  });
  const cookie = cookieFrom(login);
  if (!cookie) throw new Error("Falha no login");

  const h = { "Content-Type": "application/json", cookie };

  // 2) Pega uma sala
  const rooms = (await (await fetch(`${BASE}/api/rooms`, { headers: h })).json()).rooms;
  const roomId = rooms[0].id;
  console.log(`Sala de teste: ${rooms[0].name}`);

  // Data bem no futuro (sem eventos semeados) para não colidir com o seed.
  const A = {
    title: "TESTE A",
    roomId,
    startAt: "2026-12-25T10:00:00.000Z",
    endAt: "2026-12-25T11:00:00.000Z",
  };

  // 3) Cria A (deve dar 201)
  const ra = await fetch(`${BASE}/api/events`, { method: "POST", headers: h, body: JSON.stringify(A) });
  const da = await ra.json();
  console.log(`A) criar 10:00–11:00 -> HTTP ${ra.status} ${ra.ok ? "(OK criado)" : ""}`);
  const idA = da.event?.id;

  // 4) Tenta B sobreposto (10:30–11:30) -> deve dar 409
  const B = { ...A, title: "TESTE B (sobreposto)", startAt: "2026-12-25T10:30:00.000Z", endAt: "2026-12-25T11:30:00.000Z" };
  const rb = await fetch(`${BASE}/api/events`, { method: "POST", headers: h, body: JSON.stringify(B) });
  const db = await rb.json();
  console.log(`B) sobreposto 10:30–11:30 -> HTTP ${rb.status} ${rb.status === 409 ? "(BLOQUEADO ✔)" : "(FALHOU ✗)"} ${db.error ? "— " + db.error : ""}`);

  // 5) Tenta C encostando (11:00–12:00) -> deve dar 201 (não sobrepõe)
  const C = { ...A, title: "TESTE C (encostado)", startAt: "2026-12-25T11:00:00.000Z", endAt: "2026-12-25T12:00:00.000Z" };
  const rc = await fetch(`${BASE}/api/events`, { method: "POST", headers: h, body: JSON.stringify(C) });
  const dc = await rc.json();
  console.log(`C) encostado 11:00–12:00 -> HTTP ${rc.status} ${rc.ok ? "(PERMITIDO ✔)" : "(FALHOU ✗)"}`);
  const idC = dc.event?.id;

  // 6) Limpeza
  if (idA) await fetch(`${BASE}/api/events/${idA}`, { method: "DELETE", headers: h });
  if (idC) await fetch(`${BASE}/api/events/${idC}`, { method: "DELETE", headers: h });
  console.log("Limpeza concluída.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

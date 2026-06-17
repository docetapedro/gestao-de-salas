import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((e) =>
      e.textContent.trim().includes(t)
    );
    if (!el) throw new Error("Botão não encontrado: " + t);
    el.click();
  }, text);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--window-size=1600,950"],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("input[type=email]", "admin@salas.local");
await page.type("input[type=password]", "admin123");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  clickByText(page, "Entrar"),
]);
await page.waitForFunction(() => document.body.innerText.includes("Kiala"), {
  timeout: 15000,
});

// Grade (eventos passados em cinza)
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
await sleep(1500);
await page.screenshot({ path: `${OUT}/grid-cinza.png` });
console.log("ok grid");

// Lista de eventos (filtros + paginação)
await page.goto(`${BASE}/eventos`, { waitUntil: "networkidle2" });
await sleep(1500);
await page.screenshot({ path: `${OUT}/eventos-lista.png` });
console.log("ok lista");

// Abre modal e o datepicker (dentro do form, não os filtros)
await clickByText(page, "Novo evento");
await page.waitForSelector("form .react-datepicker__input-container input", {
  timeout: 8000,
});
await sleep(500);
await page.click("form .react-datepicker__input-container input");
await sleep(800);
await page.screenshot({ path: `${OUT}/eventos-datepicker.png` });
console.log("ok datepicker");

await browser.close();
console.log("DONE");

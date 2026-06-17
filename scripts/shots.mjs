import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const els = [...document.querySelectorAll("button")];
    const el = els.find((e) => e.textContent.trim().includes(t));
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

// Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type('input[type=email]', "admin@salas.local");
await page.type('input[type=password]', "admin123");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  clickByText(page, "Entrar"),
]);
await page.waitForFunction(() => document.body.innerText.includes("Kiala"), {
  timeout: 15000,
});
await sleep(1200);

// Visão diária
await page.screenshot({ path: `${OUT}/1-diaria.png` });
console.log("ok diaria");

// Visão semanal
await clickByText(page, "Semanal");
await sleep(1500);
await page.screenshot({ path: `${OUT}/2-semanal.png` });
console.log("ok semanal");

// Visão mensal
await clickByText(page, "Mensal");
await sleep(1500);
await page.screenshot({ path: `${OUT}/3-mensal.png` });
console.log("ok mensal");

// Modo TV (tela cheia) na visão diária
await clickByText(page, "Diária");
await sleep(800);
await page.setViewport({ width: 1920, height: 1080 });
await clickByText(page, "Tela cheia");
await sleep(1500);
await page.screenshot({ path: `${OUT}/4-tv.png` });
console.log("ok tv");

await browser.close();
console.log("DONE");

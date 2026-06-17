import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
mkdirSync("shots", { recursive: true });
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

// Login page (logo)
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(800);
await page.screenshot({ path: "shots/login-logo.png" });
console.log("ok login");

// Login
await page.type("input[type=email]", "admin@salas.local");
await page.type("input[type=password]", "admin123");
await clickByText(page, "Entrar");
await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 20000 });
await page.waitForFunction(() => document.body.innerText.includes("Kiala"), { timeout: 30000 });
await sleep(1000);

// Semana (azul agendado + logo no menu)
await clickByText(page, "Semanal");
await sleep(1800);
await page.screenshot({ path: "shots/semana-verify.png" });
console.log("ok semana");

await browser.close();
console.log("DONE");

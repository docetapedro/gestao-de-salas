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
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("input[type=email]", "admin@salas.local");
await page.type("input[type=password]", "admin123");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  clickByText(page, "Entrar"),
]);
await page.waitForFunction(() => document.body.innerText.includes("Kiala"), { timeout: 15000 });
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
await sleep(1000);
await clickByText(page, "Semanal");
await sleep(1500);
await page.screenshot({ path: "shots/semana-agendado.png" });
console.log("ok semana");
await browser.close();
console.log("DONE");

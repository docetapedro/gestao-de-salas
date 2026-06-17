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
await sleep(800);
await page.screenshot({ path: "shots/login-final.png" });
console.log("ok login");

await page.type("input[type=email]", "admin@salas.local");
await page.type("input[type=password]", "admin123");
await clickByText(page, "Entrar");
await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 20000 });
await page.waitForFunction(() => document.body.innerText.includes("Kiala"), { timeout: 30000 });
await sleep(800);
await page.screenshot({ path: "shots/menu-final.png" });
console.log("ok menu");

// Abrir modal alterar senha
await clickByText(page, "Alterar senha");
await sleep(600);
await page.screenshot({ path: "shots/senha-modal.png" });
console.log("ok senha");

await browser.close();
console.log("DONE");

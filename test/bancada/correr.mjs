// Corre a bancada num Chrome headless e devolve o resultado.
// Não faz parte do `npm test` porque precisa do Chrome instalado: `npm run test:dom`.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
const porta = 9000 + Math.floor(Math.random() * 900);

const servidor = http.createServer((req, res) => {
  const alvo = path.join(raiz, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!alvo.startsWith(raiz) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "content-type": tipos[path.extname(alvo)] ?? "text/plain" });
  fs.createReadStream(alvo).pipe(res);
}).listen(porta);

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) {
  console.log("  · sem Chrome em", CHROME, "— bancada saltada (defina CHROME=...)");
  servidor.close();
  process.exit(0);
}

const perfil = fs.mkdtempSync("/tmp/stage-perfil-");
const depuracao = porta + 1;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${depuracao}`, `--user-data-dir=${perfil}`,
  "--no-first-run", "--disable-gpu", `http://localhost:${porta}/test/bancada/index.html`
], { stdio: "ignore" });

const esperar = (ms) => new Promise(r => setTimeout(r, ms));
let alvo = null;
for (let i = 0; i < 40 && !alvo; i++) {
  await esperar(400);
  try { alvo = (await (await fetch(`http://127.0.0.1:${depuracao}/json`)).json()).find(t => t.type === "page"); } catch {}
}
if (!alvo) { console.error("  ✖ o Chrome não abriu"); process.exit(1); }

const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0;
const avaliar = (expression) => new Promise(r => {
  const meu = ++id;
  ws.addEventListener("message", function f(ev) {
    const m = JSON.parse(ev.data);
    if (m.id !== meu) return;
    ws.removeEventListener("message", f);
    r(m.result?.result?.value);
  });
  ws.send(JSON.stringify({ id: meu, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
});

let resultados = null;
for (let i = 0; i < 25 && !resultados; i++) {
  await esperar(400);
  resultados = await avaliar("globalThis.__r ?? null");
}

ws.close(); chrome.kill(); servidor.close();
setTimeout(() => { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} }, 500);

if (!resultados) {
  const erro = await avaliar("document.body.innerText").catch(() => "");
  console.error("  ✖ a bancada não chegou ao fim", erro ?? "");
  process.exit(1);
}
for (const r of resultados) console.log(`  ${r.ok ? "✓" : "✖"} ${r.nome}${r.ok ? "" : ` → ${JSON.stringify(r.obtido)} (esperado ${JSON.stringify(r.esperado)})`}`);
const mal = resultados.filter(r => !r.ok).length;
console.log(mal ? `  ✖ ${mal} de ${resultados.length} falharam` : `  ✓ bancada: ${resultados.length} verificações`);
process.exit(mal ? 1 : 0);

import test from "node:test";
import assert from "node:assert/strict";
import {
  escalaPorRoda, enquadramentoValido, arrastarFundo, aproximarFundo, tamanhoCoberto,
  pousarNoChao, zonaDeSaida, avaliarFundo, estiloDoFundo
} from "../scripts/logica.js";

// ── personagens: a roda ─────────────────────────────────────────────
test("uma volta de rato muda o tamanho uns 11%", () => {
  const nova = escalaPorRoda(0.6, -100);
  assert.ok(nova > 0.66 && nova < 0.69, `nova ${nova}`);
  assert.ok(escalaPorRoda(0.6, 100) < 0.6);
});

test("o trackpad (muitos passos pequenos) muda devagar, sem saltos", () => {
  // um trackpad manda dezenas de eventos com deltaY ~3: antes cada um valia ±3%
  const um = escalaPorRoda(0.6, -3);
  assert.ok(Math.abs(um - 0.6) <= 0.01, `um passo de trackpad mexeu ${um - 0.6}`);
});

test("a roda nunca sai dos limites da escala", () => {
  assert.equal(escalaPorRoda(1.1, -5000), 1.1);
  assert.equal(escalaPorRoda(0.15, 5000), 0.15);
});

test("rodas em linhas (Firefox/Zen) contam como pixéis", () => {
  // deltaMode 1: uma linha ≈ 16 px — sem isto, no Zen a roda quase não mexia
  assert.ok(Math.abs(escalaPorRoda(0.6, -3, 1) - escalaPorRoda(0.6, -48, 0)) < 1e-9);
});

// ── personagens: chão e saída ───────────────────────────────────────
test("perto do chão de outra personagem, os pés encostam a ele", () => {
  assert.deepEqual(pousarNoChao(0.962, [0.97, 0.8]), { y: 0.97, guia: 0.97 });
  assert.deepEqual(pousarNoChao(0.9, [0.97]), { y: 0.9, guia: null });
});

test("longe de toda a gente, fica onde se largou", () => {
  assert.deepEqual(pousarNoChao(0.5, []), { y: 0.5, guia: null });
});

test("arrastar para lá do fundo do ecrã tira a personagem", () => {
  assert.equal(zonaDeSaida(1.08), true);
  assert.equal(zonaDeSaida(0.99), false);
});

// ── fundo: enquadrar ────────────────────────────────────────────────
const ecra = { W: 1920, H: 1080 };

test("enquadramento por omissão: centro, sem zoom", () => {
  assert.deepEqual(enquadramentoValido(undefined), { x: 0.5, y: 0.5, zoom: 1 });
  assert.deepEqual(enquadramentoValido({ x: 9, y: -1, zoom: 50 }), { x: 1, y: 0, zoom: 3 });
});

test("o tamanho coberto enche o ecrã sem barras", () => {
  const c = tamanhoCoberto(1024, 1024, ecra);            // quadrada num 16:9
  assert.equal(c.w, 1920);
  assert.equal(c.h, 1920);
});

test("arrastar o fundo segue o rato: a imagem anda o que o rato andou", () => {
  // imagem quadrada num 16:9: sobram 840 px na vertical; descer o rato 84 px = 10%
  const e = arrastarFundo({ x: 0.5, y: 0.5, zoom: 1 }, 0, 84, { nw: 1024, nh: 1024, ...ecra });
  assert.ok(Math.abs(e.y - 0.4) < 1e-9, `y ${e.y}`);   // mostra mais de cima
  assert.equal(e.x, 0.5);                                // na horizontal não sobra nada
});

test("arrastar o fundo nunca destapa barras", () => {
  const e = arrastarFundo({ x: 0.5, y: 0.5, zoom: 1 }, 0, 99999, { nw: 1024, nh: 1024, ...ecra });
  assert.equal(e.y, 0);
});

test("com zoom, até uma imagem 16:9 se deixa arrastar", () => {
  const sem = arrastarFundo({ x: 0.5, y: 0.5, zoom: 1 }, 100, 0, { nw: 1920, nh: 1080, ...ecra });
  assert.equal(sem.x, 0.5);
  const com = arrastarFundo({ x: 0.5, y: 0.5, zoom: 2 }, 100, 0, { nw: 1920, nh: 1080, ...ecra });
  assert.ok(com.x < 0.5);
});

test("a roda no fundo aproxima e afasta dentro dos limites", () => {
  assert.ok(aproximarFundo({ x: 0.5, y: 0.5, zoom: 1 }, -100).zoom > 1);
  assert.equal(aproximarFundo({ x: 0.5, y: 0.5, zoom: 1 }, 500).zoom, 1);   // nunca menos que encher
});

test("o estilo do fundo junta o sítio e o zoom no mesmo ponto", () => {
  const s = estiloDoFundo({ x: 0.25, y: 0.75, zoom: 1.5 });
  assert.equal(s.objectPosition, "25% 75%");
  assert.equal(s.transformOrigin, "25% 75%");
  assert.equal(s.escala, 1.5);
});

// ── fundo: a imagem serve? ──────────────────────────────────────────
test("2560×1440 é ótima e não corta nada num ecrã 16:9", () => {
  const a = avaliarFundo(2560, 1440);
  assert.equal(a.nivel, "otima");
  assert.equal(a.corte, 0);
});

test("1920×1080 serve", () => assert.equal(avaliarFundo(1920, 1080).nivel, "boa"));

test("uma imagem pequena é apontada como pequena", () => assert.equal(avaliarFundo(1024, 1024).nivel, "pequena"));

test("uma imagem quadrada perde uns 44% a encher um 16:9", () => {
  const a = avaliarFundo(3000, 3000);
  assert.ok(a.corte > 0.4 && a.corte < 0.46, `corte ${a.corte}`);
});

// ── entrar em cena ──────────────────────────────────────────────────
import { chaoComum } from "../scripts/dados.js";
import { novaPersonagem, instantaneo } from "../scripts/logica.js";

test("quem entra, entra no chão da maioria", () => {
  assert.equal(chaoComum([]), 0.97);
  assert.equal(chaoComum([{ y: 0.9 }, { y: 0.9 }, { y: 0.97 }]), 0.9);
});

test("uma personagem nova pode nascer noutro chão", () => {
  assert.equal(novaPersonagem({ id: "x", y: 0.8 }).y, 0.8);
  assert.equal(novaPersonagem({ id: "x" }).y, 0.97);
});

test("o enquadramento conta como alteração da cena guardada", () => {
  const base = { fundo: "a.jpg", ajuste: "cobrir", deriva: true, elenco: [] };
  assert.notEqual(instantaneo({ ...base, enquadramento: { x: 0.2, y: 0.5, zoom: 1 } }), instantaneo(base));
  assert.equal(instantaneo(base), instantaneo({ ...base, enquadramento: { x: 0.5, y: 0.5, zoom: 1 } }));
});

test("dez passos pequenos de trackpad somam-se (não se perdem no arredondamento)", () => {
  // o bug apanhado no Foundry: cada passo era arredondado a 2 casas e 0,5 → 0,5018 → 0,50
  let e = 0.5;
  for (let i = 0; i < 10; i++) e = escalaPorRoda(e, -3);
  assert.ok(e > 0.515, `ficou em ${e}`);
});

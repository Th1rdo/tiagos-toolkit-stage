import test from "node:test";
import assert from "node:assert/strict";
import {
  fracaoValida, escalaValida, ajusteValido, novaPersonagem, ordenarElenco,
  estiloDaPersonagem, haFocoNoElenco, alternarFoco, podeVer, palcoVazio, nomeDoFicheiro
} from "../scripts/logica.js";
import { posicaoLivre } from "../scripts/dados.js";

const ana = { id: "a", nome: "Ana", img: "a.webp", x: 0.33, y: 0.97, escala: 0.6 };
const rui = { id: "r", nome: "Rui", img: "r.webp", x: 0.67, y: 0.9, escala: 0.6 };

test("frações ficam entre 0 e 1", () => {
  assert.equal(fracaoValida(0.42), 0.42);
  assert.equal(fracaoValida(-3), 0);
  assert.equal(fracaoValida(9), 1);
  assert.equal(fracaoValida("nada"), 0.5);
  assert.equal(fracaoValida(undefined, 0.97), 0.97);
});

test("escala fora da tabela é apertada", () => {
  assert.equal(escalaValida(0.6), 0.6);
  assert.equal(escalaValida(5), 1.1);
  assert.equal(escalaValida(0.01), 0.15);
  assert.equal(escalaValida("x"), 0.62);
});

test("ajuste desconhecido cai em encher o ecrã", () => {
  assert.equal(ajusteValido("conter"), "conter");
  assert.equal(ajusteValido("seja o que for"), "cobrir");
});

test("uma personagem nova entra de pé no chão", () => {
  const p = novaPersonagem({ id: "x", nome: " Ana ", img: "a.webp" });
  assert.equal(p.nome, "Ana");
  assert.equal(p.y, 0.97);
  assert.equal(p.escala, 0.62);
  assert.equal(p.espelhado, false);
});

test("duas pessoas a conversar caem frente a frente, sem arrastar nada", () => {
  assert.equal(posicaoLivre([]), 0.33);
  assert.equal(posicaoLivre([{ x: 0.33 }]), 0.67);
  assert.equal(posicaoLivre([{ x: 0.33 }, { x: 0.67 }]), 0.5);
});

test("quem está mais abaixo no ecrã fica à frente; o foco passa à frente de todos", () => {
  assert.deepEqual(ordenarElenco([ana, rui]).map(p => p.id), ["r", "a"]);
  assert.deepEqual(ordenarElenco([{ ...ana, foco: true }, rui]).map(p => p.id), ["r", "a"]);
});

test("a âncora é nos pés: grande e pequena assentam no mesmo chão", () => {
  const s = estiloDaPersonagem(ana);
  assert.equal(s.top, "97%");
  assert.equal(s.transform, "translate(-50%, -100%)");
  assert.equal(s.altura, "60vh");
  assert.equal(estiloDaPersonagem({ ...ana, espelhado: true }).transform, "translate(-50%, -100%) scaleX(-1)");
});

test("com foco na mesa, quem não fala recua sem desaparecer", () => {
  const comFoco = estiloDaPersonagem({ ...ana, foco: true }, { haFoco: true });
  const semFoco = estiloDaPersonagem(rui, { haFoco: true });
  assert.equal(comFoco.opacidade, 1);
  assert.equal(semFoco.opacidade, 0.55);
  assert.equal(semFoco.filtro.includes("brightness"), true);
  assert.equal(estiloDaPersonagem(rui, { haFoco: false }).opacidade, 1);
});

test("clicar em quem já tem o foco devolve a cena a todos", () => {
  const um = alternarFoco([ana, rui], "a");
  assert.equal(haFocoNoElenco(um), true);
  assert.equal(um.find(p => p.id === "a").foco, true);
  const zero = alternarFoco(um, "a");
  assert.equal(haFocoNoElenco(zero), false);
});

test("quem vê o palco", () => {
  const vazio = { fundo: "", elenco: [] };
  const montado = { fundo: "casa.webp", elenco: [ana], visivel: false };
  const noAr = { ...montado, visivel: true };

  assert.equal(podeVer(vazio, { isGM: true, aCompor: true }), false, "palco vazio não tapa nada");
  assert.equal(podeVer(montado, { isGM: false }), false, "a mesa não vê antes do mestre mandar");
  assert.equal(podeVer(montado, { isGM: true, aCompor: true }), true, "o mestre compõe a ver");
  assert.equal(podeVer(montado, { isGM: true, aCompor: false }), false, "painel fechado, mapa livre");
  assert.equal(podeVer(noAr, { isGM: false }), true);
  assert.equal(palcoVazio(vazio), true);
});

test("nome legível a partir do ficheiro", () => {
  assert.equal(nomeDoFicheiro("assets/npc/velho_do_farol.webp"), "velho do farol");
  assert.equal(nomeDoFicheiro(""), "");
});

// ------------------------------------------------------------------ biblioteca
import { instantaneo, igualAoGuardado, resumoDaCena, filtrarCenas, nomeLivre } from "../scripts/logica.js";

const guardada = { id: "g1", nome: "Casa de Mero", fundo: "casa.webp", ajuste: "cobrir", deriva: true, elenco: [ana, rui] };

test("dar o foco a quem fala não conta como alterar a cena", () => {
  const comFoco = { ...guardada, elenco: [{ ...ana, foco: true }, rui] };
  assert.equal(igualAoGuardado(comFoco, guardada), true);
});

test("mexer numa personagem conta como alterar", () => {
  const movida = { ...guardada, elenco: [{ ...ana, x: 0.1 }, rui] };
  assert.equal(igualAoGuardado(movida, guardada), false);
});

test("trocar o fundo conta como alterar", () => {
  assert.equal(igualAoGuardado({ ...guardada, fundo: "outra.webp" }, guardada), false);
  assert.equal(igualAoGuardado(guardada, null), false, "sem original não há comparação");
  assert.equal(typeof instantaneo(guardada), "string");
});

test("o cartão mostra nome, fundo e quantos estão em cena", () => {
  assert.deepEqual(resumoDaCena(guardada), { id: "g1", nome: "Casa de Mero", fundo: "casa.webp", quantos: 2 });
  assert.equal(resumoDaCena({}).nome, "Sem nome");
});

test("a procura também encontra pelo nome de quem está na cena", () => {
  const cenas = [guardada, { id: "g2", nome: "Deserto", elenco: [] }];
  assert.deepEqual(filtrarCenas(cenas, "casa").map(c => c.id), ["g1"]);
  assert.deepEqual(filtrarCenas(cenas, "rui").map(c => c.id), ["g1"]);
  assert.deepEqual(filtrarCenas(cenas, "").map(c => c.id), ["g1", "g2"]);
});

test("nomes repetidos ganham número em vez de se atropelarem", () => {
  const cenas = [{ nome: "Taberna" }, { nome: "Taberna 2" }];
  assert.equal(nomeLivre(cenas, "Taberna"), "Taberna 3");
  assert.equal(nomeLivre(cenas, "Porto"), "Porto");
  assert.equal(nomeLivre([], ""), "Cena");
});

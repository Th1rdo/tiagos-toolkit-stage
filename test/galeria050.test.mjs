import test from "node:test";
import assert from "node:assert/strict";
import {
  lerHora, agruparPorLocal, normalizarHoras, comHora, etiquetaHora, filtrarCenas, resumoDaCena,
  instantaneo, eImagem, procurarRetratos
} from "../scripts/logica.js";

// ── a hora no nome do ficheiro ─────────────────────────────────────
// Os fundos do Tiago chamam-se «Boteco do Kokichi – noite», «Laje das antenas do Trevor - dia»…
test("lerHora: o sítio e a hora saem do nome do ficheiro", () => {
  assert.deepEqual(lerHora("MAIN/AKRASIA/Fundos/Boteco do Kokichi - noite.webp"), { local: "Boteco do Kokichi", hora: "noite" });
  assert.deepEqual(lerHora("Laje das antenas do Trevor – dia.png"), { local: "Laje das antenas do Trevor", hora: "dia" });
  assert.deepEqual(lerHora("rua_da_kuaa_day.jpg"), { local: "rua da kuaa", hora: "dia" });
  assert.deepEqual(lerHora("Quarto do Arnold (night).webp"), { local: "Quarto do Arnold", hora: "noite" });
  assert.deepEqual(lerHora("Casa%20do%20cliente%20-%20sala%20-%20dia.webp"), { local: "Casa do cliente - sala", hora: "dia" });
  assert.deepEqual(lerHora("Igreja.webp"), { local: "Igreja", hora: null });
  // «Diana» não é «dia»: a hora tem de ser uma palavra no fim
  assert.deepEqual(lerHora("Casa da Diana.webp"), { local: "Casa da Diana", hora: null });
});

test("agruparPorLocal: o dia e a noite do mesmo sítio são uma cena só", () => {
  const g = agruparPorLocal([
    "f/Boteco do Kokichi - noite.webp", "f/Boteco do Kokichi - dia.webp",
    "f/Quarto do Kokichi - noite.webp", "f/Igreja.webp", "f/leia-me.txt"
  ]);
  assert.deepEqual(g.map(x => x.local), ["Boteco do Kokichi", "Igreja", "Quarto do Kokichi"]);
  const boteco = g[0];
  assert.deepEqual(boteco.horas, { dia: "f/Boteco do Kokichi - dia.webp", noite: "f/Boteco do Kokichi - noite.webp" });
  assert.equal(boteco.hora, "dia", "abre de dia quando há as duas");
  assert.equal(boteco.fundo, boteco.horas.dia);
  assert.deepEqual(g[1].horas, {}, "sem hora no nome: sem variantes");
  assert.equal(g[1].fundo, "f/Igreja.webp");
  assert.equal(g[2].hora, "noite");
});

test("normalizarHoras aguenta cenas antigas (sem horas)", () => {
  assert.deepEqual(normalizarHoras({ fundo: "a.webp" }), { horas: {}, hora: "" });
  assert.deepEqual(normalizarHoras({ fundo: "n.webp", horas: { dia: "d.webp", noite: "n.webp", lixo: "x" }, hora: "noite" }),
    { horas: { dia: "d.webp", noite: "n.webp" }, hora: "noite" });
  assert.deepEqual(normalizarHoras({ fundo: "d.webp", horas: { dia: "d.webp" }, hora: "tarde" }), { horas: { dia: "d.webp" }, hora: "dia" });
});

test("comHora troca o fundo e guarda o que estava; mantém enquadramento e elenco", () => {
  const p = { fundo: "d.webp", horas: { dia: "d.webp", noite: "n.webp" }, hora: "dia", enquadramento: { x: 0.3, y: 0.5, zoom: 1.4 }, elenco: [{ id: "a" }] };
  const n = comHora(p, "noite");
  assert.equal(n.fundo, "n.webp");
  assert.equal(n.hora, "noite");
  assert.deepEqual(n.enquadramento, p.enquadramento);
  assert.deepEqual(n.elenco, p.elenco);
  // uma hora sem imagem não muda o fundo (o painel pede a imagem primeiro)
  assert.equal(comHora({ fundo: "d.webp", horas: { dia: "d.webp" }, hora: "dia" }, "noite").fundo, "d.webp");
});

test("etiquetas DAY / NIGHT como na galeria do Tiago", () => {
  assert.equal(etiquetaHora("dia"), "DAY");
  assert.equal(etiquetaHora("noite"), "NIGHT");
  assert.equal(etiquetaHora(""), "");
});

test("filtrar por hora e procurar também na descrição", () => {
  const cenas = [
    { nome: "Boteco", descricao: "Onde o Kokichi conversa com os moradores", horas: { dia: "d", noite: "n" }, hora: "dia" },
    { nome: "Quarto do Arnold", horas: { noite: "q" }, hora: "noite", elenco: [{ nome: "Arnold" }] },
    { nome: "Igreja" }
  ];
  assert.deepEqual(filtrarCenas(cenas, "moradores").map(c => c.nome), ["Boteco"]);
  assert.deepEqual(filtrarCenas(cenas, "", "noite").map(c => c.nome), ["Boteco", "Quarto do Arnold"], "tem noite (mesmo que esteja de dia)");
  assert.deepEqual(filtrarCenas(cenas, "", "dia").map(c => c.nome), ["Boteco"]);
  assert.deepEqual(filtrarCenas(cenas, "arnold", "noite").map(c => c.nome), ["Quarto do Arnold"]);
});

test("o cartão da galeria leva o nome do ficheiro, a hora e a descrição", () => {
  const r = resumoDaCena({ id: "b", nome: "Boteco", descricao: "Conversa", fundo: "f/Boteco%20do%20Kokichi%20-%20noite.webp", horas: { dia: "d", noite: "f/x" }, hora: "noite" });
  assert.equal(r.ficheiro, "Boteco do Kokichi - noite");
  assert.equal(r.etiqueta, "NIGHT");
  assert.equal(r.descricao, "Conversa");
  assert.deepEqual(r.horasDisponiveis, ["dia", "noite"]);
});

test("a hora e a descrição contam como alteração da cena", () => {
  const base = { fundo: "d", horas: { dia: "d", noite: "n" }, hora: "dia", descricao: "" };
  assert.notEqual(instantaneo(base), instantaneo({ ...base, hora: "noite", fundo: "n" }));
  assert.notEqual(instantaneo(base), instantaneo({ ...base, descricao: "x" }));
  assert.equal(instantaneo({ fundo: "a" }), instantaneo({ fundo: "a", horas: {}, hora: "", descricao: "" }), "cenas antigas continuam iguais a si mesmas");
});

test("eImagem e procurar retratos na pasta de personagens", () => {
  assert.ok(eImagem("a/b.WEBP"));
  assert.ok(!eImagem("a/b.txt"));
  const r = ["p/Kokichi.webp", "p/Trevor%20Paulo.png", "p/Arnold.jpg"];
  assert.deepEqual(procurarRetratos(r, "").map(x => x.nome), ["Arnold", "Kokichi", "Trevor Paulo"]);
  assert.deepEqual(procurarRetratos(r, "trev").map(x => x.img), ["p/Trevor%20Paulo.png"]);
});

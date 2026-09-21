import { AJUSTE, ESCALA } from "./const.js";

/**
 * Regras puras — sem `game`, sem DOM. É isto que os testes cobrem.
 */

const entre = (v, min, max) => Math.min(max, Math.max(min, v));

/** Posições são frações do ecrã (0–1), nunca pixéis: ver a nota em const.js. */
export function fracaoValida(v, padrao = 0.5) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(entre(n, 0, 1) * 1000) / 1000 : padrao;
}

export function escalaValida(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return ESCALA.padrao;
  return Math.round(entre(n, ESCALA.min, ESCALA.max) * 100) / 100;
}

export const ajusteValido = (a) => (a === AJUSTE.CONTER ? AJUSTE.CONTER : AJUSTE.COBRIR);

/** Uma personagem nova entra de pé no chão, ao centro. */
export function novaPersonagem({ id, nome = "", img = "", x = 0.5 } = {}) {
  return {
    id,
    nome: nome.trim(),
    img,
    x: fracaoValida(x),
    y: 0.97,                 // os pés quase no fundo do ecrã
    escala: ESCALA.padrao,
    espelhado: false
  };
}

/**
 * Quem está à frente de quem.
 *
 * Quanto mais abaixo no ecrã, mais perto da câmara — como numa fotografia. Por
 * isso desenha-se de trás para a frente, por `y` crescente, e quem tem foco vai
 * sempre para a frente de todos.
 */
export function ordenarElenco(elenco = []) {
  return [...elenco].sort((a, b) => {
    if (!!a.foco !== !!b.foco) return a.foco ? 1 : -1;
    return (a.y ?? 0) - (b.y ?? 0);
  });
}

/**
 * Onde e de que tamanho é que a personagem se desenha.
 *
 * A âncora é nos PÉS (`translate(-50%, -100%)`): assim uma personagem grande e
 * uma pequena ficam as duas assentes no mesmo chão, em vez de flutuarem a
 * alturas diferentes.
 */
export function estiloDaPersonagem(p, { haFoco = false } = {}) {
  const foco = !!p.foco;
  const escala = escalaValida(p.escala);
  return {
    left: `${fracaoValida(p.x) * 100}%`,
    top: `${fracaoValida(p.y, 0.97) * 100}%`,
    altura: `${(foco ? escala * 1.04 : escala) * 100}vh`,
    transform: `translate(-50%, -100%)${p.espelhado ? " scaleX(-1)" : ""}`,
    opacidade: haFoco && !foco ? 0.55 : 1,
    filtro: haFoco && !foco ? "saturate(0.7) brightness(0.72)" : "none"
  };
}

export const haFocoNoElenco = (elenco = []) => elenco.some(p => p.foco);

/** Clicar em quem já tem o foco tira o foco: a cena volta a ser de todos. */
export function alternarFoco(elenco = [], id) {
  const jaTinha = elenco.find(p => p.id === id)?.foco;
  return elenco.map(p => ({ ...p, foco: !jaTinha && p.id === id }));
}

/** Um palco sem fundo nem elenco não tem nada para mostrar. */
export const palcoVazio = (palco) => !palco?.fundo && !(palco?.elenco ?? []).length;

/**
 * Quem vê o palco.
 *
 * A mesa vê quando o mestre o põe no ar. O mestre vê também enquanto está a
 * compor (com o painel aberto) — senão estaria a montar uma cena às cegas —,
 * e nesse caso a interface diz-lhe que é só uma pré-visualização.
 */
export function podeVer(palco, { isGM = false, aCompor = false } = {}) {
  if (palcoVazio(palco)) return false;
  return !!palco.visivel || (isGM && aCompor);
}

/** Nome legível a partir do caminho do ficheiro, para quando não há actor. */
export function nomeDoFicheiro(caminho = "") {
  const base = decodeURIComponent(String(caminho).split("?")[0].split("/").pop() ?? "");
  return base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

// ------------------------------------------------------------------ biblioteca

/**
 * O retrato de um palco, para comparar dois.
 *
 * O `foco` fica de fora de propósito: dar o foco a quem está a falar é uma coisa
 * do momento, não uma alteração da cena. Sem isto, o painel diria «alterada»
 * sempre que o mestre trocasse de interlocutor.
 */
export function instantaneo(p) {
  return JSON.stringify({
    fundo: p?.fundo ?? "",
    ajuste: ajusteValido(p?.ajuste),
    deriva: !!p?.deriva,
    elenco: (p?.elenco ?? []).map(({ foco, ...resto }) => resto)
  });
}

export const igualAoGuardado = (palco, guardada) => !!guardada && instantaneo(palco) === instantaneo(guardada);

/** O que um cartão da biblioteca mostra. */
export function resumoDaCena(cena) {
  return {
    id: cena?.id,
    nome: (cena?.nome ?? "").trim() || "Sem nome",
    fundo: cena?.fundo ?? "",
    quantos: (cena?.elenco ?? []).length
  };
}

/** Procura por nome — e também pelo nome de quem está em cena. */
export function filtrarCenas(cenas = [], termo = "") {
  const t = termo.trim().toLowerCase();
  if (!t) return [...cenas];
  return cenas.filter(c =>
    (c.nome ?? "").toLowerCase().includes(t) ||
    (c.elenco ?? []).some(p => (p.nome ?? "").toLowerCase().includes(t)));
}

/** Um nome que não se repete: «Casa de Mero», «Casa de Mero 2»… */
export function nomeLivre(cenas = [], desejado = "Cena") {
  const base = desejado.trim() || "Cena";
  const usados = new Set(cenas.map(c => (c.nome ?? "").trim()));
  if (!usados.has(base)) return base;
  for (let i = 2; i < 999; i++) if (!usados.has(`${base} ${i}`)) return `${base} ${i}`;
  return `${base} ${Date.now()}`;
}

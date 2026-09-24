import { AJUSTE, ESCALA, AURAS } from "./const.js";

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

// ------------------------------------------------------------------ auras

export const auraValida = (a) => (Object.hasOwn(AURAS, a) ? a : "");

/**
 * A aura que se vê: a de quem tem o foco, se tiver uma; senão a da cena.
 * É isto que faz a borda ficar roxa sozinha quando alguém de Tupã começa a falar.
 */
export function auraEfetiva(palco) {
  const comFoco = (palco?.elenco ?? []).find(p => p.foco);
  return auraValida(comFoco?.aura) || auraValida(palco?.aura);
}

/** O botão de aura de cada personagem roda: nenhuma → Kuaã → Tupã → Manõ → Graça → nenhuma. */
export function proximaAura(atual) {
  const ordem = ["", ...Object.keys(AURAS)];
  return ordem[(ordem.indexOf(auraValida(atual)) + 1) % ordem.length];
}

// ------------------------------------------------------------------ roda do rato

/**
 * A roda muda o tamanho **em proporção** ao que rodou.
 *
 * Na 0.2 cada evento valia ±3% fixos. Um rato manda um evento por clique, mas um
 * trackpad manda dezenas por gesto — no Mac a personagem saltava de pequena para
 * enorme num deslizar de dedos. Agora um clique de rato (~100 px) muda ~11% e um
 * passo de trackpad (~3 px) quase nada: o gesto sente-se contínuo.
 */
export function escalaPorRoda(atual, deltaY, deltaMode = 0) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const base = Number.isFinite(Number(atual)) ? Number(atual) : ESCALA.padrao;
  // SEM arredondar: durante o gesto somam-se passos de 0,2%; arredondar cada um a
  // duas casas deitava-os todos fora e o trackpad não mexia nada. Arredonda-se ao gravar.
  return entre(base * Math.exp(-px * 0.0012), ESCALA.min, ESCALA.max);
}

// ------------------------------------------------------------------ chão

/**
 * Os pés encostam ao chão de quem já está em cena.
 *
 * Duas pessoas numa sala estão no mesmo chão; a olho, ficavam sempre um ou dois
 * por cento desencontradas e parecia que uma flutuava. Perto o bastante (1,5% do
 * ecrã), encosta — e o palco mostra a linha a que encostou.
 */
export function pousarNoChao(y, outrosY = [], tolerancia = 0.015) {
  let melhor = null;
  for (const o of outrosY) {
    const d = Math.abs(o - y);
    if (d <= tolerancia && (melhor === null || d < Math.abs(melhor - y))) melhor = o;
  }
  return melhor === null ? { y, guia: null } : { y: melhor, guia: melhor };
}

/** Arrastar alguém para baixo da borda do ecrã tira-o de cena. */
export const zonaDeSaida = (y) => y > 1.04;

// ------------------------------------------------------------------ fundo

export const ZOOM_FUNDO = { min: 1, max: 3 };

/** Onde o fundo está apontado (0–1) e quanto está aproximado. */
export function enquadramentoValido(e) {
  return {
    x: fracaoValida(e?.x, 0.5),
    y: fracaoValida(e?.y, 0.5),
    zoom: Math.round(entre(Number(e?.zoom) || 1, ZOOM_FUNDO.min, ZOOM_FUNDO.max) * 1000) / 1000
  };
}

/** O tamanho da imagem a encher o ecrã (object-fit: cover). */
export function tamanhoCoberto(nw, nh, { W, H }) {
  const s = Math.max(W / nw, H / nh);
  return { w: nw * s, h: nh * s };
}

/**
 * Arrastar o fundo: a imagem anda o que o rato andou.
 *
 * O ponto de enquadramento é ao mesmo tempo o `object-position` (que parte da
 * imagem o «encher» mostra) e a origem do zoom. O que se pode deslocar é o que
 * sobra da imagem já aproximada para lá do ecrã — por isso nunca aparecem barras.
 */
export function arrastarFundo(e, dx, dy, { nw, nh, W, H }) {
  const atual = enquadramentoValido(e);
  const { w, h } = tamanhoCoberto(nw, nh, { W, H });
  const sobraX = w * atual.zoom - W;
  const sobraY = h * atual.zoom - H;
  return enquadramentoValido({
    ...atual,
    x: sobraX > 0.5 ? atual.x - dx / sobraX : atual.x,
    y: sobraY > 0.5 ? atual.y - dy / sobraY : atual.y
  });
}

/** A roda no fundo aproxima para o ponto de enquadramento. Nunca menos que encher. */
export function aproximarFundo(e, deltaY, deltaMode = 0) {
  const atual = enquadramentoValido(e);
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return enquadramentoValido({ ...atual, zoom: atual.zoom * Math.exp(-px * 0.0012) });
}

export function estiloDoFundo(e) {
  const { x, y, zoom } = enquadramentoValido(e);
  const pos = `${Math.round(x * 1000) / 10}% ${Math.round(y * 1000) / 10}%`;
  return { objectPosition: pos, transformOrigin: pos, escala: zoom };
}

/**
 * A imagem serve para encher o ecrã?
 *
 * Referência: um ecrã 16:9. `nivel` pela largura (2560 ou mais é ótima; 1920 serve;
 * menos fica esborratada num ecrã grande). `corte` é quanto da imagem se perde a
 * encher um 16:9 — uma imagem quadrada perde quase metade.
 */
export function avaliarFundo(nw, nh) {
  const r = nw / nh, alvo = 16 / 9;
  const corte = Math.round((1 - Math.min(r / alvo, alvo / r)) * 1000) / 1000;
  // a largura que conta é a que fica no ecrã depois de cortar para 16:9
  const util = r >= alvo ? nh * alvo : nw;
  const nivel = util >= 2560 ? "otima" : util >= 1900 ? "boa" : "pequena";
  return { nivel, corte, largura: nw, altura: nh };
}

/** Uma personagem nova entra de pé no chão, ao centro. */
export function novaPersonagem({ id, nome = "", img = "", x = 0.5, y = 0.97 } = {}) {
  return {
    id,
    nome: nome.trim(),
    img,
    x: fracaoValida(x),
    y: fracaoValida(y, 0.97),   // por omissão, os pés quase no fundo do ecrã
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
    // espelha-se a IMAGEM, não a figura: a figura leva o nome, e virá-la punha
    // o nome a ler-se ao contrário
    transform: "translate(-50%, -100%)",
    espelho: p.espelhado ? "scaleX(-1)" : "none",
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
    enquadramento: enquadramentoValido(p?.enquadramento),
    aura: auraValida(p?.aura),
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

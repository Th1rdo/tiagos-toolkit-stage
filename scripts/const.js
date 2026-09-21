/** Identidade do módulo e constantes partilhadas. */
export const MODULE_ID = "tiagos-toolkit-stage";

/** O palco vive numa flag da cena: cada cena tem o seu. */
export const FLAG = "palco";

/** Como o fundo preenche o ecrã. */
export const AJUSTE = {
  COBRIR: "cobrir",     // enche o ecrã, corta o que sobra — é o que dá imersão
  CONTER: "conter"      // mostra a imagem inteira, com barras se preciso
};

/**
 * A escala de uma personagem é uma fração da ALTURA do ecrã, não pixéis.
 *
 * Cada um na mesa tem um ecrã diferente; em pixéis, o que fica bem no portátil
 * do mestre fica minúsculo no monitor de 27". Em fração da altura, a composição
 * aguenta-se em todos.
 */
export const ESCALA = { min: 0.15, max: 1.1, passo: 0.01, padrao: 0.62 };

/** Tempos, em ms. Um palco entra devagar — é o oposto de um salto de combate. */
export const TEMPO = {
  FUNDO: 700,        // o fundo a aparecer
  ELENCO: 320,       // cada personagem a entrar
  ESCADA: 70,        // atraso entre personagens
  FOCO: 220,         // passar o foco de uma para outra
  SAIDA: 420
};

export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
export const warn = (...args) => console.warn(`${MODULE_ID} |`, ...args);

/**
 * Onde a camada é pendurada: dentro de `#interface`, o palco fica por cima do
 * mapa e por baixo dos painéis do Foundry — a mesa continua a poder falar no
 * chat e a abrir fichas. Se esse elemento estiver transformado (escala de
 * interface), `position: fixed` deixaria de ser relativo à janela: vamos ao `body`.
 */
export function paiUI() {
  const alvo = document.getElementById("interface");
  if (!alvo) return document.body;
  const t = getComputedStyle(alvo).transform;
  return (!t || t === "none") ? alvo : document.body;
}

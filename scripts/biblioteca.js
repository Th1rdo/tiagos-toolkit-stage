import { MODULE_ID } from "./const.js";
import { palco, cenaAtual } from "./dados.js";
import { instantaneo, igualAoGuardado, nomeLivre, nomeDoFicheiro } from "./logica.js";

/**
 * A biblioteca de cenas guardadas.
 *
 * Vive numa definição de **mundo**, não na cena: uma cena preparada — a casa do
 * Mero com duas pessoas lá dentro — serve em qualquer mapa e em qualquer sessão.
 * O palco da cena do Foundry é uma **cópia** do que está guardado: mexer nos
 * atores depois de carregar nunca estraga o original, e é por isso que dá para
 * carregar a mesma cena duas vezes na mesma noite sem medo.
 */

const AJUSTE_FLAG = "origem";   // que cena guardada deu origem ao palco atual

export const cenas = () => game.settings.get(MODULE_ID, "biblioteca")?.cenas ?? [];
export const cena = (id) => cenas().find(c => c.id === id) ?? null;

async function gravar(lista) {
  await game.settings.set(MODULE_ID, "biblioteca", { cenas: lista });
}

/** De onde veio o palco que está montado (se veio de algum lado). */
export const origemAtual = () => cenaAtual()?.getFlag(MODULE_ID, AJUSTE_FLAG) ?? null;

const marcarOrigem = (id) => cenaAtual()?.setFlag(MODULE_ID, AJUSTE_FLAG, id ?? null);

/** O palco montado é igual à cena de onde veio? (o `foco` não conta) */
export function semAlteracoes() {
  const id = origemAtual();
  return id ? igualAoGuardado(palco(), cena(id)) : false;
}

// ------------------------------------------------------------------ guardar

/** Guarda o palco que está montado como uma cena nova. */
export async function guardarComo(nome) {
  if (!game.user.isGM) return null;
  const p = palco();
  const nova = {
    id: foundry.utils.randomID(),
    nome: nomeLivre(cenas(), nome || nomeDoFicheiro(p.fundo) || game.i18n.localize("STAGE.CenaNova")),
    fundo: p.fundo,
    ajuste: p.ajuste,
    deriva: p.deriva,
    enquadramento: p.enquadramento,
    elenco: (p.elenco ?? []).map(({ foco, ...resto }) => resto),
    criado: Date.now(),
    atualizado: Date.now()
  };
  await gravar([...cenas(), nova]);
  await marcarOrigem(nova.id);
  return nova;
}

/** Atualiza a cena guardada com o que está no palco agora. */
export async function atualizarGuardada(id = origemAtual()) {
  if (!id || !game.user.isGM) return null;
  const p = palco();
  await gravar(cenas().map(c => (c.id === id ? {
    ...c,
    fundo: p.fundo,
    ajuste: p.ajuste,
    deriva: p.deriva,
    enquadramento: p.enquadramento,
    elenco: (p.elenco ?? []).map(({ foco, ...resto }) => resto),
    atualizado: Date.now()
  } : c)));
  return cena(id);
}

export const renomear = (id, nome) =>
  gravar(cenas().map(c => (c.id === id ? { ...c, nome: (nome ?? "").trim() || c.nome } : c)));

export const apagar = async (id) => {
  await gravar(cenas().filter(c => c.id !== id));
  if (origemAtual() === id) await marcarOrigem(null);
};

export async function duplicar(id) {
  const c = cena(id);
  if (!c) return null;
  const copia = { ...c, id: foundry.utils.randomID(), nome: nomeLivre(cenas(), c.nome), criado: Date.now() };
  await gravar([...cenas(), copia]);
  return copia;
}

// ------------------------------------------------------------------ carregar

/**
 * Põe uma cena guardada no palco da cena atual.
 *
 * Copia, não referencia: a partir daqui o mestre arrasta, espelha e acrescenta
 * à vontade, e a cena guardada fica como estava até ele mandar atualizá-la.
 */
export async function carregar(id, { noAr = false } = {}) {
  const c = cena(id);
  const cenaFoundry = cenaAtual();
  if (!c || !cenaFoundry || !game.user.isGM) return null;

  await cenaFoundry.setFlag(MODULE_ID, "palco", {
    fundo: c.fundo,
    ajuste: c.ajuste,
    deriva: c.deriva,
    enquadramento: c.enquadramento ?? { x: 0.5, y: 0.5, zoom: 1 },
    visivel: noAr,
    elenco: (c.elenco ?? []).map(p => ({ ...p, foco: false }))
  });
  await marcarOrigem(c.id);
  return c;
}

export { instantaneo };

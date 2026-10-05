import { MODULE_ID } from "./const.js";
import { eImagem } from "./logica.js";

/**
 * A pasta de personagens (0.5).
 *
 * Depois da primeira sessão o Tiago pediu: *«definir uma pasta em vez de abrir uma
 * folder view»*. Pôr alguém em cena era abrir o navegador de ficheiros, procurar a
 * pasta, escolher — com a mesa à espera. Agora escolhe-se a pasta uma vez e o painel
 * mostra os retratos; um clique põe em cena.
 *
 * Lê-se a pasta pelo navegador de ficheiros do próprio Foundry (no Forge, o dele, que
 * entende os endereços da Assets Library) e guarda-se o resultado durante a sessão.
 */

const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
const fonte = (pasta) =>
  (globalThis.ForgeVTT?.usingTheForge || /forge-vtt\.com/.test(pasta) ? "forgevtt" : "data");

export const pastas = () => game.settings.get(MODULE_ID, "pastasPersonagens") ?? [];

let cache = null;            // { chave, imagens }
let aLer = null;

/** As imagens das pastas escolhidas. `forcar` relê (ex.: o mestre acrescentou ficheiros). */
export async function imagens({ forcar = false } = {}) {
  const lista = pastas();
  const chave = JSON.stringify(lista);
  if (!forcar && cache?.chave === chave) return cache.imagens;
  if (aLer?.chave === chave && !forcar) return aLer.promessa;
  const promessa = (async () => {
    const todas = [];
    for (const pasta of lista) {
      try {
        const r = await FP().browse(fonte(pasta), pasta);
        todas.push(...(r.files ?? []).filter(eImagem));
      } catch (e) {
        console.warn(`${MODULE_ID} | não consegui ler a pasta`, pasta, e);
      }
    }
    cache = { chave, imagens: [...new Set(todas)] };
    aLer = null;
    return cache.imagens;
  })();
  aLer = { chave, promessa };
  return promessa;
}

/** Escolher a pasta com o navegador de pastas do Foundry. */
export function escolherPasta(atual = "") {
  return new Promise((resolve) => {
    const F = FP();
    const fp = new F({ type: "folder", current: atual, callback: (c) => resolve(c) });
    const fechar = fp.close.bind(fp);
    fp.close = async (...a) => { setTimeout(() => resolve(null), 0); return fechar(...a); };
    fp.render(true);
  });
}

export async function definirPasta(pasta) {
  if (!pasta) return;
  await game.settings.set(MODULE_ID, "pastasPersonagens", [pasta]);
  cache = null;
}

/** As imagens de uma pasta qualquer (a importação de fundos usa o mesmo caminho). */
export async function imagensDe(pasta) {
  const r = await FP().browse(fonte(pasta), pasta);
  return (r.files ?? []).filter(eImagem);
}

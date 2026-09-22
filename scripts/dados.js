import { MODULE_ID, FLAG, AJUSTE } from "./const.js";
import { novaPersonagem, fracaoValida, escalaValida, ajusteValido, alternarFoco } from "./logica.js";

/**
 * O palco vive numa flag da **cena**.
 *
 * Cada cena tem o seu palco: mudar de cena muda de sítio, e voltar traz o
 * cenário e o elenco como estavam. O Foundry sincroniza flags sozinho, portanto
 * o que o mestre monta aparece na mesa toda sem passar por sockets — e quem
 * chega a meio da sessão recebe o palco montado.
 *
 * Só o mestre escreve.
 */

export const cenaAtual = () => canvas?.scene ?? game.scenes?.current ?? null;

const VAZIO = { fundo: "", ajuste: AJUSTE.COBRIR, deriva: true, visivel: false, elenco: [] };

export function palco(cena = cenaAtual()) {
  const guardado = cena?.getFlag(MODULE_ID, FLAG);
  return { ...VAZIO, ...(guardado ?? {}), elenco: guardado?.elenco ?? [] };
}

function souMestre() {
  if (game.user.isGM) return true;
  ui.notifications.warn(game.i18n.localize("STAGE.Avisos.SoMestre"));
  return false;
}

/** Toda a escrita relê o palco antes de gravar: dois cliques não se atropelam. */
async function gravar(transformar, cena = cenaAtual()) {
  if (!cena || !souMestre()) return null;
  const novo = transformar(palco(cena));
  await cena.setFlag(MODULE_ID, FLAG, novo);
  return novo;
}

// ------------------------------------------------------------------ cenário

export const definirFundo = (fundo) => gravar(p => ({ ...p, fundo: fundo ?? "" }));
export const definirAjuste = (ajuste) => gravar(p => ({ ...p, ajuste: ajusteValido(ajuste) }));
export const definirDeriva = (deriva) => gravar(p => ({ ...p, deriva: !!deriva }));

/**
 * O interruptor que importa: é isto que leva a cena à mesa.
 *
 * O palco vive na cena que o mestre está a VER, e os jogadores estão na cena
 * ATIVA. Quase sempre são a mesma — quando não são, pôr no ar não chega a
 * ninguém, e o mestre ficava a olhar para um palco que só ele vê.
 */
function avisarSeOutraCena(ligar) {
  const aqui = cenaAtual();
  const la = game.scenes?.active;
  if (!ligar || !aqui || !la || aqui.id === la.id) return;
  ui.notifications.warn(game.i18n.format("STAGE.Avisos.OutraCena", { aqui: aqui.name, la: la.name }));
}

export async function mostrar(visivel) {
  avisarSeOutraCena(!!visivel);
  return gravar(p => ({ ...p, visivel: !!visivel }));
}

export async function alternarVisivel() {
  const ligar = !palco().visivel;
  avisarSeOutraCena(ligar);
  return gravar(p => ({ ...p, visivel: ligar }));
}

/** Limpar deixa a cena pronta para outra coisa, sem apagar a cena do Foundry. */
export const limparPalco = () => gravar(() => ({ ...VAZIO }));

// ------------------------------------------------------------------ elenco

export async function adicionarPersonagem({ nome, img, x } = {}) {
  if (!img) return null;
  let nova = null;
  await gravar(p => {
    nova = novaPersonagem({ id: foundry.utils.randomID(), nome, img, x: x ?? posicaoLivre(p.elenco) });
    return { ...p, elenco: [...p.elenco, nova] };
  });
  return nova;
}

/**
 * Onde cai a próxima personagem.
 *
 * Duas pessoas a conversar é o caso normal, por isso a primeira vai a um terço
 * e a segunda a dois terços — já ficam frente a frente sem ninguém arrastar
 * nada. A partir daí espalham-se pelo meio.
 */
export function posicaoLivre(elenco = []) {
  const ocupadas = elenco.map(p => p.x ?? 0.5);
  for (const alvo of [0.33, 0.67, 0.5, 0.18, 0.82]) {
    if (!ocupadas.some(x => Math.abs(x - alvo) < 0.08)) return alvo;
  }
  return 0.5;
}

const mexer = (id, mudar) =>
  gravar(p => ({ ...p, elenco: p.elenco.map(x => (x.id === id ? mudar(x) : x)) }));

export const moverPersonagem = (id, x, y) =>
  mexer(id, p => ({ ...p, x: fracaoValida(x), y: fracaoValida(y, 0.97) }));

export const escalarPersonagem = (id, escala) => mexer(id, p => ({ ...p, escala: escalaValida(escala) }));
export const espelharPersonagem = (id) => mexer(id, p => ({ ...p, espelhado: !p.espelhado }));
export const renomearPersonagem = (id, nome) => mexer(id, p => ({ ...p, nome: String(nome ?? "").trim() }));
export const trocarArte = (id, img) => mexer(id, p => ({ ...p, img: img || p.img }));

export const focarPersonagem = (id) => gravar(p => ({ ...p, elenco: alternarFoco(p.elenco, id) }));
export const removerPersonagem = (id) => gravar(p => ({ ...p, elenco: p.elenco.filter(x => x.id !== id) }));

// ------------------------------------------------------------------ avisos

/** Avisa quem precisa (o palco, o painel) de que a cena mudou. */
export function aoMudar(callback) {
  Hooks.on("updateScene", (cena, mudou) => {
    if (cena.id !== cenaAtual()?.id) return;
    if (!foundry.utils.hasProperty(mudou, `flags.${MODULE_ID}`)) return;
    callback();
  });
}

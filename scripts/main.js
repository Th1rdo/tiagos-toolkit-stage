import { MODULE_ID, log } from "./const.js";
import { palco, adicionarPersonagem, aoMudar, alternarVisivel, cenaAtual } from "./dados.js";
import { palcoEmCena } from "./palco.js";
import { controlo } from "./controlo.js";
import { nomeDoFicheiro } from "./logica.js";
import { Biblioteca } from "./janela.js";

/**
 * Montagem do módulo. O estado vive nas flags da cena; aqui só se ligam os fios.
 */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "biblioteca", {
    scope: "world", config: false, type: Object, default: { cenas: [] },
    onChange: () => Biblioteca.atualizarSeAberta()
  });

  game.settings.register(MODULE_ID, "escurecerInterface", {
    name: "STAGE.Config.Escurecer", hint: "STAGE.Config.EscurecerHint",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: (v) => document.body.classList.toggle("stage-sem-escurecer", !v)
  });

  game.settings.register(MODULE_ID, "aliviarCanvas", {
    name: "STAGE.Config.Aliviar", hint: "STAGE.Config.AliviarHint",
    scope: "client", config: true, type: Boolean, default: true
  });

  game.keybindings.register(MODULE_ID, "palco", {
    name: "STAGE.Atalho.Painel",
    editable: [{ key: "KeyE", modifiers: ["Control", "Shift"] }],
    restricted: true,
    onDown: () => { controlo.alternar(); return true; }
  });

  game.keybindings.register(MODULE_ID, "biblioteca", {
    name: "STAGE.Atalho.Biblioteca",
    editable: [{ key: "KeyB", modifiers: ["Control", "Shift"] }],
    restricted: true,
    onDown: () => { Biblioteca.alternar(); return true; }
  });

  game.keybindings.register(MODULE_ID, "ar", {
    name: "STAGE.Atalho.Ar",
    editable: [{ key: "KeyR", modifiers: ["Control", "Shift"] }],
    restricted: true,
    onDown: () => { alternarVisivel(); return true; }
  });
});

/** Um botão no grupo dos tokens, onde o mestre já tem a mão. */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM || Array.isArray(controls)) return;
  const grupo = controls.tokens ?? Object.values(controls)[0];
  if (!grupo?.tools) return;

  grupo.tools.stageBiblioteca = {
    name: "stageBiblioteca",
    order: Object.keys(grupo.tools).length + 2,
    title: "STAGE.Biblioteca.Titulo",
    icon: "fa-solid fa-photo-film",
    button: true,
    visible: true,
    onChange: () => Biblioteca.alternar()
  };

  grupo.tools.stagePalco = {
    name: "stagePalco",
    order: Object.keys(grupo.tools).length + 1,
    title: "STAGE.Ferramentas.Palco",
    icon: "fa-solid fa-masks-theater",
    toggle: true,
    active: controlo.aberto,
    visible: true,
    onChange: (_ev, ativo) => (ativo ? controlo.abrir() : controlo.fechar())
  };
});

/**
 * Com o palco no ar, o mapa por baixo não se vê — mas o PIXI continua a desenhá-lo
 * a 60 fps. Baixar o ritmo devolve GPU à mesa; nunca se PARA o ticker, para que
 * uma falha na volta deixe o canvas lento em vez de congelado.
 */
let canvasGuardado = null;

function aliviarCanvas(ligar) {
  const app = canvas?.app;
  if (!app?.ticker || !game.settings.get(MODULE_ID, "aliviarCanvas")) return;
  if (ligar) {
    if (canvasGuardado !== null) return;
    canvasGuardado = app.ticker.maxFPS ?? 0;
    app.ticker.maxFPS = 5;
  } else {
    if (canvasGuardado === null) return;
    app.ticker.maxFPS = canvasGuardado;
    canvasGuardado = null;
  }
}

function redesenhar() {
  palcoEmCena.desenhar();
  if (controlo.aberto) controlo.desenhar();
  aliviarCanvas(!!palco().visivel);
}

/**
 * Largar um ator do lado direito em cima do palco põe-no em cena com a arte
 * dele. É o caminho mais curto entre «estas duas estão a falar» e vê-las ali.
 */
async function aoLargar(ev) {
  if (!game.user.isGM) return;
  ev.preventDefault();
  let dados = null;
  try { dados = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
  if (!dados?.uuid) return;

  const doc = await fromUuid(dados.uuid).catch(() => null);
  const img = doc?.img ?? doc?.texture?.src ?? doc?.prototypeToken?.texture?.src ?? doc?.actor?.img;
  if (!img) return ui.notifications.warn(game.i18n.localize("STAGE.Avisos.SemArte"));

  await adicionarPersonagem({
    img,
    nome: doc.name ?? nomeDoFicheiro(img),
    x: ev.clientX / globalThis.innerWidth
  });
}

Hooks.once("ready", () => {
  palcoEmCena.montar();
  controlo.montar();
  document.body.classList.toggle("stage-sem-escurecer", !game.settings.get(MODULE_ID, "escurecerInterface"));

  const raiz = document.getElementById("stage-palco");
  raiz.addEventListener("dragover", (ev) => { if (game.user.isGM) ev.preventDefault(); });
  raiz.addEventListener("drop", aoLargar);

  Hooks.on(`${MODULE_ID}.biblioteca`, () => Biblioteca.alternar());
  Hooks.on(`${MODULE_ID}.biblioteca-mudou`, () => Biblioteca.atualizarSeAberta());

  aoMudar(() => { redesenhar(); Biblioteca.atualizarSeAberta(); });
  redesenhar();

  /** API pública, para macros. */
  game.palco = {
    mostrar: () => alternarVisivel(),
    painel: () => controlo.alternar(),
    estado: () => palco(),
    biblioteca: () => Biblioteca.alternar(),
    cena: () => cenaAtual()
  };

  log("pronto");
});

Hooks.on("canvasReady", () => redesenhar());

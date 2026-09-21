import { MODULE_ID } from "./const.js";
import { palco } from "./dados.js";
import * as bib from "./biblioteca.js";
import { filtrarCenas, resumoDaCena, igualAoGuardado } from "./logica.js";
import { palcoEmCena } from "./palco.js";
import { controlo } from "./controlo.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * A biblioteca de cenas.
 *
 * Cartões com a imagem de fundo, porque é assim que o mestre se lembra de uma
 * cena — pela imagem, não pelo nome. Um clique no cartão põe a cena no ar; o
 * lápis carrega-a só para compor. A cena montada é sempre uma cópia, por isso
 * mexer nela depois nunca estraga o que está guardado.
 */
export class Biblioteca extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "stage-biblioteca",
    tag: "div",
    window: { title: "STAGE.Biblioteca.Titulo", icon: "fa-solid fa-masks-theater", resizable: true },
    position: { width: 640, height: 560 },
    classes: ["stage-janela"],
    actions: {
      tocar: Biblioteca.#tocar,
      carregar: Biblioteca.#carregar,
      guardar: Biblioteca.#guardar,
      atualizar: Biblioteca.#atualizar,
      renomear: Biblioteca.#renomear,
      duplicar: Biblioteca.#duplicar,
      apagar: Biblioteca.#apagar
    }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/biblioteca.hbs`, scrollable: [".stage-grelha"] } };

  static #instancia = null;
  #procura = "";

  static abrir() {
    Biblioteca.#instancia ??= new Biblioteca();
    Biblioteca.#instancia.render({ force: true });
    return Biblioteca.#instancia;
  }

  static alternar() {
    const j = Biblioteca.#instancia;
    if (j?.rendered) return j.close();
    return Biblioteca.abrir();
  }

  static atualizarSeAberta() {
    if (Biblioteca.#instancia?.rendered) Biblioteca.#instancia.render();
  }

  async _prepareContext() {
    const todas = bib.cenas();
    const origem = bib.origemAtual();
    const guardada = origem ? bib.cena(origem) : null;

    return {
      procura: this.#procura,
      quantas: todas.length,
      montado: guardada ? {
        nome: guardada.nome,
        alterado: !igualAoGuardado(palco(), guardada)
      } : null,
      cenas: filtrarCenas(todas, this.#procura).map(c => ({ ...resumoDaCena(c), esta: c.id === origem }))
    };
  }

  _onRender() {
    const campo = this.element.querySelector('[data-campo="procura"]');
    campo?.addEventListener("input", (ev) => {
      this.#procura = ev.target.value;
      this.render();
    });
    if (this.#procura) {
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    }
  }

  // ---------------------------------------------------------------- ações

  static async #tocar(_ev, alvo) {
    await bib.carregar(alvo.dataset.id, { noAr: true });
    palcoEmCena.desenhar();
    Biblioteca.atualizarSeAberta();
  }

  static async #carregar(_ev, alvo) {
    await bib.carregar(alvo.dataset.id, { noAr: false });
    controlo.abrir();                  // carregar para compor abre o painel e a pré-visualização
    Biblioteca.atualizarSeAberta();
  }

  static async #guardar() {
    const nome = await Biblioteca.#pedirNome(game.i18n.localize("STAGE.Biblioteca.Guardar"), "");
    if (nome === null) return;
    await bib.guardarComo(nome);
    Biblioteca.atualizarSeAberta();
  }

  static async #atualizar() {
    await bib.atualizarGuardada();
    Biblioteca.atualizarSeAberta();
  }

  static async #renomear(_ev, alvo) {
    const atual = bib.cena(alvo.dataset.id);
    const nome = await Biblioteca.#pedirNome(game.i18n.localize("STAGE.Biblioteca.Renomear"), atual?.nome ?? "");
    if (nome === null) return;
    await bib.renomear(alvo.dataset.id, nome);
    Biblioteca.atualizarSeAberta();
  }

  static async #duplicar(_ev, alvo) {
    await bib.duplicar(alvo.dataset.id);
    Biblioteca.atualizarSeAberta();
  }

  static async #apagar(_ev, alvo) {
    const c = bib.cena(alvo.dataset.id);
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize("STAGE.Biblioteca.Apagar") },
      content: `<p>${game.i18n.format("STAGE.Avisos.ConfirmarApagar", { nome: c?.nome ?? "" })}</p>`
    });
    if (!ok) return;
    await bib.apagar(alvo.dataset.id);
    Biblioteca.atualizarSeAberta();
  }

  /** Um nome, numa caixa. Devolve null se o mestre desistir. */
  static async #pedirNome(titulo, valor) {
    const resposta = await DialogV2.prompt({
      window: { title: titulo },
      content: `<input type="text" name="nome" value="${foundry.utils.escapeHTML(valor)}" autofocus spellcheck="false" style="width:100%">`,
      ok: {
        label: game.i18n.localize("STAGE.Biblioteca.Confirmar"),
        callback: (_e, botao, dialogo) => (botao.form ?? dialogo.element.querySelector("form"))?.elements.nome.value ?? ""
      },
      rejectClose: false
    });
    return resposta ?? null;
  }
}

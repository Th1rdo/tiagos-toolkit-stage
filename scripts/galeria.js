import { MODULE_ID } from "./const.js";
import { palco } from "./dados.js";
import { filtrarCenas, resumoDaCena, agruparPorLocal } from "./logica.js";
import * as bib from "./biblioteca.js";
import { escolherPasta, imagensDe } from "./retratos.js";

const { ApplicationV2 } = foundry.applications.api;
const CHAVE_FILTRO = `${MODULE_ID}.galeria`;

/**
 * A galeria de cenas (0.5).
 *
 * O Tiago, depois da primeira sessão: *«a view de todas as cenas ser maior»*, com uma
 * galeria dele como referência — fundos grandes, por baixo o nome do ficheiro em letra
 * técnica e a etiqueta DAY/NIGHT, e uma frase a dizer o que é o sítio. É assim que ele
 * escolhe uma cena: pela imagem e pelo sítio, não por uma lista de nomes.
 *
 * Clicar num cartão põe a cena no palco (no ar, a mesa vê a troca) e fecha a galeria.
 * Dia/Noite no próprio cartão escolhe a hora antes de a pôr.
 */
export class Galeria extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "stage-galeria",
    tag: "div",
    classes: ["stage-galeria-janela"],
    window: { title: "STAGE.Galeria.Titulo", icon: "fa-solid fa-images", resizable: true },
    position: { width: 1180, height: 820 }
  };

  static #instancia = null;
  /**
   * O tamanho calcula-se ao abrir, não ao carregar o módulo: no teste local a janela do
   * browser estava a 0×0 quando o módulo carregou e a galeria nasceu com largura negativa.
   */
  static abrir() {
    const g = (Galeria.#instancia ??= new Galeria());
    const vw = globalThis.innerWidth || 1280, vh = globalThis.innerHeight || 900;
    const width = Math.max(640, Math.min(1280, vw - 80)), height = Math.max(480, Math.min(880, vh - 80));
    return g.render({ force: true, position: g.rendered ? undefined : { width, height, left: (vw - width) / 2, top: (vh - height) / 2 } });
  }
  static redesenhar() {
    const g = Galeria.#instancia;
    if (g && g.state > ApplicationV2.RENDER_STATES.NONE) g.render();
  }

  #procura = "";
  #hora = (() => { try { return localStorage.getItem(CHAVE_FILTRO) ?? ""; } catch { return ""; } })();
  #aImportar = false;

  async _renderHTML() {
    const esc = foundry.utils.escapeHTML;
    const t = (k) => game.i18n.localize(k);
    const p = palco();
    const origem = bib.origemAtual();
    const todas = bib.cenas();
    const lista = filtrarCenas(todas, this.#procura, this.#hora).map(resumoDaCena);
    const filtro = (h, k) => `<button type="button" class="stage-filtro ${this.#hora === h ? "stage-ativo" : ""}" data-accao="filtro" data-hora="${h}">${t(k)}</button>`;

    const cartao = (c) => `
      <article class="stage-galeria-cartao ${c.id === origem ? "stage-esta" : ""}" data-accao="escolher" data-id="${c.id}">
        <div class="stage-galeria-imagem">
          ${c.fundo ? `<img src="${esc(c.fundo)}" alt="" loading="lazy" draggable="false">` : `<span class="stage-sem-imagem"></span>`}
          ${c.id === origem && p.visivel ? `<span class="stage-selo-ar">${t("STAGE.NoAr")}</span>` : ""}
          ${c.horasDisponiveis.length > 1 ? `<span class="stage-galeria-horas">${c.horasDisponiveis.map(h =>
            `<button type="button" class="stage-hora-chip ${c.hora === h ? "stage-ativo" : ""}" data-accao="escolher-hora" data-id="${c.id}" data-hora="${h}">${t(`STAGE.Hora.${h}`)}</button>`).join("")}</span>` : ""}
          ${c.quantos ? `<span class="stage-cartao-quantos">${c.quantos}</span>` : ""}
        </div>
        <div class="stage-galeria-tecnico">${esc(c.ficheiro || c.nome)}${c.etiqueta ? ` <span class="stage-galeria-etiqueta">· ${c.etiqueta}</span>` : ""}</div>
        <div class="stage-galeria-descricao ${c.descricao ? "" : "stage-sem-descricao"}" data-accao="descrever" data-id="${c.id}"
             title="${t("STAGE.Galeria.EditarDescricao")}">${esc(c.descricao || c.nome)}</div>
      </article>`;

    const el = document.createElement("section");
    el.className = "stage-galeria";
    el.innerHTML = `
      <header class="stage-galeria-topo">
        <input type="search" class="stage-procura" data-campo="procura" value="${esc(this.#procura)}"
               placeholder="${t("STAGE.Biblioteca.Procurar")}" spellcheck="false" autocomplete="off">
        <div class="stage-filtros">${filtro("", "STAGE.Galeria.Todas")}${filtro("dia", "STAGE.Hora.dia")}${filtro("noite", "STAGE.Hora.noite")}</div>
        <span class="stage-espaco"></span>
        <button type="button" class="stage-botao-texto" data-accao="importar" ${this.#aImportar ? "disabled" : ""}>
          ${t(this.#aImportar ? "STAGE.Galeria.AImportar" : "STAGE.Galeria.Importar")}</button>
        <button type="button" class="stage-botao-texto" data-accao="nova">+ ${t("STAGE.Acoes.NovaCena")}</button>
      </header>
      <div class="stage-galeria-grelha">
        ${lista.length ? lista.map(cartao).join("") : `<p class="stage-dica stage-galeria-vazia">${t(todas.length ? "STAGE.Galeria.NadaEncontrado" : "STAGE.Galeria.Vazia")}</p>`}
      </div>`;
    return el;
  }

  _replaceHTML(resultado, conteudo) {
    const rolagem = conteudo.querySelector(".stage-galeria-grelha")?.scrollTop ?? 0;
    const focado = document.activeElement?.dataset?.campo === "procura";
    conteudo.replaceChildren(resultado);
    const grelha = conteudo.querySelector(".stage-galeria-grelha");
    if (grelha) grelha.scrollTop = rolagem;
    if (focado) {
      const p = conteudo.querySelector("[data-campo=procura]");
      p?.focus(); p?.setSelectionRange(p.value.length, p.value.length);
    }
  }

  _onRender(ctx, opts) {
    super._onRender?.(ctx, opts);
    const raiz = this.element.querySelector(".stage-galeria");
    raiz.addEventListener("click", (ev) => this.#clique(ev));
    raiz.querySelector("[data-campo=procura]")?.addEventListener("input", foundry.utils.debounce((ev) => {
      this.#procura = ev.target.value; this.render();
    }, 150));
  }

  async #clique(ev) {
    const alvo = ev.target.closest("[data-accao]");
    if (!alvo) return;
    ev.preventDefault();
    ev.stopPropagation();
    const { id, hora } = alvo.dataset;
    switch (alvo.dataset.accao) {
      case "filtro":
        this.#hora = hora;
        try { localStorage.setItem(CHAVE_FILTRO, hora); } catch { /* sem memória */ }
        return this.render();
      case "escolher":
        await bib.carregar(id);
        return this.close();
      case "escolher-hora":
        await bib.carregar(id, { hora });
        return this.close();
      case "descrever": {
        const c = bib.cena(id);
        const texto = await pedirTexto(game.i18n.localize("STAGE.Galeria.EditarDescricao"), c?.descricao ?? "");
        if (texto !== null) await bib.descrever(id, texto);
        return;
      }
      case "nova":
        await bib.nova();
        return this.close();
      case "importar": return this.#importar();
    }
  }

  /** Importar uma pasta de fundos: uma cena por sítio, o dia e a noite juntos. */
  async #importar() {
    const pasta = await escolherPasta();
    if (!pasta) return;
    this.#aImportar = true; this.render();
    try {
      const novas = await bib.importar(agruparPorLocal(await imagensDe(pasta)));
      ui.notifications.info(game.i18n.format("STAGE.Galeria.Importadas", { n: novas.length }));
    } catch (e) {
      ui.notifications.error(game.i18n.format("STAGE.Galeria.ImportarFalhou", { erro: e.message }));
    } finally {
      this.#aImportar = false; this.render();
    }
  }
}

async function pedirTexto(titulo, atual) {
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: titulo, icon: "fa-solid fa-pen" },
    content: `<textarea name="texto" rows="3" style="width:100%">${foundry.utils.escapeHTML(atual)}</textarea>`,
    ok: { label: "STAGE.Galeria.Guardar", callback: (_ev, b) => b.form.elements.texto.value }
  }).catch(() => null);
  return r === null || r === undefined ? null : String(r);
}

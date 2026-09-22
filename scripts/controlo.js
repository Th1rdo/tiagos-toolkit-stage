import { MODULE_ID, AJUSTE, paiUI } from "./const.js";
import {
  palco, definirFundo, definirAjuste, definirDeriva, alternarVisivel,
  adicionarPersonagem, removerPersonagem, renomearPersonagem, espelharPersonagem,
  focarPersonagem, limparPalco
} from "./dados.js";
import { palcoEmCena } from "./palco.js";
import { nomeDoFicheiro, igualAoGuardado } from "./logica.js";
import * as bib from "./biblioteca.js";

/**
 * O painel do mestre.
 *
 * Fica numa janelinha que se arrasta para onde não estorva (e lembra-se de
 * onde ficou): a mesa de cada um tem os painéis do Foundry em sítios
 * diferentes, e adivinhar um canto livre é como perder.
 *
 * Abrir o painel liga a pré-visualização — o mestre vê o palco mesmo antes de o
 * pôr no ar. O botão grande em baixo é o único que a mesa sente.
 */

const CHAVE_POS = `${MODULE_ID}.painel`;

function escolherImagem(atual, aoEscolher) {
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  new FP({ type: "image", current: atual || "", callback: aoEscolher }).render(true);
}

class Controlo {
  #el = null;
  #aberto = false;

  montar() {
    if (this.#el) return;
    const el = document.createElement("div");
    el.id = "stage-painel";
    el.hidden = true;
    paiUI().appendChild(el);
    this.#el = el;

    el.addEventListener("click", (ev) => this.#clique(ev));
    el.addEventListener("change", (ev) => this.#mudou(ev));
    el.addEventListener("input", (ev) => this.#escreveu(ev));

    const pos = this.#posicaoGuardada();
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    Hooks.on(`${MODULE_ID}.desenhou`, () => { if (this.#aberto) this.desenhar(); });
  }

  get aberto() { return this.#aberto; }

  alternar() { this.#aberto ? this.fechar() : this.abrir(); }

  abrir() {
    if (!game.user.isGM) return;
    this.#aberto = true;
    this.#el.hidden = false;
    palcoEmCena.compor(true);       // compor às cegas não é compor
    this.desenhar();
  }

  fechar() {
    this.#aberto = false;
    if (this.#el) this.#el.hidden = true;
    palcoEmCena.compor(false);
  }

  /**
   * Redesenha sem estorvar: se o mestre está a escrever o nome de alguém, esse
   * campo volta com o cursor no mesmo sítio. Sem isto, cada gravação trazia um
   * painel novo e o cursor desaparecia a meio da palavra.
   */
  desenhar() {
    const focado = document.activeElement?.closest?.("#stage-painel") ? document.activeElement : null;
    const marca = focado ? { campo: focado.dataset.campo, id: focado.dataset.id, valor: focado.value, pos: focado.selectionStart } : null;
    this.#desenharConteudo();
    if (!marca?.campo) return;
    const seletor = marca.id ? `[data-campo="${marca.campo}"][data-id="${marca.id}"]` : `[data-campo="${marca.campo}"]`;
    const campo = this.#el.querySelector(seletor);
    if (!campo) return;
    if (campo.type === "text") campo.value = marca.valor;   // o que ainda não foi gravado não se perde
    campo.focus();
    if (marca.pos != null && campo.setSelectionRange) campo.setSelectionRange(marca.pos, marca.pos);
  }

  #desenharConteudo() {
    const p = palco();
    const esc = foundry.utils.escapeHTML;
    const origem = bib.origemAtual();
    const guardada = origem ? bib.cena(origem) : null;
    const alterada = guardada ? !igualAoGuardado(p, guardada) : false;

    this.#el.innerHTML = `
      <header class="stage-cabecalho" data-accao="pegar">
        <span class="stage-titulo">${game.i18n.localize("STAGE.Palco")}</span>
        ${guardada ? `<span class="stage-origem" title="${game.i18n.localize("STAGE.Biblioteca.NoPalco")}">
          ${esc(guardada.nome)}${alterada ? `<span class="stage-pinta" title="${game.i18n.localize("STAGE.Biblioteca.Alterada")}"></span>` : ""}
        </span>` : ""}
        <button type="button" class="stage-icone" data-accao="fechar" aria-label="${game.i18n.localize("STAGE.Acoes.Fechar")}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12"></path></svg>
        </button>
      </header>

      <section class="stage-seccao">
        <div class="stage-rotulo">${game.i18n.localize("STAGE.Fundo")}</div>
        <div class="stage-linha">
          <button type="button" class="stage-miniatura" data-accao="fundo" aria-label="${game.i18n.localize("STAGE.Acoes.EscolherFundo")}">
            ${p.fundo ? `<img src="${esc(p.fundo)}" alt="">` : `<span class="stage-vazio">+</span>`}
          </button>
          <div class="stage-coluna">
            <div class="stage-nome-ficheiro">${p.fundo ? esc(nomeDoFicheiro(p.fundo)) : game.i18n.localize("STAGE.SemFundo")}</div>
            <div class="stage-opcoes">
              <label><input type="radio" name="ajuste" value="${AJUSTE.COBRIR}" ${p.ajuste !== AJUSTE.CONTER ? "checked" : ""}> ${game.i18n.localize("STAGE.Cobrir")}</label>
              <label><input type="radio" name="ajuste" value="${AJUSTE.CONTER}" ${p.ajuste === AJUSTE.CONTER ? "checked" : ""}> ${game.i18n.localize("STAGE.Conter")}</label>
              <label><input type="checkbox" data-campo="deriva" ${p.deriva ? "checked" : ""}> ${game.i18n.localize("STAGE.Deriva")}</label>
            </div>
          </div>
        </div>
      </section>

      <section class="stage-seccao">
        <div class="stage-rotulo">${game.i18n.localize("STAGE.Elenco")}</div>
        ${p.elenco.length ? p.elenco.map(x => `
          <div class="stage-linha stage-membro ${x.foco ? "stage-com-foco" : ""}" data-id="${x.id}">
            <button type="button" class="stage-miniatura stage-pequena" data-accao="foco" data-id="${x.id}"
                    title="${game.i18n.localize("STAGE.Acoes.Foco")}">
              <img src="${esc(x.img)}" alt="">
            </button>
            <input type="text" data-campo="nome" data-id="${x.id}" value="${esc(x.nome ?? "")}"
                   placeholder="${game.i18n.localize("STAGE.NomePersonagem")}">
            <button type="button" class="stage-icone" data-accao="espelhar" data-id="${x.id}" title="${game.i18n.localize("STAGE.Acoes.Espelhar")}">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L8 14 M4 5 L2 8 L4 11 Z M12 5 L14 8 L12 11 Z"></path></svg>
            </button>
            <button type="button" class="stage-icone" data-accao="remover" data-id="${x.id}" title="${game.i18n.localize("STAGE.Acoes.Remover")}">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12"></path></svg>
            </button>
          </div>`).join("") : `<div class="stage-dica">${game.i18n.localize("STAGE.ElencoVazio")}</div>`}
        <button type="button" class="stage-adicionar" data-accao="personagem">+ ${game.i18n.localize("STAGE.Personagem")}</button>
      </section>

      <footer class="stage-rodape">
        <button type="button" class="stage-ar ${p.visivel ? "stage-ligado" : ""}" data-accao="ar">
          ${game.i18n.localize(p.visivel ? "STAGE.Acoes.Tirar" : "STAGE.Acoes.Mostrar")}
        </button>
      </footer>

      <div class="stage-barra-guardar">
        <button type="button" class="stage-ligacao" data-accao="biblioteca">${game.i18n.localize("STAGE.Biblioteca.Titulo")}</button>
        <button type="button" class="stage-ligacao" data-accao="guardar-cena">
          ${game.i18n.localize(alterada ? "STAGE.Biblioteca.Atualizar" : "STAGE.Biblioteca.Guardar")}
        </button>
        <button type="button" class="stage-ligacao stage-limpar" data-accao="limpar">${game.i18n.localize("STAGE.Acoes.Limpar")}</button>
      </div>`;

    this.#el.hidden = false;
  }

  // ---------------------------------------------------------------- eventos

  async #clique(ev) {
    const botao = ev.target.closest("[data-accao]");
    if (!botao) return;
    const id = botao.dataset.id;

    switch (botao.dataset.accao) {
      case "fechar": return this.fechar();
      case "pegar": return this.#pegar(ev);
      case "fundo": return escolherImagem(palco().fundo, (caminho) => definirFundo(caminho));
      case "personagem": return escolherImagem("", (caminho) =>
        adicionarPersonagem({ img: caminho, nome: nomeDoFicheiro(caminho) }));
      case "foco": return focarPersonagem(id);
      case "espelhar": return espelharPersonagem(id);
      case "remover": return removerPersonagem(id);
      case "ar": return alternarVisivel();
      case "biblioteca": return Hooks.callAll(`${MODULE_ID}.biblioteca`);
      case "guardar-cena": {
        // se veio da biblioteca e foi mexida, guardar é atualizar; senão, é nova
        const origem = bib.origemAtual();
        const guardada = origem ? bib.cena(origem) : null;
        if (guardada && !igualAoGuardado(palco(), guardada)) {
          await bib.atualizarGuardada();
        } else {
          await bib.guardarComo("");
        }
        Hooks.callAll(`${MODULE_ID}.biblioteca-mudou`);
        return this.desenhar();
      }
      case "limpar": {
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("STAGE.Acoes.Limpar") },
          content: `<p>${game.i18n.localize("STAGE.Avisos.ConfirmarLimpar")}</p>`
        });
        if (ok) return limparPalco();
        return;
      }
    }
  }

  #mudou(ev) {
    if (ev.target.name === "ajuste") return definirAjuste(ev.target.value);
    if (ev.target.dataset.campo === "deriva") return definirDeriva(ev.target.checked);
  }

  #temporizador = null;
  #escreveu(ev) {
    if (ev.target.dataset.campo !== "nome") return;
    const { id } = ev.target.dataset;
    const valor = ev.target.value;
    clearTimeout(this.#temporizador);
    this.#temporizador = setTimeout(() => renomearPersonagem(id, valor), 400);
  }

  /** Arrastar o painel pela barra do título; o sítio fica guardado neste cliente. */
  #pegar(ev) {
    if (ev.target.closest("[data-accao=fechar]")) return;
    const caixa = this.#el.getBoundingClientRect();
    const desvio = { x: ev.clientX - caixa.left, y: ev.clientY - caixa.top };

    const mover = (e) => {
      const x = Math.max(8, Math.min(e.clientX - desvio.x, globalThis.innerWidth - caixa.width - 8));
      const y = Math.max(8, Math.min(e.clientY - desvio.y, globalThis.innerHeight - caixa.height - 8));
      this.#el.style.left = `${x}px`;
      this.#el.style.top = `${y}px`;
    };
    const largar = () => {
      globalThis.removeEventListener("pointermove", mover);
      globalThis.removeEventListener("pointerup", largar);
      try {
        localStorage.setItem(CHAVE_POS, JSON.stringify({ x: parseInt(this.#el.style.left), y: parseInt(this.#el.style.top) }));
      } catch { /* modo privado: fica onde está só nesta sessão */ }
    };
    globalThis.addEventListener("pointermove", mover);
    globalThis.addEventListener("pointerup", largar);
  }

  #posicaoGuardada() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CHAVE_POS) ?? "null");
      if (guardado && Number.isFinite(guardado.x)) return guardado;
    } catch { /* sem memória: canto de sempre */ }
    return { x: 24, y: Math.max(80, globalThis.innerHeight - 520) };
  }
}

export const controlo = new Controlo();

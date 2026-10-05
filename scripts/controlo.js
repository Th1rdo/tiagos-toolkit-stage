import { MODULE_ID, AJUSTE, AURAS, paiUI } from "./const.js";
import {
  palco, definirFundo, definirAjuste, definirDeriva, alternarVisivel, definirEnquadramento,
  definirAura, definirAuraPersonagem, adicionarPersonagem, removerPersonagem, renomearPersonagem,
  espelharPersonagem, focarPersonagem, definirHora, definirDescricao
} from "./dados.js";
import { palcoEmCena } from "./palco.js";
import { nomeDoFicheiro, avaliarFundo, filtrarCenas, resumoDaCena, auraValida, proximaAura, palcoVazio, HORAS, procurarRetratos } from "./logica.js";
import * as bib from "./biblioteca.js";
import { Galeria } from "./galeria.js";
import * as retratos from "./retratos.js";

/**
 * O painel do palco — a única janela do módulo (0.4).
 *
 * Até à 0.3 eram duas: este painel para compor e uma janela de biblioteca com
 * «Tocar», «Compor», «Guardar» e «Atualizar». O Tiago achava as duas coisas
 * confusas, e tinha razão. Agora:
 *
 *   em cima   — as cenas guardadas, em cartões. Clicar num cartão põe essa cena no
 *               palco (se o palco está no ar, a mesa vê a troca). O «+» abre uma nova.
 *   no meio   — a cena que está no palco: nome, fundo, aura, elenco. Tudo o que se
 *               mexe grava-se sozinho na cena guardada.
 *   em baixo  — o único botão que a mesa sente: mostrar / tirar do ar.
 *
 * Fica numa janelinha que se arrasta para onde não estorva e se lembra de onde
 * ficou. Abrir o painel liga a pré-visualização — o mestre vê o palco mesmo antes
 * de o pôr no ar.
 */

const CHAVE_POS = `${MODULE_ID}.painel`;

function escolherImagem(atual, aoEscolher) {
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  new FP({ type: "image", current: atual || "", callback: aoEscolher }).render(true);
}

/** Medidas das imagens de fundo já vistas: o painel diz se servem para encher o ecrã. */
const medidas = new Map();

class Controlo {
  #el = null;
  #aberto = false;
  #procura = "";
  #procuraRetratos = "";
  #retratos = null;          // imagens da pasta de personagens (lidas uma vez por sessão)
  #temporizador = null;

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
    el.addEventListener("pointerdown", (ev) => { if (ev.target.closest("[data-accao=pegar]")) this.#pegar(ev); });
    // arrastar um retrato da pasta para o palco põe-no onde se larga (o palco já aceita imagens)
    el.addEventListener("dragstart", (ev) => {
      const r = ev.target.closest("[data-retrato]");
      if (!r) return;
      ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Tile", texture: { src: r.dataset.retrato } }));
    });

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
    ui.controls?.render?.();
  }

  fechar() {
    this.#aberto = false;
    if (this.#el) this.#el.hidden = true;
    palcoEmCena.compor(false);
    ui.controls?.render?.();
  }

  /**
   * Redesenha sem estorvar: se o mestre está a escrever (o nome de alguém, o nome
   * da cena, a procura), esse campo volta com o cursor no mesmo sítio.
   */
  desenhar() {
    if (!this.#el || !this.#aberto) return;
    const focado = document.activeElement?.closest?.("#stage-painel") ? document.activeElement : null;
    const marca = focado ? { campo: focado.dataset.campo, id: focado.dataset.id, valor: focado.value, pos: focado.selectionStart } : null;
    const faixa = this.#el.querySelector(".stage-faixa");
    const rolagem = faixa?.scrollLeft ?? 0;
    const rolagemCorpo = this.#el.querySelector(".stage-corpo")?.scrollTop ?? 0;
    this.#desenharConteudo();
    const novaFaixa = this.#el.querySelector(".stage-faixa");
    if (novaFaixa) novaFaixa.scrollLeft = rolagem;
    const corpo = this.#el.querySelector(".stage-corpo");
    if (corpo) corpo.scrollTop = rolagemCorpo;
    this.#caberNoEcra();
    if (!marca?.campo) return;
    const seletor = marca.id ? `[data-campo="${marca.campo}"][data-id="${marca.id}"]` : `[data-campo="${marca.campo}"]`;
    const campo = this.#el.querySelector(seletor);
    if (!campo) return;
    if (campo.type === "text" || campo.type === "search") campo.value = marca.valor;   // o que ainda não foi gravado não se perde
    campo.focus();
    if (marca.pos != null && campo.setSelectionRange) campo.setSelectionRange(marca.pos, marca.pos);
  }

  /**
   * O painel cresceu na 0.4 (cenas + aura) e, no sítio de sempre, o botão de pôr
   * no ar ficava abaixo do fundo do ecrã. Agora o painel nunca passa da janela:
   * o meio rola, o rodapé fica sempre à vista, e se estiver fora de sítio volta.
   */
  #caberNoEcra() {
    const caixa = this.#el.getBoundingClientRect();
    const maxTop = Math.max(8, globalThis.innerHeight - caixa.height - 8);
    const maxLeft = Math.max(8, globalThis.innerWidth - caixa.width - 8);
    if (caixa.top > maxTop) this.#el.style.top = `${maxTop}px`;
    if (caixa.left > maxLeft) this.#el.style.left = `${maxLeft}px`;
  }

  /**
   * «Esta imagem serve?» — a linha por baixo do nome do fundo: o tamanho, se é
   * ótima/serve/pequena, e quanto corta a encher um ecrã 16:9.
   */
  #qualidade(src) {
    if (!src) return "";
    const m = medidas.get(src);
    if (!m) {
      const img = new Image();
      img.onload = () => { medidas.set(src, { w: img.naturalWidth, h: img.naturalHeight }); this.desenhar(); };
      img.src = src;
      return "";
    }
    const a = avaliarFundo(m.w, m.h);
    const partes = [`${m.w} × ${m.h}`, game.i18n.localize(`STAGE.Qualidade.${a.nivel}`)];
    if (a.corte >= 0.12) partes.push(game.i18n.format("STAGE.Qualidade.Corta", { pct: Math.round(a.corte * 100) }));
    return `<div class="stage-qualidade" data-nivel="${a.nivel}">${partes.join(" · ")}</div>`;
  }

  #desenharConteudo() {
    const p = palco();
    const esc = foundry.utils.escapeHTML;
    const t = (k) => game.i18n.localize(k);
    const origem = bib.origemAtual();
    const guardada = origem ? bib.cena(origem) : null;
    const todas = bib.cenas();
    const lista = filtrarCenas(todas, this.#procura).map(resumoDaCena);
    const ha = !!guardada || !palcoVazio(p);
    const aura = auraValida(p.aura);
    const enquadrado = p.enquadramento.x !== 0.5 || p.enquadramento.y !== 0.5 || p.enquadramento.zoom !== 1;

    const cartao = (c) => {
      const esta = c.id === origem;
      return `
        <div class="stage-cartao-cena ${esta ? "stage-esta" : ""}" data-accao="escolher" data-id="${c.id}" title="${esc(c.nome)}">
          <div class="stage-cartao-imagem">
            ${c.fundo ? `<img src="${esc(c.fundo)}" alt="" draggable="false">` : `<span class="stage-sem-imagem"></span>`}
            ${esta && p.visivel ? `<span class="stage-selo-ar">${t("STAGE.NoAr")}</span>` : ""}
            ${c.quantos ? `<span class="stage-cartao-quantos">${c.quantos}</span>` : ""}
            <span class="stage-cartao-accoes">
              <button type="button" class="stage-icone" data-accao="duplicar" data-id="${c.id}" title="${t("STAGE.Biblioteca.Duplicar")}">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5 L13 5 L13 13 L5 13 Z M3 11 L3 3 L11 3"></path></svg>
              </button>
              <button type="button" class="stage-icone" data-accao="apagar" data-id="${c.id}" title="${t("STAGE.Biblioteca.Apagar")}">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12"></path></svg>
              </button>
            </span>
          </div>
          <div class="stage-cartao-nome">${esc(c.nome)}</div>
        </div>`;
    };

    const chip = (chave) => {
      const nome = chave ? AURAS[chave].nome : t("STAGE.Aura.Nenhuma");
      return `<button type="button" class="stage-chip-aura ${aura === chave ? "stage-ativo" : ""}" data-accao="aura" data-aura="${chave}"
        style="--stage-aura-cor: ${chave ? AURAS[chave].cor : "transparent"}" aria-pressed="${aura === chave}">
        <span class="stage-ponto-aura" data-aura="${chave}"></span>${nome}</button>`;
    };

    this.#el.innerHTML = `
      <header class="stage-cabecalho" data-accao="pegar">
        <span class="stage-titulo">${t("STAGE.Palco")}</span>
        <button type="button" class="stage-icone" data-accao="fechar" aria-label="${t("STAGE.Acoes.Fechar")}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12"></path></svg>
        </button>
      </header>

      <div class="stage-corpo">
      <section class="stage-seccao stage-seccao-cenas">
        <div class="stage-linha-rotulo">
          <span class="stage-rotulo">${t("STAGE.Cenas")}</span>
          <button type="button" class="stage-ligacao stage-ver-todas" data-accao="galeria">${t("STAGE.Galeria.VerTodas")}</button>
          ${todas.length > 6 ? `<input type="search" class="stage-procura" data-campo="procura" value="${esc(this.#procura)}"
             placeholder="${t("STAGE.Biblioteca.Procurar")}" spellcheck="false" autocomplete="off">` : ""}
        </div>
        <div class="stage-faixa">
          <div class="stage-cartao-cena stage-cartao-nova" data-accao="nova" title="${t("STAGE.Acoes.NovaCena")}">
            <div class="stage-cartao-imagem"><span class="stage-mais">+</span></div>
            <div class="stage-cartao-nome">${t("STAGE.Acoes.NovaCena")}</div>
          </div>
          ${lista.map(cartao).join("")}
        </div>
      </section>

      ${ha ? `
      <section class="stage-seccao">
        <input type="text" class="stage-nome-cena" data-campo="nome-cena" value="${esc(guardada?.nome ?? "")}"
               placeholder="${t("STAGE.NomeCena")}" ${guardada ? "" : "disabled"}>
        <textarea class="stage-descricao" data-campo="descricao" rows="2" placeholder="${t("STAGE.Descricao")}">${esc(p.descricao ?? "")}</textarea>
        <div class="stage-linha">
          <button type="button" class="stage-miniatura" data-accao="fundo" aria-label="${t("STAGE.Acoes.EscolherFundo")}">
            ${p.fundo ? `<img src="${esc(p.fundo)}" alt="">` : `<span class="stage-vazio">+</span>`}
          </button>
          <div class="stage-coluna">
            <div class="stage-nome-ficheiro">${p.fundo ? esc(nomeDoFicheiro(p.fundo)) : t("STAGE.SemFundo")}</div>
            <div class="stage-opcoes">
              <label><input type="radio" name="ajuste" value="${AJUSTE.COBRIR}" ${p.ajuste !== AJUSTE.CONTER ? "checked" : ""}> ${t("STAGE.Cobrir")}</label>
              <label><input type="radio" name="ajuste" value="${AJUSTE.CONTER}" ${p.ajuste === AJUSTE.CONTER ? "checked" : ""}> ${t("STAGE.Conter")}</label>
              <label><input type="checkbox" data-campo="deriva" ${p.deriva ? "checked" : ""}> ${t("STAGE.Deriva")}</label>
            </div>
            ${p.fundo ? `<div class="stage-horas" role="group">${HORAS.map(h => `
              <button type="button" class="stage-hora ${p.hora === h ? "stage-ativo" : ""} ${p.horas?.[h] ? "" : "stage-sem-imagem-hora"}"
                      data-accao="hora" data-hora="${h}" title="${t(p.horas?.[h] ? `STAGE.Hora.${h}` : "STAGE.Hora.Acrescentar")}">
                ${h === "dia" ? "☀" : "☾"} ${t(`STAGE.Hora.${h}`)}</button>`).join("")}</div>` : ""}
            ${this.#qualidade(p.fundo)}
            ${p.fundo && p.ajuste !== AJUSTE.CONTER && enquadrado
              ? `<button type="button" class="stage-ligacao" data-accao="repor-enquadramento">${t("STAGE.Acoes.ReporEnquadramento")}</button>` : ""}
          </div>
        </div>
        ${p.fundo && p.ajuste !== AJUSTE.CONTER ? `<div class="stage-dica">${t("STAGE.Gestos.Fundo")}</div>` : ""}
      </section>

      <section class="stage-seccao">
        <div class="stage-rotulo">${t("STAGE.Aura.Titulo")}</div>
        <div class="stage-auras-escolha">${["", ...Object.keys(AURAS)].map(chip).join("")}</div>
        <div class="stage-dica">${t("STAGE.Aura.Dica")}</div>
      </section>

      <section class="stage-seccao">
        <div class="stage-rotulo">${t("STAGE.Elenco")}</div>
        ${p.elenco.length ? p.elenco.map(x => {
          const a = auraValida(x.aura);
          return `
          <div class="stage-linha stage-membro ${x.foco ? "stage-com-foco" : ""}" data-id="${x.id}">
            <button type="button" class="stage-miniatura stage-pequena" data-accao="foco" data-id="${x.id}" title="${t("STAGE.Acoes.Foco")}">
              <img src="${esc(x.img)}" alt="">
            </button>
            <input type="text" data-campo="nome" data-id="${x.id}" value="${esc(x.nome ?? "")}" placeholder="${t("STAGE.NomePersonagem")}">
            <button type="button" class="stage-icone stage-aura-personagem" data-accao="aura-personagem" data-id="${x.id}"
                    title="${t("STAGE.Aura.DaPersonagem")}: ${a ? AURAS[a].nome : t("STAGE.Aura.Nenhuma")}">
              <span class="stage-ponto-aura" data-aura="${a}"></span>
            </button>
            <button type="button" class="stage-icone" data-accao="espelhar" data-id="${x.id}" title="${t("STAGE.Acoes.Espelhar")}">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L8 14 M4 5 L2 8 L4 11 Z M12 5 L14 8 L12 11 Z"></path></svg>
            </button>
            <button type="button" class="stage-icone" data-accao="remover" data-id="${x.id}" title="${t("STAGE.Acoes.Remover")}">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12"></path></svg>
            </button>
          </div>`;
        }).join("") : `<div class="stage-dica">${t("STAGE.ElencoVazio")}</div>`}
        ${p.elenco.length ? `<div class="stage-dica">${t("STAGE.Gestos.Personagem")}</div>` : ""}
        ${this.#htmlRetratos(esc, t)}
        <button type="button" class="stage-adicionar" data-accao="personagem">+ ${t("STAGE.Personagem")}</button>
      </section>` : `
      <section class="stage-seccao">
        <div class="stage-dica">${t("STAGE.Vazio")}</div>
      </section>`}

      </div>

      <footer class="stage-rodape">
        <button type="button" class="stage-ar ${p.visivel ? "stage-ligado" : ""}" data-accao="ar" ${ha ? "" : "disabled"}>
          ${t(p.visivel ? "STAGE.Acoes.Tirar" : "STAGE.Acoes.Mostrar")}
        </button>
        ${ha ? `<div class="stage-estado-gravacao">${t(guardada ? "STAGE.Gravado" : "STAGE.GravaAoMexer")}</div>` : ""}
      </footer>`;
  }

  /** A pasta de personagens: uma grelha de retratos; clicar põe em cena, arrastar põe onde se larga. */
  #htmlRetratos(esc, t) {
    const pastas = retratos.pastas();
    if (!pastas.length) {
      return `<button type="button" class="stage-ligacao" data-accao="pasta-personagens">${t("STAGE.Retratos.Escolher")}</button>`;
    }
    if (this.#retratos === null) {
      retratos.imagens().then(l => { this.#retratos = l; this.desenhar(); });
      this.#retratos = undefined;          // a ler: não pedir outra vez a cada desenho
    }
    const lista = procurarRetratos(this.#retratos ?? [], this.#procuraRetratos);
    const pasta = nomeDoFicheiro(pastas[0].replace(/\/+$/, "")) || pastas[0];
    return `
      <div class="stage-retratos-cabecalho">
        <span class="stage-rotulo" title="${esc(pastas[0])}">${t("STAGE.Retratos.Titulo")} · ${esc(pasta)}</span>
        <button type="button" class="stage-icone" data-accao="pasta-personagens" title="${t("STAGE.Retratos.Mudar")}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5 L6 5 L7 6 L14 6 L14 13 L2 13 Z"></path></svg></button>
        <button type="button" class="stage-icone" data-accao="reler-retratos" title="${t("STAGE.Retratos.Reler")}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8 A5 5 0 1 1 11 4 M11 1 L11 4 L14 4"></path></svg></button>
      </div>
      ${(this.#retratos?.length ?? 0) > 12 ? `<input type="search" class="stage-procura stage-procura-retratos" data-campo="procura-retratos"
          value="${esc(this.#procuraRetratos)}" placeholder="${t("STAGE.Retratos.Procurar")}" spellcheck="false" autocomplete="off">` : ""}
      <div class="stage-retratos">
        ${this.#retratos === undefined ? `<span class="stage-dica">${t("STAGE.Retratos.ALer")}</span>`
          : lista.length ? lista.map(r => `
          <button type="button" class="stage-retrato" draggable="true" data-accao="por-retrato" data-retrato="${esc(r.img)}" title="${esc(r.nome)}">
            <img src="${esc(r.img)}" alt="" loading="lazy" draggable="false"></button>`).join("")
          : `<span class="stage-dica">${t("STAGE.Retratos.Vazia")}</span>`}
      </div>`;
  }

  // ---------------------------------------------------------------- eventos

  async #clique(ev) {
    const botao = ev.target.closest("[data-accao]");
    if (!botao) return;
    const { id } = botao.dataset;

    switch (botao.dataset.accao) {
      case "fechar": return this.fechar();
      case "nova": return bib.nova();
      case "escolher": return bib.carregar(id);
      case "duplicar": {
        ev.stopPropagation();
        const copia = await bib.duplicar(id);
        if (copia) await bib.carregar(copia.id);
        return;
      }
      case "apagar": {
        ev.stopPropagation();
        const c = bib.cena(id);
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("STAGE.Biblioteca.Apagar") },
          content: `<p>${game.i18n.format("STAGE.Avisos.ConfirmarApagar", { nome: foundry.utils.escapeHTML(c?.nome ?? "") })}</p>`
        });
        if (ok) await bib.apagar(id);
        return this.desenhar();
      }
      case "fundo": return escolherImagem(palco().fundo, (caminho) => definirFundo(caminho));
      case "repor-enquadramento": return definirEnquadramento(null);
      case "aura": return definirAura(botao.dataset.aura);
      case "aura-personagem": {
        const x = palco().elenco.find(p => p.id === id);
        return definirAuraPersonagem(id, proximaAura(x?.aura));
      }
      case "personagem": return escolherImagem("", (caminho) =>
        adicionarPersonagem({ img: caminho, nome: nomeDoFicheiro(caminho) }));
      case "foco": return focarPersonagem(id);
      case "espelhar": return espelharPersonagem(id);
      case "remover": return removerPersonagem(id);
      case "ar": return alternarVisivel();
      case "galeria": return Galeria.abrir();
      case "hora": {
        const h = botao.dataset.hora;
        if (palco().horas?.[h]) return definirHora(h);
        // essa hora ainda não tem imagem: escolhe-se agora, e o fundo atual fica a ser a outra
        return escolherImagem("", (caminho) => definirHora(h, caminho));
      }
      case "pasta-personagens": {
        const pasta = await retratos.escolherPasta(retratos.pastas()[0] ?? "");
        if (pasta) { await retratos.definirPasta(pasta); this.#retratos = null; this.desenhar(); }
        return;
      }
      case "reler-retratos":
        this.#retratos = undefined; this.desenhar();
        this.#retratos = await retratos.imagens({ forcar: true });
        return this.desenhar();
      case "por-retrato": {
        const img = botao.dataset.retrato;
        return adicionarPersonagem({ img, nome: nomeDoFicheiro(img) });
      }
    }
  }

  #mudou(ev) {
    if (ev.target.name === "ajuste") return definirAjuste(ev.target.value);
    if (ev.target.dataset.campo === "deriva") return definirDeriva(ev.target.checked);
  }

  #escreveu(ev) {
    const { campo, id } = ev.target.dataset;
    const valor = ev.target.value;
    if (campo === "procura") { this.#procura = valor; return this.desenhar(); }
    if (campo === "procura-retratos") { this.#procuraRetratos = valor; return this.desenhar(); }
    if (campo === "descricao") {
      clearTimeout(this.#temporizador);
      this.#temporizador = setTimeout(() => definirDescricao(valor), 500);
      return;
    }
    if (campo !== "nome" && campo !== "nome-cena") return;
    clearTimeout(this.#temporizador);
    this.#temporizador = setTimeout(() => {
      if (campo === "nome") return renomearPersonagem(id, valor);
      const origem = bib.origemAtual();
      if (origem) bib.renomear(origem, valor).then(() => this.desenhar());
    }, 400);
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
    return { x: 24, y: Math.max(80, globalThis.innerHeight - 640) };
  }
}

export const controlo = new Controlo();

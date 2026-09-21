import { MODULE_ID, TEMPO, ESCALA, paiUI, log } from "./const.js";
import { palco, moverPersonagem, escalarPersonagem, espelharPersonagem, focarPersonagem } from "./dados.js";
import { podeVer, ordenarElenco, estiloDaPersonagem, haFocoNoElenco, escalaValida } from "./logica.js";

/**
 * O palco.
 *
 * Uma folha por cima do mapa: o fundo enche o ecrã, as personagens ficam de pé
 * em cima dele. Para o jogador não há nada para clicar — é uma imagem, e é esse
 * o ponto. Para o mestre, tudo se compõe em direto: arrastar move, a roda do
 * rato muda o tamanho, clicar dá o foco, o botão direito espelha.
 *
 * O mapa continua a existir por baixo; o palco só o tapa. Nada de mudar de cena
 * do Foundry para uma conversa de dois minutos.
 */
class Palco {
  #raiz = null;
  #fundo = null;
  #elenco = null;
  #marca = null;
  #aCompor = false;
  #arrasto = null;
  #estadoAnterior = "";
  #timerEscala = null;

  montar() {
    if (this.#raiz) return;
    const raiz = document.createElement("div");
    raiz.id = "stage-palco";
    raiz.hidden = true;
    raiz.innerHTML = `
      <div class="stage-fundo"><img class="stage-fundo-img" alt="" draggable="false"></div>
      <div class="stage-elenco"></div>
      <div class="stage-marca" hidden></div>`;
    paiUI().appendChild(raiz);
    this.#raiz = raiz;
    this.#fundo = raiz.querySelector(".stage-fundo");
    this.#elenco = raiz.querySelector(".stage-elenco");
    this.#marca = raiz.querySelector(".stage-marca");

    globalThis.addEventListener("resize", () => this.desenhar());
  }

  get aCompor() { return this.#aCompor; }

  /** Compor = o mestre está a montar a cena e vê-a mesmo sem estar no ar. */
  compor(ligado) {
    this.#aCompor = !!ligado;
    this.desenhar();
  }

  // ---------------------------------------------------------------- desenho

  desenhar() {
    if (!this.#raiz) return;
    const p = palco();
    const isGM = game.user.isGM;
    const visivel = podeVer(p, { isGM, aCompor: this.#aCompor });

    if (!visivel) return this.#esconder();

    this.#raiz.hidden = false;
    this.#raiz.dataset.mestre = isGM ? "1" : "0";
    this.#raiz.classList.toggle("stage-no-ar", !!p.visivel);
    requestAnimationFrame(() => this.#raiz.classList.add("stage-visivel"));

    // fundo: um <img> em vez de background-image, porque os caminhos do Forge
    // trazem espaços e parênteses e escapá-los à mão dava sempre erro
    const img = this.#fundo.querySelector("img");
    if (img.getAttribute("src") !== p.fundo) img.src = p.fundo || "";
    img.hidden = !p.fundo;
    this.#fundo.dataset.ajuste = p.ajuste;
    this.#fundo.classList.toggle("stage-deriva", !!p.deriva && !!p.fundo);

    // elenco: só se redesenha quando muda mesmo, para não cortar as animações
    const estado = JSON.stringify(p.elenco);
    if (estado !== this.#estadoAnterior) {
      this.#estadoAnterior = estado;
      this.#desenharElenco(p, isGM);
    }

    // o mestre tem de saber sempre se a mesa está a ver ou não
    this.#marca.hidden = !isGM;
    this.#marca.textContent = game.i18n.localize(p.visivel ? "STAGE.NoAr" : "STAGE.PreVisualizacao");
    this.#marca.dataset.ar = p.visivel ? "1" : "0";

    document.body.classList.toggle("stage-ativo", !!p.visivel || this.#aCompor);
    Hooks.callAll(`${MODULE_ID}.desenhou`);
  }

  #desenharElenco(p, isGM) {
    const foco = haFocoNoElenco(p.elenco);
    const ordenado = ordenarElenco(p.elenco);
    const existentes = new Map([...this.#elenco.children].map(el => [el.dataset.id, el]));
    this.#elenco.replaceChildren();

    ordenado.forEach((personagem, i) => {
      let el = existentes.get(personagem.id);
      if (!el) {
        el = document.createElement("figure");
        el.className = "stage-personagem stage-a-entrar";
        el.style.animationDelay = `${i * TEMPO.ESCADA}ms`;
        el.innerHTML = `<img alt="" draggable="false"><figcaption></figcaption>`;
        if (isGM) this.#ligarGestos(el, personagem.id);
      }
      el.dataset.id = personagem.id;
      el.dataset.foco = personagem.foco ? "1" : "0";

      const s = estiloDaPersonagem(personagem, { haFoco: foco });
      el.style.left = s.left;
      el.style.top = s.top;
      el.style.height = s.altura;
      el.style.transform = s.transform;
      el.style.opacity = s.opacidade;
      el.style.filter = s.filtro;

      const img = el.querySelector("img");
      if (img.getAttribute("src") !== personagem.img) img.src = personagem.img;
      const legenda = el.querySelector("figcaption");
      legenda.textContent = personagem.nome ?? "";
      legenda.hidden = !personagem.nome?.trim() || !personagem.foco;

      this.#elenco.appendChild(el);
    });
  }

  #esconder() {
    if (!this.#raiz || this.#raiz.hidden) return;
    this.#raiz.classList.remove("stage-visivel");
    document.body.classList.remove("stage-ativo");
    this.#estadoAnterior = "";
    setTimeout(() => {
      if (!this.#raiz.classList.contains("stage-visivel")) {
        this.#raiz.hidden = true;
        this.#elenco.replaceChildren();
      }
    }, TEMPO.SAIDA);
  }

  // ---------------------------------------------------------------- gestos do mestre

  /**
   * Compor em direto, sem formulários: arrastar move, a roda muda o tamanho,
   * clicar dá o foco, o botão direito espelha. Guarda-se quando o gesto acaba —
   * arrastar não pode escrever na cena a cada pixel.
   */
  #ligarGestos(el, id) {
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const caixa = el.getBoundingClientRect();
      const desvio = { x: ev.clientX - (caixa.left + caixa.width / 2), y: ev.clientY - (caixa.top + caixa.height) };
      this.#arrasto = { id, el, desvio, mexeu: false, inicio: { x: ev.clientX, y: ev.clientY } };

      const mover = (e) => {
        if (!this.#arrasto) return;
        if (!this.#arrasto.mexeu && Math.hypot(e.clientX - this.#arrasto.inicio.x, e.clientY - this.#arrasto.inicio.y) < 4) return;
        this.#arrasto.mexeu = true;
        el.classList.add("stage-a-arrastar");
        el.style.left = `${((e.clientX - desvio.x) / globalThis.innerWidth) * 100}%`;
        el.style.top = `${((e.clientY - desvio.y) / globalThis.innerHeight) * 100}%`;
      };

      const largar = async (e) => {
        globalThis.removeEventListener("pointermove", mover);
        globalThis.removeEventListener("pointerup", largar);
        el.classList.remove("stage-a-arrastar");
        const arrasto = this.#arrasto;
        this.#arrasto = null;
        if (!arrasto) return;
        if (!arrasto.mexeu) return focarPersonagem(id);
        await moverPersonagem(id,
          (e.clientX - desvio.x) / globalThis.innerWidth,
          (e.clientY - desvio.y) / globalThis.innerHeight);
      };

      globalThis.addEventListener("pointermove", mover);
      globalThis.addEventListener("pointerup", largar);
    });

    el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); espelharPersonagem(id); });

    el.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const atual = parseFloat(el.style.height) / 100 || ESCALA.padrao;
      const nova = escalaValida(atual + (ev.deltaY < 0 ? ESCALA.passo * 3 : -ESCALA.passo * 3));
      el.style.height = `${nova * 100}vh`;       // muda à vista
      clearTimeout(this.#timerEscala);
      this.#timerEscala = setTimeout(() => escalarPersonagem(id, nova), 300);
    }, { passive: false });
  }
}

export const palcoEmCena = new Palco();
export { log };

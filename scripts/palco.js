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
 * O mapa continua a existir por baixo; o palco só o tapa. A folha apanha os
 * cliques de toda a gente: sem isso, um jogador podia arrastar o próprio token
 * no mapa escondido sem saber.
 */
class Palco {
  #raiz = null;
  #camadas = [];              // duas imagens de fundo, para cruzar de uma cena para a outra
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
      <div class="stage-fundo">
        <img class="stage-fundo-img" alt="" draggable="false">
        <img class="stage-fundo-img" alt="" draggable="false">
      </div>
      <div class="stage-elenco"></div>
      <div class="stage-marca" hidden></div>`;
    paiUI().appendChild(raiz);
    this.#raiz = raiz;
    this.#camadas = [...raiz.querySelectorAll(".stage-fundo-img")];
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

    const entrando = this.#raiz.hidden;
    this.#raiz.hidden = false;
    this.#raiz.dataset.mestre = isGM ? "1" : "0";
    this.#raiz.classList.toggle("stage-no-ar", !!p.visivel);
    requestAnimationFrame(() => this.#raiz.classList.add("stage-visivel"));

    this.#trocarFundo(p.fundo, { deUmaVez: entrando });
    const fundo = this.#raiz.querySelector(".stage-fundo");
    fundo.dataset.ajuste = p.ajuste;
    fundo.classList.toggle("stage-deriva", !!p.deriva && !!p.fundo);

    const estado = JSON.stringify(p.elenco);
    if (estado !== this.#estadoAnterior) {
      this.#estadoAnterior = estado;
      this.#desenharElenco(p, isGM);
    }

    // o mestre tem de saber sempre se a mesa está a ver ou não
    this.#marca.hidden = !isGM;
    const rotulo = game.i18n.localize(p.visivel ? "STAGE.NoAr" : "STAGE.PreVisualizacao");
    this.#marca.textContent = p.visivel && game.paused ? `${rotulo} · ${game.i18n.localize("STAGE.EmPausa")}` : rotulo;
    this.#marca.dataset.ar = p.visivel ? "1" : "0";

    // `stage-ativo`: o palco está a tapar o mapa. `stage-ao-vivo`: a mesa está a ver.
    // A interface só se cala no segundo — o mestre a compor precisa dela inteira.
    document.body.classList.add("stage-ativo");
    document.body.classList.toggle("stage-ao-vivo", !!p.visivel);
    Hooks.callAll(`${MODULE_ID}.desenhou`);
  }

  /**
   * Trocar de fundo cruza as duas imagens em vez de cortar a seco.
   *
   * A nova é carregada na camada de trás e só entra quando já chegou — sem isto,
   * pôr no ar outra cena da biblioteca mostrava meio segundo de preto no Forge,
   * que é o tempo de ir buscar a imagem.
   */
  #trocarFundo(src, { deUmaVez = false } = {}) {
    const [frente, tras] = this.#camadas;
    const atual = frente.classList.contains("stage-fundo-visivel") ? frente.getAttribute("src") : null;
    if ((atual ?? "") === (src ?? "")) return;

    const entrar = () => {
      tras.classList.toggle("stage-sem-transicao", deUmaVez);
      frente.classList.toggle("stage-sem-transicao", deUmaVez);
      tras.classList.add("stage-fundo-visivel");
      frente.classList.remove("stage-fundo-visivel");
      this.#camadas.reverse();
    };

    if (!src) {
      frente.classList.remove("stage-fundo-visivel");
      return;
    }
    tras.onload = tras.onerror = () => { tras.onload = tras.onerror = null; entrar(); };
    tras.src = src;
    if (tras.complete && tras.naturalWidth) { tras.onload = tras.onerror = null; entrar(); }
  }

  /**
   * O elenco atualiza-se NO SÍTIO.
   *
   * A primeira versão tirava toda a gente do palco e voltava a pô-la a cada
   * mudança — e tirar um elemento do DOM recomeça as animações dele. Resultado:
   * dar o foco a alguém fazia o elenco inteiro voltar a entrar. Agora quem já
   * está fica, a ordem de trás para a frente vem do `z-index`, e quem sai
   * desvanece em vez de desaparecer.
   */
  #desenharElenco(p, isGM) {
    const foco = haFocoNoElenco(p.elenco);
    const ordenado = ordenarElenco(p.elenco);
    const presentes = new Set(ordenado.map(x => x.id));
    const existentes = new Map([...this.#elenco.children]
      .filter(el => !el.classList.contains("stage-a-sair"))
      .map(el => [el.dataset.id, el]));

    for (const [id, el] of existentes) {
      if (presentes.has(id)) continue;
      el.classList.add("stage-a-sair");
      setTimeout(() => el.remove(), TEMPO.SAIDA);
    }

    let novos = 0;
    ordenado.forEach((personagem, i) => {
      let el = existentes.get(personagem.id);
      if (!el) {
        el = document.createElement("figure");
        el.className = "stage-personagem stage-a-entrar";
        el.style.animationDelay = `${novos++ * TEMPO.ESCADA}ms`;
        el.innerHTML = `<img alt="" draggable="false"><figcaption></figcaption>`;
        el.addEventListener("animationend", () => el.classList.remove("stage-a-entrar"), { once: true });
        if (isGM) this.#ligarGestos(el, personagem.id);
        this.#elenco.appendChild(el);
      }
      el.dataset.id = personagem.id;
      el.dataset.foco = personagem.foco ? "1" : "0";
      el.dataset.escala = String(escalaValida(personagem.escala));

      const s = estiloDaPersonagem(personagem, { haFoco: foco });
      el.style.left = s.left;
      el.style.top = s.top;
      el.style.height = s.altura;
      el.style.transform = s.transform;
      el.style.opacity = s.opacidade;
      el.style.filter = s.filtro;
      el.style.zIndex = String(i + 1);

      const img = el.querySelector("img");
      if (img.getAttribute("src") !== personagem.img) img.src = personagem.img;
      img.style.transform = s.espelho;
      const legenda = el.querySelector("figcaption");
      legenda.textContent = personagem.nome ?? "";
      legenda.hidden = !personagem.nome?.trim() || !personagem.foco;
    });
  }

  #esconder() {
    if (!this.#raiz || this.#raiz.hidden) return;
    this.#raiz.classList.remove("stage-visivel");
    document.body.classList.remove("stage-ativo", "stage-ao-vivo");
    this.#estadoAnterior = "";
    setTimeout(() => {
      if (this.#raiz.classList.contains("stage-visivel")) return;
      this.#raiz.hidden = true;
      this.#elenco.replaceChildren();
      this.#camadas.forEach(img => img.classList.remove("stage-fundo-visivel"));
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
      ev.stopPropagation();
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

    el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); ev.stopPropagation(); espelharPersonagem(id); });

    // A roda mexe na escala GUARDADA, não na altura desenhada: quem tem o foco
    // aparece 4% maior, e ler a altura do ecrã somava esse bónus a cada volta.
    el.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const atual = Number(el.dataset.escala) || ESCALA.padrao;
      const nova = escalaValida(atual + (ev.deltaY < 0 ? ESCALA.passo * 3 : -ESCALA.passo * 3));
      el.dataset.escala = String(nova);
      el.style.height = `${nova * (el.dataset.foco === "1" ? 1.04 : 1) * 100}vh`;   // muda à vista
      clearTimeout(this.#timerEscala);
      this.#timerEscala = setTimeout(() => escalarPersonagem(id, nova), 300);
    }, { passive: false });
  }
}

export const palcoEmCena = new Palco();
export { log };

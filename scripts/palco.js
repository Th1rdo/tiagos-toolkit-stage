import { MODULE_ID, TEMPO, ESCALA, AJUSTE, paiUI, log } from "./const.js";
import {
  palco, moverPersonagem, escalarPersonagem, espelharPersonagem, focarPersonagem,
  removerPersonagem, definirEnquadramento
} from "./dados.js";
import {
  podeVer, ordenarElenco, estiloDaPersonagem, haFocoNoElenco, escalaValida, fracaoValida,
  escalaPorRoda, pousarNoChao, zonaDeSaida, arrastarFundo, aproximarFundo, estiloDoFundo,
  enquadramentoValido
} from "./logica.js";

/**
 * O palco.
 *
 * Uma folha por cima do mapa: o fundo enche o ecrã, as personagens ficam de pé
 * em cima dele. Para o jogador não há nada para clicar — é uma imagem, e é esse
 * o ponto. Para o mestre, tudo se compõe em direto, com o rato e o teclado:
 *
 *   personagem — arrastar move (os pés encostam ao chão dos outros; para baixo
 *                da borda tira de cena) · roda: tamanho · clique: foco ·
 *                botão direito: espelhar · teclado com o rato por cima
 *   fundo      — arrastar reenquadra · roda aproxima · duplo clique repõe
 *
 * O mapa continua a existir por baixo; o palco só o tapa. A folha apanha os
 * cliques de toda a gente: sem isso, um jogador podia arrastar o próprio token
 * no mapa escondido sem saber.
 */
class Palco {
  #raiz = null;
  #fundo = null;
  #camadas = [];              // duas imagens de fundo, para cruzar de uma cena para a outra
  #elenco = null;
  #marca = null;
  #chao = null;
  #saida = null;
  #aCompor = false;
  #arrasto = null;
  #estadoAnterior = "";
  #timerEscala = null;
  #timerFundo = null;
  #sobre = null;              // a personagem debaixo do rato: é a ela que o teclado fala
  #enquadramento = enquadramentoValido();

  montar() {
    if (this.#raiz) return;
    const raiz = document.createElement("div");
    raiz.id = "stage-palco";
    raiz.hidden = true;
    raiz.innerHTML = `
      <div class="stage-fundo">
        <div class="stage-fundo-ambiente"></div>
        <img class="stage-fundo-img" alt="" draggable="false">
        <img class="stage-fundo-img" alt="" draggable="false">
      </div>
      <div class="stage-elenco"></div>
      <div class="stage-chao" hidden></div>
      <div class="stage-saida" hidden></div>
      <div class="stage-marca" hidden></div>`;
    paiUI().appendChild(raiz);
    this.#raiz = raiz;
    this.#fundo = raiz.querySelector(".stage-fundo");
    this.#camadas = [...raiz.querySelectorAll(".stage-fundo-img")];
    this.#elenco = raiz.querySelector(".stage-elenco");
    this.#marca = raiz.querySelector(".stage-marca");
    this.#chao = raiz.querySelector(".stage-chao");
    this.#saida = raiz.querySelector(".stage-saida");

    globalThis.addEventListener("resize", () => { this.desenhar(); this.#encaixar(); });
    if (game.user.isGM) {
      this.#ligarGestosDoFundo();
      this.#ligarTeclado();
    }
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

    this.#fundo.dataset.ajuste = p.ajuste;
    this.#fundo.classList.toggle("stage-deriva", !!p.deriva && !!p.fundo);
    // Numa variável de CSS, uma morada relativa resolve-se contra a FOLHA DE ESTILO
    // (modules/…/styles/), não contra a página: o desfocado de «Inteira» procurava a
    // imagem dentro do módulo. Vai sempre absoluta.
    this.#fundo.style.setProperty("--stage-fundo-url",
      p.fundo ? `url("${new URL(p.fundo, document.baseURI).href}")` : "none");
    this.#trocarFundo(p.fundo, { deUmaVez: entrando });
    // um arrasto do fundo a meio manda no desenho; a gravação chega depois
    if (!this.#arrasto?.fundo) this.#aplicarEnquadramento(p.enquadramento, p.ajuste);
    this.#encaixar();

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
   * O enquadramento do fundo: que parte da imagem se vê e quão perto.
   *
   * O mesmo ponto é o `object-position` das imagens e a origem do zoom — assim
   * aproximar vai direito ao sítio que o mestre escolheu. Em «Inteira» não há
   * nada para enquadrar: a imagem vê-se toda.
   */
  #aplicarEnquadramento(e, ajuste = palco().ajuste) {
    this.#enquadramento = enquadramentoValido(e);
    const inteira = ajuste === AJUSTE.CONTER;
    const s = estiloDoFundo(this.#enquadramento);
    this.#fundo.style.transform = inteira ? "" : `scale(${s.escala})`;
    this.#fundo.style.transformOrigin = inteira ? "" : s.transformOrigin;
    for (const img of this.#camadas) img.style.objectPosition = inteira ? "" : s.objectPosition;
  }

  /**
   * «Inteira»: a imagem mede-se à mão em vez de `object-fit: contain`.
   *
   * Com `contain` o elemento ocupava o ecrã todo e a imagem ficava desenhada lá
   * dentro — as bordas esbatidas (a máscara) caíam na borda do ecrã e não na da
   * imagem, e ficava o corte seco contra as barras pretas. Medida, a máscara
   * apanha a borda certa e a imagem funde-se com a cópia desfocada por trás.
   */
  #encaixar() {
    const inteira = this.#fundo?.dataset.ajuste === AJUSTE.CONTER;
    const W = globalThis.innerWidth, H = globalThis.innerHeight;
    for (const img of this.#camadas) {
      if (!inteira || !img.naturalWidth) {
        img.style.width = img.style.height = img.style.left = img.style.top = "";
        continue;
      }
      const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.left = `${(W - w) / 2}px`;
      img.style.top = `${(H - h) / 2}px`;
    }
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
      this.#encaixar();
    };

    if (!src) {
      frente.classList.remove("stage-fundo-visivel");
      return;
    }
    tras.onload = tras.onerror = () => { tras.onload = tras.onerror = null; entrar(); };
    tras.src = src;
    if (tras.complete && tras.naturalWidth) { tras.onload = tras.onerror = null; entrar(); }
  }

  /** A imagem de fundo que se vê agora (para medir o que sobra ao arrastar). */
  get #fundoVisivel() {
    return this.#camadas.find(img => img.classList.contains("stage-fundo-visivel") && img.naturalWidth) ?? null;
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
      if (this.#sobre === id) this.#sobre = null;
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
      el.dataset.y = String(fracaoValida(personagem.y, 0.97));

      const s = estiloDaPersonagem(personagem, { haFoco: foco });
      if (this.#arrasto?.id !== personagem.id) {      // quem está a ser arrastado segue o rato
        el.style.left = s.left;
        el.style.top = s.top;
      }
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
    this.#sobre = null;
    setTimeout(() => {
      if (this.#raiz.classList.contains("stage-visivel")) return;
      this.#raiz.hidden = true;
      this.#elenco.replaceChildren();
      this.#camadas.forEach(img => img.classList.remove("stage-fundo-visivel"));
    }, TEMPO.SAIDA);
  }

  // ---------------------------------------------------------------- gestos: personagens

  /**
   * Compor em direto, sem formulários. Guarda-se quando o gesto acaba —
   * arrastar não pode escrever na cena a cada pixel.
   */
  #ligarGestos(el, id) {
    el.addEventListener("pointerenter", () => { this.#sobre = id; });
    el.addEventListener("pointerleave", () => { if (this.#sobre === id && !this.#arrasto) this.#sobre = null; });

    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const caixa = el.getBoundingClientRect();
      const desvio = { x: ev.clientX - (caixa.left + caixa.width / 2), y: ev.clientY - (caixa.top + caixa.height) };
      // os chãos dos outros: é a eles que os pés encostam
      const chaos = [...this.#elenco.children]
        .filter(o => o !== el && !o.classList.contains("stage-a-sair"))
        .map(o => Number(o.dataset.y));
      this.#arrasto = { id, el, desvio, chaos, mexeu: false, inicio: { x: ev.clientX, y: ev.clientY } };

      const posicao = (e) => {
        const x = (e.clientX - desvio.x) / globalThis.innerWidth;
        const yLivre = (e.clientY - desvio.y) / globalThis.innerHeight;
        const sair = zonaDeSaida(yLivre);
        const { y, guia } = sair ? { y: yLivre, guia: null } : pousarNoChao(yLivre, chaos);
        return { x, y, guia, sair };
      };

      const mover = (e) => {
        if (!this.#arrasto) return;
        if (!this.#arrasto.mexeu && Math.hypot(e.clientX - this.#arrasto.inicio.x, e.clientY - this.#arrasto.inicio.y) < 4) return;
        this.#arrasto.mexeu = true;
        el.classList.add("stage-a-arrastar");
        const { x, y, guia, sair } = posicao(e);
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
        el.classList.toggle("stage-a-sair-zona", sair);
        this.#mostrarChao(guia);
        this.#mostrarSaida(sair);
      };

      const largar = async (e) => {
        globalThis.removeEventListener("pointermove", mover);
        globalThis.removeEventListener("pointerup", largar);
        el.classList.remove("stage-a-arrastar", "stage-a-sair-zona");
        this.#mostrarChao(null);
        this.#mostrarSaida(false);
        const arrasto = this.#arrasto;
        this.#arrasto = null;
        if (!arrasto) return;
        if (!arrasto.mexeu) return focarPersonagem(id);
        const { x, y, sair } = posicao(e);
        if (sair) return removerPersonagem(id);
        await moverPersonagem(id, x, y);
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
      this.#escalarAoVivo(el, id, escalaPorRoda(Number(el.dataset.escala) || ESCALA.padrao, ev.deltaY, ev.deltaMode));
    }, { passive: false });
  }

  /** Muda à vista já; grava 300 ms depois de o gesto parar. */
  #escalarAoVivo(el, id, nova) {
    el.dataset.escala = String(nova);
    el.style.height = `${nova * (el.dataset.foco === "1" ? 1.04 : 1) * 100}vh`;
    clearTimeout(this.#timerEscala);
    this.#timerEscala = setTimeout(() => escalarPersonagem(id, nova), 300);
  }

  #mostrarChao(y) {
    this.#chao.hidden = y === null || y === undefined;
    if (!this.#chao.hidden) this.#chao.style.top = `${y * 100}%`;
  }

  #mostrarSaida(ligada) {
    this.#saida.hidden = !ligada;
    if (ligada) this.#saida.textContent = game.i18n.localize("STAGE.Gestos.LargarParaTirar");
  }

  /**
   * O teclado fala com a personagem que está debaixo do rato.
   *
   * Setas: 1% (com Shift, 5%) · + e −: tamanho · F: espelhar · Delete: tirar.
   * Nunca quando se está a escrever num campo — o nome no painel usa as setas.
   */
  #ligarTeclado() {
    globalThis.addEventListener("keydown", (ev) => {
      const id = this.#sobre;
      if (!id || this.#raiz.hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      const el = this.#elenco.querySelector(`[data-id="${id}"]`);
      if (!el) return;

      const passo = ev.shiftKey ? 0.05 : 0.01;
      const x = parseFloat(el.style.left) / 100, y = parseFloat(el.style.top) / 100;
      const mexer = (nx, ny) => {
        el.style.left = `${nx * 100}%`;
        el.style.top = `${ny * 100}%`;
        clearTimeout(this.#timerEscala);
        this.#timerEscala = setTimeout(() => moverPersonagem(id, nx, ny), 300);
      };

      switch (ev.key) {
        case "ArrowLeft": mexer(fracaoValida(x - passo), y); break;
        case "ArrowRight": mexer(fracaoValida(x + passo), y); break;
        case "ArrowUp": mexer(x, fracaoValida(y - passo)); break;
        case "ArrowDown": mexer(x, fracaoValida(y + passo)); break;
        case "+": case "=":
          this.#escalarAoVivo(el, id, escalaValida((Number(el.dataset.escala) || ESCALA.padrao) * (ev.shiftKey ? 1.15 : 1.05))); break;
        case "-": case "_":
          this.#escalarAoVivo(el, id, escalaValida((Number(el.dataset.escala) || ESCALA.padrao) / (ev.shiftKey ? 1.15 : 1.05))); break;
        case "f": case "F": espelharPersonagem(id); break;
        case "Delete": case "Backspace": removerPersonagem(id); break;
        default: return;
      }
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  // ---------------------------------------------------------------- gestos: fundo

  /**
   * O fundo também se compõe à mão: é isto que responde ao «não consigo esticar
   * sem ficar com bordas». Arrastar escolhe a parte da imagem que se vê, a roda
   * aproxima, duplo clique volta ao centro. Nunca aparecem barras: só se pode
   * deslocar o que sobra da imagem para lá do ecrã.
   */
  #ligarGestosDoFundo() {
    const noFundo = (ev) => !ev.target.closest(".stage-personagem, .stage-marca")
      && this.#fundo.dataset.ajuste !== AJUSTE.CONTER && !!this.#fundoVisivel;

    this.#raiz.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || !noFundo(ev)) return;
      ev.preventDefault();
      const img = this.#fundoVisivel;
      const medidas = { nw: img.naturalWidth, nh: img.naturalHeight, W: globalThis.innerWidth, H: globalThis.innerHeight };
      const inicio = { x: ev.clientX, y: ev.clientY, e: { ...this.#enquadramento } };
      this.#arrasto = { fundo: true, mexeu: false };
      this.#raiz.classList.add("stage-a-enquadrar");

      const mover = (e) => {
        const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
        if (!this.#arrasto.mexeu && Math.hypot(dx, dy) < 4) return;
        this.#arrasto.mexeu = true;
        this.#aplicarEnquadramento(arrastarFundo(inicio.e, dx, dy, medidas));
      };
      const largar = () => {
        globalThis.removeEventListener("pointermove", mover);
        globalThis.removeEventListener("pointerup", largar);
        this.#raiz.classList.remove("stage-a-enquadrar");
        const mexeu = this.#arrasto?.mexeu;
        this.#arrasto = null;
        if (mexeu) definirEnquadramento(this.#enquadramento);
      };
      globalThis.addEventListener("pointermove", mover);
      globalThis.addEventListener("pointerup", largar);
    });

    this.#raiz.addEventListener("wheel", (ev) => {
      if (!noFundo(ev)) return;
      ev.preventDefault();
      this.#aplicarEnquadramento(aproximarFundo(this.#enquadramento, ev.deltaY, ev.deltaMode));
      clearTimeout(this.#timerFundo);
      this.#timerFundo = setTimeout(() => definirEnquadramento(this.#enquadramento), 300);
    }, { passive: false });

    this.#raiz.addEventListener("dblclick", (ev) => {
      if (!noFundo(ev)) return;
      this.#aplicarEnquadramento(null);
      definirEnquadramento(null);
    });
  }
}

export const palcoEmCena = new Palco();
export { log };

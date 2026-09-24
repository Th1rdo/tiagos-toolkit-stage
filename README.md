# Tiago's Toolkit: Stage

Um palco para cenas sem mapa. Escolhes um fundo — o interior de uma casa, uma rua, um escritório — e ele
enche o ecrã da mesa toda. Por cima dele pões as pessoas que estão na conversa.

Nem toda a cena precisa de uma grelha de combate. Muitas precisam só de um **sítio**.

---

## Instalar

Foundry → **Add-on Modules → Install Module** → colar em *Manifest URL*:

```
https://github.com/Th1rdo/tiagos-toolkit-stage/releases/latest/download/module.json
```

Foundry v13 e v14. Sem dependências.

## Como funciona

Na barra dos tokens há um botão de máscaras. Abre o **painel do palco** (`Ctrl+Shift+E`) — a única
janela do módulo.

Abrir o painel liga a **pré-visualização**: tu vês o palco, a mesa não. No topo do ecrã está sempre escrito
em qual dos dois estados estás — *pré-visualização* ou *no ar*.

```
┌ Palco ─────────────────────────┐
│ CENAS   [+] [casa] [rua] [bar]  │  ← clicar num cartão põe essa cena no palco
│ Casa do Mero                    │  ← o nome (grava-se sozinho)
│ [fundo]  Encher · Inteira       │
│ AURA  ○ Kuaã ○ Tupã ○ Manõ …    │
│ ELENCO  Ana ● ⇆ ✕   Mero ○ ⇆ ✕  │
│ [      Mostrar à mesa      ]    │  ← o único botão que a mesa sente
└─────────────────────────────────┘
```

- **Não há botão de guardar.** O que está no palco *é* a cena guardada: tudo o que mexes grava-se sozinho.
  Para experimentar sem estragar o original, **duplica** (passar o rato por cima do cartão).
- **Clicar num cartão** põe essa cena no palco. Se o palco está no ar, a mesa vê a troca (os fundos
  cruzam); fora do ar, estás só a preparar. O cartão que a mesa está a ver tem o selo vermelho **No ar**.
- **+** começa uma cena nova e vazia.
- Procura por nome da cena **ou pelo nome de quem está nela** (aparece com mais de seis cenas).
- Dar o foco a quem está a falar e pôr no ar **não** vão para a cena guardada: são coisas do momento.

## Fundo

*Encher* corta o que sobra e é o que dá imersão; *Inteira* mostra a imagem toda, com a própria imagem
desfocada a encher o resto — sem barras pretas. A **deriva lenta** faz a imagem respirar.

Em *Encher*, compões o fundo no próprio palco: **arrastar** escolhe a parte que se vê, a **roda** aproxima,
**duplo clique** repõe. O painel diz, por baixo do fundo, se a imagem serve:
*«2560 × 1440 · ótima»* ou *«1024 × 1024 · pequena · corta 44% a encher»*.

**Que resolução?** 16:9, **2560×1440** é ótima, **1920×1080** serve; mais de 3840×2160 só gasta memória.
Coisas importantes a meio: os Macs cortam um pouco dos lados e a deriva aproxima até 9%.

## Auras

Luz que vem das bordas do ecrã quando a cena — ou quem está a falar — pertence a uma das forças de Santa Graça:

| | |
|---|---|
| **Kuaã** | amarelo |
| **Tupã** | roxo |
| **Manõ** | escuridão que avança das bordas |
| **Graça** | vermelho |

A aura da **cena** escolhe-se nos botões do painel. Cada **personagem** pode ter a sua (o ponto ao lado do
nome, clicar muda): quando essa personagem tem o foco, a borda passa à cor dela, sozinha. Trocar de aura é
um cruzamento lento; a luz respira.

## Compor em direto

Com o painel aberto, mexes nas personagens em cima do próprio palco:

| | |
|---|---|
| **arrastar** | muda de sítio — os pés encostam ao chão de quem já lá está |
| **arrastar para baixo da borda** | tira de cena |
| **roda do rato / trackpad** | muda o tamanho, suave |
| **clicar** | dá o foco — essa avança e as outras recuam |
| **botão direito** | espelha |
| **com o rato por cima** | setas mexem (Shift: mais), `+` `−` tamanho, `F` espelha, `Delete` tira |

Para pôr gente em cena: arrasta um **ator** da barra lateral (entra com o retrato), um **token**, ou uma
**imagem do navegador de ficheiros** do Foundry. Entra onde a largas, no chão comum. Sem nada disso, o **+**.

Clicar em quem já tem o foco devolve a cena a todos. O nome de quem tem o foco só aparece com a definição
*Mostrar o nome de quem tem o foco* ligada (por omissão, desligada — a arte fica limpa).

## Com a cena no ar

- A marca **No ar** / *Pré-visualização* no topo **só o mestre a vê**.
- A **hotbar some** (volta com o rato por cima) e a **barra da direita recolhe**; ao sair do ar, a barra volta
  como estava. Cada um pode desligar isto nas definições (*Recolher a interface com a cena no ar*).
- O mapa por baixo abranda para 5 fps — é isso o «FPS 5» no canto: devolve a GPU à mesa.

## Duas decisões que se notam em jogo

**Tamanho em frações do ecrã, não em pixéis.** Cada um na mesa tem um monitor diferente; o que fica bem
no portátil do mestre ficaria minúsculo num 27". As posições e os tamanhos são frações, por isso a
composição aguenta-se em todos os ecrãs.

**A âncora é nos pés.** Uma personagem grande e uma pequena assentam no mesmo chão em vez de flutuarem a
alturas diferentes. É o que faz duas pessoas parecerem estar na mesma sala.

## Pormenores que se notam

- **Trocar de cena cruza as imagens.** Trocar de cena com o palco no ar faz o fundo novo entrar por cima
  do antigo, e só depois de ter chegado — nada de meio segundo de preto enquanto o Forge vai buscar a imagem.
- **Quem sai do palco desvanece**, em vez de desaparecer.
- **A cena no ar tapa a pausa.** O cartaz gigante do «jogo em pausa» não aparece a meio da conversa — o mapa
  está escondido, e a pausa só diz respeito a ele. Tu continuas a vê-la na marca do topo.
- **Nada passa para o mapa escondido.** Com o palco por cima, ninguém arrasta um token sem querer nem faz
  zoom a um mapa que não vê.
- **Pôr no ar noutra cena avisa.** Se estás a ver uma cena e os jogadores estão noutra, o módulo diz-to
  antes de ficares a olhar para um palco que só tu vês.
- Com o **Points of Interest** instalado, os pontos do mapa escondido não aparecem a flutuar sobre a cena.

## Onde os dados vivem

Numa flag da cena. **Cada cena tem o seu palco**: mudar de cena muda de sítio, e voltar traz o cenário e o
elenco como estavam. O mapa por baixo continua a existir — o palco só o tapa, e com o palco no ar o mapa
passa a ser desenhado a ritmo lento para devolver GPU à mesa.

## API

```js
game.palco.mostrar();   // põe no ar, ou tira
game.palco.painel();    // abre o painel
game.palco.estado();    // o palco da cena atual
```

## Desenvolvimento

```bash
npm test          # lógica pura + verificação de integridade
npm run test:dom  # bancada de browser (precisa de Chrome): 41 verificações com a folha de estilos real
```

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

Na barra dos tokens há um botão de máscaras. Abre o **painel do palco** (`Ctrl+Shift+E`).

Abrir o painel liga a **pré-visualização**: tu vês o palco, a mesa não. No topo do ecrã está sempre escrito
em qual dos dois estados estás — *pré-visualização* ou *no ar* — porque a pior coisa que um módulo destes
pode fazer é deixar-te em dúvida sobre o que os jogadores estão a ver.

1. **Fundo** — escolhe a imagem. *Encher* corta o que sobra e é o que dá imersão; *caber* mostra a imagem
   inteira. A **deriva lenta** faz a imagem respirar, para não parecer um cartaz pregado.
2. **Elenco** — arrasta um ator da barra lateral para cima do palco e ele entra com a arte dele.
   Sem ator, o **+** escolhe uma imagem qualquer.
3. **Mostrar à mesa** — o botão grande. `Ctrl+Shift+R` faz o mesmo.

## Compor em direto

Com o painel aberto, mexes nas personagens em cima do próprio palco:

| | |
|---|---|
| **arrastar** | muda de sítio |
| **roda do rato** | muda o tamanho |
| **clicar** | dá o foco — essa avança e as outras recuam |
| **botão direito** | espelha |

Clicar em quem já tem o foco devolve a cena a todos. O nome só aparece por baixo de quem tem o foco.

## Duas decisões que se notam em jogo

**Tamanho em frações do ecrã, não em pixéis.** Cada um na mesa tem um monitor diferente; o que fica bem
no portátil do mestre ficaria minúsculo num 27". As posições e os tamanhos são frações, por isso a
composição aguenta-se em todos os ecrãs.

**A âncora é nos pés.** Uma personagem grande e uma pequena assentam no mesmo chão em vez de flutuarem a
alturas diferentes. É o que faz duas pessoas parecerem estar na mesma sala.

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
npm run test:dom  # bancada de browser (precisa de Chrome): 20 verificações com a folha de estilos real
```

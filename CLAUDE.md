# Cidade Feliz

Jogo de construir cidade isométrico, sucessor espiritual dos jogos sociais de 2010. PWA local-first, mesma stack do Flow. O plano completo e o status das fases estão em `docs/plano.md`.

## Regras do projeto

- Números e textos do jogo ficam em `data/*.json`, nunca soltos no código.
- Sem servidor, login, anúncio ou compra. Save só no aparelho (localStorage, chave `cidade-feliz-save-v1`).
- Arte, nomes e textos originais. Nada da Vostu ou da Zynga.
- Textos do jogo em português, tom leve e bem-humorado, sem travessão.
- A Julia (Ju) testa cada etapa e não programa: ao entregar, diga em português simples o que ela deve ver.
- Mudou o formato do save? Suba a `version` e migre, não apague a cidade de ninguém.

## Arquitetura

- `src/game/state.ts`: regras puras (construir, coletar, energia, XP, ruas, árvores, save). Recebe o tempo como parâmetro; produção usa o relógio do sistema, então rende com o app fechado.
- `src/game/render.ts`: tudo que é desenho no canvas. Profundidade por `x + y`. Arte provisória em formas; o visual de cada construção vem de `look` em `data/buildings.json`.
- `src/App.tsx`: interface React (HUD, Loja, popups, nomes) e gestos (arrastar, pinça, roda, toque). O estado do jogo fica num ref; a interface re-renderiza a cada segundo e após cada ação.

## Comandos

- `npm run dev` para desenvolver, `npm run build` para checar tipos e gerar `dist/`.
- Push na `main` publica em https://eitorbrandao.github.io/cidade-feliz/ via `.github/workflows/deploy.yml`.

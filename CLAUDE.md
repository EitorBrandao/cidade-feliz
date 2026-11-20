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

O visual e as regras foram portados do protótipo HTML aprovado pela Julia (`docs/prototipo.html`). Em dúvida de como algo deve parecer ou se comportar, ele é a referência.

- `data/*.json`: catálogo, mapa inicial, nomes sugeridos, bots e perfis, recados do Mural, missões do Seu Joaquim, números da economia.
- `src/game/state.ts`: estado e regras (construir, coletar, energia, XP, ruas, árvores, bots, Mural, visitas, missões, save e migração). Fala com a interface pelo objeto `fx`.
- `src/game/render.ts`: desenho no canvas (chão, construções, carrinhos, placas, nuvens), câmera e escolha do tile tocado.
- `src/App.tsx`: interface React (HUD, missões, barra de vizinhos, Loja, Mural, janelas) e gestos.

## Comandos

- `npm run dev` para desenvolver, `npm run build` para checar tipos e gerar `dist/`.
- Push na `main` publica em https://eitorbrandao.github.io/cidade-feliz/ via `.github/workflows/deploy.yml`.

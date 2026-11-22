# Cidade Feliz: plano de desenvolvimento

19/11/2026 · Julia

## Visão geral

Cidade Feliz é um jogo de construir cidade isométrico, no estilo dos jogos sociais de 2010 (MegaCity, CityVille), que roda como app no celular e no PC (PWA), funciona offline depois de instalado, com vizinhos simulados por bots no lugar de amigos reais.

O MegaCity original (Vostu, Orkut/Facebook) saiu do ar em junho de 2016 e não existe forma de jogá-lo hoje. Este projeto é um sucessor espiritual, não uma cópia.

**Regras que não mudam:**

- Zero servidor: nenhum login, nenhuma chamada de rede durante o jogo. O site só entrega o app; o save fica no próprio aparelho.
- Arte, nomes e textos originais. Nada de assets, logos ou nomes da Vostu ou da Zynga.
- Os vizinhos bots precisam parecer gente: rotina, personalidade, imperfeição.
- Plataforma alvo: app instalável (PWA) pelo link do GitHub Pages, no celular e no PC. É assim que a Julia compartilha.
- A Julia não é programadora: ela aprende junto e testa cada etapa.

## Stack técnica

Mudou em 20/11/2026: saiu o Godot, entrou a mesma stack do Flow, para dar pra compartilhar por link e instalar no celular.

| Item | Escolha | Por quê |
| --- | --- | --- |
| App | React 18 + TypeScript + Vite | Mesma base do Flow |
| Desenho do mapa | Canvas 2D isométrico (tile 96x48) | Leve, abre na hora no celular |
| Instalação | vite-plugin-pwa | Ícone na tela inicial e funciona offline |
| Dados do catálogo | Arquivos .json em `data/` | Ajustar preços e tempos sem mexer no código |
| Save | localStorage do aparelho | Sem servidor, cada pessoa tem a sua cidade |
| Arte provisória | Formas desenhadas no canvas | Destrava o jogo antes da arte final |
| Publicação | GitHub Pages via GitHub Actions | Cada push publica sozinho |
| Versionamento | GitHub público (EitorBrandao/cidade-feliz) | Pages grátis exige repositório público |

**Estrutura de pastas:**

```
cidade-feliz/
  data/          (config, buildings, map_start, names; depois bots, messages, missions)
  src/game/      (state.ts: regras · render.ts: desenho · data.ts · types.ts)
  src/App.tsx    (interface: HUD, Loja, popups, gestos)
  public/        (ícones do app)
  docs/plano.md  (este documento)
```

## Referência: o protótipo em HTML

O visual e os números já foram aprovados pela Julia num [protótipo jogável em HTML](https://claude.ai/artifact/DLvpnwJNauppoAo7cz4P6s). Ele é a referência de estilo: o jogo deve ficar com a mesma cara. Se a outra sessão não conseguir abrir o link, a Julia pode anexar o arquivo HTML.

**O que o protótipo define:**

- Mapa 16x16 isométrico, tiles 96x48, grama em 3 tons, borda de terra, ruas com calçada e faixa tracejada.
- HUD no topo em pílulas escuras: Ouro, Grana, Energia com contagem, Nível com barra de XP, População.
- Barra de vizinhos embaixo em painel bege com avatares e nível; botões Loja (laranja), Ruas (verde), Mural (azul, com contador).
- Moeda dourada flutuando sobre construção pronta; estrela azul nas cidades visitadas.
- Carrinhos andando nas ruas, nuvens passando, bandeira balançando.
- Fonte arredondada (Baloo 2), cores saturadas, bordas grossas, sombras chapadas.

**Catálogo inicial** (tempos acelerados no protótipo; no jogo final multiplicar por algo entre 30 e 60):

| Construção | Categoria | Preço | Renda | Ciclo | População | Nível |
| --- | --- | --- | --- | --- | --- | --- |
| Casa | Casas | 100 ouro | 25 | 20 s | +5 moradores | 1 |
| Chalé Azul | Casas | 180 ouro | 40 | 30 s | +7 moradores | 1 |
| Sobrado | Casas | 350 ouro | 70 | 45 s | +12 moradores | 2 |
| Prédio | Casas | 3 Grana | 160 | 60 s | +30 moradores | 4 |
| Lanchonete | Comércio | 250 ouro | 55 | 30 s |  | 1 |
| Padaria | Comércio | 400 ouro | 90 | 45 s |  | 2 |
| Mercadinho | Comércio | 700 ouro | 150 | 60 s |  | 3 |
| Sorveteria | Comércio | 2 Grana | 120 | 40 s |  | 1 |
| Escola | Comunidade | 600 ouro |  |  | +40 pop. máxima | 1 |
| Posto de Saúde | Comunidade | 900 ouro |  |  | +60 pop. máxima | 3 |
| Praça | Decoração | 80 ouro |  |  |  | 1 |
| Árvore | Decoração | 20 ouro |  |  |  | 1 |
| Canteiro | Decoração | 40 ouro |  |  |  | 1 |
| Prefeitura | Inicial |  |  |  | +30 pop. máxima |  |

## Sistemas do jogo

Todos os sistemas abaixo já funcionam no protótipo; a tarefa é portá-los pro app com a mesma lógica.

- **Mapa:** grade 16x16; cada tile guarda se é rua, se tem árvore e qual construção tem. Arrastar move a câmera, pinça ou roda do mouse dá zoom. Desenho em ordem de profundidade (x + y).
- **Construção:** escolher na Loja, tocar num tile vazio. Mostra fantasma verde/vermelho. Fica em obra (andaime + barra) por alguns segundos antes de render.
- **Produção:** cada construção guarda o horário do último ciclo. Quando passa o tempo, aparece a moeda; tocar coleta, gasta 1 energia e reinicia o ciclo. Usa o relógio do sistema, então rende com o jogo fechado.
- **Moedas:** Ouro (ganho jogando) e Grana (rara: 1 por nível e presentes). Não existe compra com dinheiro real.
- **Energia:** máximo 15, +1 a cada intervalo fixo, enche ao subir de nível; o máximo cresce 1 a cada 2 níveis.
- **XP e nível:** XP por coletar, construir, cortar árvore e ajudar vizinhos. XP do próximo nível = 50 + nível x 30. Nível novo libera construções.
- **População:** casas somam moradores; Prefeitura, Escola e Posto somam o limite. Sem limite livre, não dá pra construir casa.
- **Ruas:** modo de pintar ruas por 10 ouro cada; tocar de novo remove.
- **Árvores:** espalhadas no começo; cortar gasta 1 energia e dá ouro e XP.
- **Save:** automático a cada poucos segundos e a cada ação importante.

**Nomes dos estabelecimentos (obrigatório):**

- Ao construir um comércio ou prédio da comunidade, abre um campo pra dar nome, já preenchido com uma sugestão aleatória ("Padaria Pão Quente", "Lanchonete do Zé"). Casas podem ter nome opcional.
- O nome aparece numa placa na fachada e no topo do popup ao tocar na construção. Tocar e escolher Renomear muda a qualquer hora.
- A cidade também tem nome, mostrado no HUD e no banner quando um bot visita.
- Limite de 24 caracteres; o nome fica salvo junto com a construção no save.
- Os bots citam os nomes nos recados ("comi na Lanchonete do Zé ontem, top!") e as cidades deles também têm estabelecimentos com nomes próprios, vindos de listas em `data/names.json`.

**Missões (obrigatório):**

Missões guiam a jogadora de nível em nível. Elas são dadas pelo Seu Joaquim, assessor da prefeitura, que tem uma falinha pra cada uma.

- Até 3 missões ativas por vez, em ícones redondos na lateral esquerda, com progresso ("2/3"). Um "!" vermelho marca missão nova; quando completa, o ícone pulsa.
- Tocar abre a ficha com a fala, as tarefas com barra de progresso e a recompensa. Quando completa, aparece o botão Resgatar, que dá ouro, Grana e XP e libera a próxima da fila.
- O progresso conta a partir do momento em que a missão fica ativa, usando contadores de ação: coletar (geral e por categoria), construir (por tipo e por categoria), cortar árvore, colocar rua, ajudar vizinho, mandar presente. Também há tarefas de estado, como "ter 50 moradores".
- As missões ficam em `data/missions.json` (id, ícone, título, fala, tarefas, prêmio), na ordem em que aparecem.

| # | Missão | Tarefas | Prêmio |
| --- | --- | --- | --- |
| 1 | Bem-vinda, prefeita! | Coletar 3 aluguéis de casas | 50 ouro, 20 XP |
| 2 | Mais moradores | Construir 1 casa; coletar 2 vezes | 80 ouro, 25 XP |
| 3 | Limpando o terreno | Cortar 3 árvores | 40 ouro, 15 XP |
| 4 | Bairro conectado | Colocar 4 ruas | 60 ouro, 20 XP |
| 5 | Bons vizinhos | Ajudar 3 vezes em vizinhos; mandar 1 presente | 1 Grana, 30 XP |
| 6 | Fome de negócio | Construir 1 comércio; coletar 3 vezes de comércios | 120 ouro, 40 XP |
| 7 | Educação em primeiro lugar | Construir 1 escola | 150 ouro, 50 XP |
| 8 | Cidade bonita | Construir 2 decorações | 60 ouro, 25 XP |
| 9 | Pão quentinho | Construir 1 padaria | 1 Grana, 50 XP |
| 10 | Cidade grande | Ter 50 moradores | 200 ouro, 60 XP |
| 11 | Comerciante de mão cheia | Coletar 10 vezes de comércios | 250 ouro, 80 XP |
| 12 | Arranha-céu | Construir 1 prédio | 2 Grana, 100 XP |

No jogo final, a lista deve continuar além da 12, acompanhando cada construção nova que for liberada.

**Pedido do Dia:**

- [x] Feito em 21/11/2026. Todo dia o Seu Joaquim pede 3 tarefinhas sorteadas (4º ícone redondo, 📋, embaixo das missões). A semente é a data, então o mesmo dia dá o mesmo pedido, sem rede.
- [x] Só sorteia o que dá pra fazer no nível e na cidade atual (sem padaria antes do nível 2, sem cortar árvore se não tem árvore).
- [x] Baú de 7 degraus (o 7º dá Grana); depois do 7 recomeça no 1. Uma folga por semana (segunda a domingo) não quebra a sequência; sumir mais que isso volta um degrau, nunca zera.
- [x] Modelos, faixas por nível, baús e falas em `data/missions.json` (bloco `diarias`). Save na versão 4, com migração.

**Mais construções e Mover:**

- [x] Feito em 22/11/2026. O catálogo foi de 13 para 56 construções, em 5 abas (nova aba Lazer): mais casas (Casa Verde, Geminada, Mansão, Condomínio), 18 comércios (Cafeteria, Pizzaria, Farmácia, Banco, Hotel, Shopping...), lazer (Lan House, Fliperama, Cinema, Museu, Teatro, Estádio...), comunidade (Creche, Biblioteca, Igreja, Bombeiros, Delegacia, Hospital, Universidade...) e decoração (Fonte, Lago, Coreto, Parquinho, Estátua, Palmeira...). Tudo em `data/buildings.json`, nomes sugeridos em `data/names.json`.
- [x] Biblioteca, Museu, Escola e Universidade dão XP extra em toda coleta da cidade (`xpColeta`, cada tipo conta uma vez).
- [x] Botão ✋ Mover (e Mover na ficha da construção): toca na construção e depois no lugar novo, sem custo. Vale pra tudo, inclusive decoração. A construção leva junto nome e tempo de rendimento.
- [x] 10 missões novas (Reforma geral, Rato de biblioteca, Cidade segura, Cidade universitária...) e um modelo novo no Pedido do Dia (lazer). As cidades dos vizinhos usam as construções novas conforme o nível.
- Sem mudança no formato do save (continua versão 5).

**Para depois (não estão no protótipo):** expansão de terreno, praia e ilha, vender construções, eventos sazonais (Natal, Carnaval), sons e música.

## Vizinhos bots

Os bots não precisam de IA: rotina, personalidade e um pouco de aleatoriedade já fazem eles parecerem gente. Cada bot é um registro em `bots.json`.

| Bot | Nível inicial | Perfil | Comportamento |
| --- | --- | --- | --- |
| Mari | 14 | Generosa | Manda presente e visita muito |
| Dario | 22 | Competitivo | Sobe de nível rápido |
| Dona Cida | 9 | Generosa | Presentes e recados carinhosos |
| Kelly | 17 | Pedinte | Vive pedindo tijolo, telha, tinta |
| Thiago | 6 | Sumido | Aparece pouco (peso 0,25) |
| Rafa | 11 | Normal | De tudo um pouco |
| Bia | 3 | Novata | Fala bastante, pede ajuda, sobe rápido no começo |

**Tipos de evento no Mural:**

- **Presente:** ouro (20 a 60) ou 1 energia. Botão Aceitar.
- **Pedido de ajuda:** botão Ajudar dá +4 XP; o bot agradece alguns minutos depois.
- **Subiu de nível:** o nível do bot sobe de verdade. Botão Curtir.
- **Visita:** o bot visitou e coletou um aluguel pra você (+15 ouro automático).
- **Fala solta:** recados do dia a dia ("bom dia vizinhança", "acabou minha energia de novo").

Cada perfil tem pesos diferentes pra cada tipo. Os textos ficam em `messages.json` com várias variações por tipo.

**O que faz parecer gente:**

1. **Simulação enquanto o jogo está fechado:** ao abrir, calcular quantos eventos cada bot teria gerado desde a última sessão (com teto) e mostrar "Enquanto você estava fora".
2. **Horário humano:** de madrugada (1h às 7h) quase nada acontece; à noite e no fim de semana, mais movimento.
3. **Reações atrasadas:** mandar presente ou ajudar gera agradecimento minutos depois, e às vezes um presente de volta (sempre no perfil generoso, 50% nos outros).
4. **Cidade visitável:** gerada a partir de uma semente fixa por bot, cresce com o nível (mais ruas, prédios maiores). Até 5 ajudas por visita, cada uma +12 ouro e +3 XP.
5. **Imperfeição:** sumiços de dias, "kkkk", erros de digitação ocasionais, emojis.

**Cartão-postal (visita entre pessoas, sem servidor):**

- [x] Feito em 21/11/2026. Em Opções (⚙), o botão "Mandar cartão-postal" coloca a cidade inteira dentro do link, depois do `#`, comprimida. No celular abre o menu de compartilhar (WhatsApp); no PC copia o link.
- [x] Quem abre o link entra na cidade como numa visita de vizinho: 5 estrelas pra ajudar, carrinhos e placas. Nada da cidade visitada vai pro save de quem visita, só o XP, o ouro e o contador de ajudas.
- [x] Campo "Colar cartão-postal" em Opções, pro app instalado no iPhone (que não divide dados com o Safari). Aceita o link inteiro ou só o código.
- [x] Depois das 5 ajudas, dá pra mandar um link de obrigado; quem abre ganha um presente, uma vez só por cartão (`postaisVistos`).
- [x] Tudo que vem do link é conferido (tamanho, 16x16 tiles, construção existente, nomes até 24 letras). Link quebrado só mostra um aviso. Save na versão 5, com migração.

**Versão e atualização:**

- [x] Feito em 22/11/2026. A versão e a data do build aparecem no rodapé das Opções (⚙). Ao abrir o jogo, se tiver versão nova, ela baixa e a página recarrega sozinha (o save é gravado antes); depois o Seu Joaquim avisa "Chegou novidade!" uma vez.

**Opcional, só no fim:** uma IA local (ex.: Ollama com modelo pequeno) pode variar os recados, ainda sem internet. Começar com frases prontas.

## Fases

Cinco fases, cada uma termina com algo jogável que a Julia testa antes de seguir.

1. **Fundação:** criar o projeto, mapa isométrico 16x16 com grama e ruas, câmera com arrastar e zoom.
   - [x] Pronto quando: abre pelo link, mostra o mapa e dá pra passear por ele.
2. **Cidade jogável:** construções do catálogo, nomes dos estabelecimentos, obra, moedas, coleta, energia, XP, nível, população, árvores, ruas, save e load.
   - [x] Pronto quando: dá pra fechar o jogo, abrir horas depois e coletar o que rendeu.
3. **Interface completa:** HUD, Loja com abas e cadeado por nível, missões do Seu Joaquim, mensagens flutuantes, avisos, tela de opções.
   - [ ] Pronto quando: dá pra jogar só com toque/clique, sem nada de debug na tela.
4. **Vizinhos bots:** barra de vizinhos, Mural, eventos, presentes, simulação offline, visitas às cidades geradas.
   - [ ] Pronto quando: ao abrir depois de um dia, há novidades críveis no Mural e dá pra visitar e ajudar cada vizinho.
5. **Capricho:** arte final, sons, animações (carrinhos, nuvens, bandeira), mais missões, ajuste de tempos reais, ícones e instalação no celular.
   - [ ] Pronto quando: a Julia joga uma semana e não quer parar.

## Para a próxima sessão

Comece pela Fase 1 e entregue em passos pequenos que a Julia consiga rodar e ver funcionando.

- A Julia não programa: explique cada passo em português simples, diga exatamente onde clicar e o que colar, e por que.
- Prefira entregar arquivos completos a trechos soltos pra ela encaixar.
- Teste o que puder antes de entregar; ao fim de cada passo, diga o que ela deve ver na tela.
- Números e textos do jogo ficam nos arquivos de `data/`, nunca espalhados pelo código.
- Nada de rede, login, anúncio ou compra.
- Tom direto, leve e bem-humorado. A Julia não gosta de travessão nos textos.
- Ao terminar uma fase, atualize este documento marcando o "Pronto quando".

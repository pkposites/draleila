# LP — Dra. Leila Freire (Rinoplastia e Harmonia da Face)

Landing page de qualificação para tráfego pago (Meta Ads). Site estático
(HTML/CSS/JS puro, sem build), mobile-first, no mesmo padrão da LP da
Dra. Letícia Caproni (`pkposites/draleticiacaproni`, ver `PADRAO-LP.md` lá).

```
index.html        página
styles.css        estilos (visual de alto padrão: Bodoni Moda + Source Sans 3, tons quentes,
                  retrato em arco, seção café com champanhe, botão de WhatsApp verde)
script.js         quiz/triagem, WhatsApp, tracking, CAPI
privacidade.html  política de privacidade (LGPD)
assets/           favicon e fotos
worker/           Cloudflare Worker da API de Conversões (CAPI)
```

## Seções (ordem)

1. Header fixo (com âncoras no desktop) · 2. Hero com a foto da Dra., nome como
   título principal e as principais referências (Board, pós-doc, doutorado, USP, congressos)
3. Sobre + currículo completo (Board, pós-doc, doutorado, fellowship, título, residência, congressos)
4. **Como é a consulta** (ficha: duração, formato, o que é feito, valor, depois)
5. Passo a passo + links do Instagram/YouTube · 6. Perguntas frequentes
7. **Triagem (quiz)** · 8. Caixinha de confirmação + WhatsApp
9. Endereço (Pinheiros + mapa) · 10. CTA final · Footer com CRM/RQE

Direção visual: evitar cara de template/IA. Nada de rótulos em caixa-alta com
tracinho, cards com ícone em círculo, gradientes, brilhos ou bordas animadas.
Texto direto e específico, sem frases de efeito.

## Triagem (quiz) — `script.js`

5 perguntas: o que quer melhorar, situação, prazo, formato da consulta
(presencial/online) e como a **consulta particular** se encaixa. Cada opção tem
`data-score`; o resultado classifica o contato:

| Nível | Regra | O que a pessoa vê |
|---|---|---|
| Quente | aceita a consulta particular e soma ≥ 6 | "Atendimento prioritário" |
| Em consideração | quer saber o valor da consulta antes | explicação do que a consulta inclui |
| Inicial | quer "só uma ideia de valores" / sem prazo | explica que valores saem após a consulta + links de conteúdo |

**Nenhum nível bloqueia o WhatsApp.** O nível vai na mensagem como
`Triagem: ...`, junto das respostas e da origem do anúncio, para a equipe
priorizar. A caixinha de confirmação (obrigatória) deixa explícito que a
consulta é particular — é ela que filtra quem só quer preço.

Todos os CTAs da página levam à caixinha; só o botão liberado abre o WhatsApp.

## Lead Hub (cadeolead)

- Script no `<head>` de todas as páginas, chave `pk_a369b410cbb94f9b95f7627c262a3e66`,
  com `data-consent="required"` (a página já tem banner próprio). No `index.html`
  fica logo depois do pixel; no `privacidade.html` (sem pixel) no início do `<head>`.
- O banner chama `LeadHub.consent(true)` ao aceitar e `LeadHub.consent(false)` ao
  recusar (inclusive em visitas seguintes, lendo `localStorage.lgpd_consent`).
- Pixel com `fbq('consent', 'revoke')` antes do `init`; liberado no aceite.
- Único botão que abre o WhatsApp: `#whatsapp-qualificado`. Antes dele, nome e
  WhatsApp (máscara `(11) 91234-5678`) são obrigatórios. Ao confirmar:
  `LeadHub.identify({ name, phone })`, `LeadHub.set({...})` com as respostas do
  quiz e `LeadHub.whatsappUrl(url)` na aba aberta pelo clique.
- Colunas enviadas: Momento, Prazo, Formato da consulta, Consulta particular,
  Triagem e, **só com a caixa de autorização de saúde marcada**, O que quer mudar.
- A URL não é mais alterada (utm_*, fbclid, gclid, gbraid, wbraid ficam intactos).
- Política do Lead Hub: abaixo do botão do WhatsApp e no rodapé das duas páginas.

## API de Conversões (Cloudflare Worker)

Pasta `worker/`, pixel `786053772867277`. A LP já aponta para
`https://draleilacapi.robson-oc96.workers.dev` (`CAPI_ENDPOINT` no `script.js`);
enquanto o worker não existir, o envio falha em silêncio.

1. Cloudflare > Workers e Pages > Create > Import a repository >
   `pkposites/draleila`, branch `claude/dreamy-allen-gwoych`, **Root directory** `worker`,
   nome **draleilacapi** (o nome define a URL).
2. Em Settings > Variables and Secrets, adicionar os secrets
   `META_ACCESS_TOKEN` (Gerenciador de Eventos > pixel > Configurações >
   API de Conversões > Gerar token de acesso) e `OFFLINE_EVENTS_TOKEN`
   (senha à sua escolha). `PIXEL_ID` e `ALLOWED_ORIGIN` já vêm do `wrangler.toml`.
3. Ajustar `ALLOWED_ORIGIN` no `wrangler.toml` (hoje: draleilalp.netlify.app) se o domínio da LP
   mudar (aceita vários, separados por vírgula).
4. Opcional: KV `draleila-leads` para os eventos offline (ver comentário no
   `wrangler.toml`).
5. Teste: Gerenciador de Eventos > Testar eventos; colocar o código em
   `TEST_EVENT_CODE` e clicar no WhatsApp da LP. O `Lead` deve aparecer como
   "Navegador" e "Servidor" (deduplicado).

## Pendências antes de ir ao ar

- [x] Foto do topo: `assets/dra-leila.webp` (recorte 4:5 de `IMG_5950.JPG`, também no `og-image.jpg`).
- [x] Foto da seção Sobre: `assets/dra-leila-sobre.webp` (recorte 4:5 de `IMG_6393.JPG.jpeg`).
- [ ] **Clarity** (`window.TRACKING.clarityId` no `index.html`), se for usar.
- [ ] **Avaliações do Google**: seção pronta e comentada no `index.html`;
      só ativar com nota, quantidade e link reais.
- [ ] **Antes e depois**: só com autorização das pacientes e dentro das regras
      do CFM (Res. 2.336/2023).
- [ ] Publicar o worker (acima) e confirmar que o (11) 3064-2676 recebe WhatsApp.

## Logo e cores

Recortes transparentes gerados a partir de `IMG_6376.JPG.jpeg` (logo enviado):
`assets/logo-horizontal.webp` (header: rosto + nome lado a lado), `assets/logo-nome.webp` (só o nome), `assets/logo-rosto.webp` (desenho do rosto,
usado no lugar das fotos), `assets/logo.webp` (completo), favicon, ícone do
iPhone e `og-image.jpg` (compartilhamento). Os `.cdr` (CorelDraw) não abrem no
navegador; se houver um SVG ou PNG em alta, dá pra trocar os recortes.
Cores do logo: marrom `#91755d` e taupe `#b3a79b` (no texto usamos `#7d634d`,
um tom mais escuro, para dar contraste de leitura).
- [ ] **Tracking** (`index.html`, objeto `window.TRACKING`): Pixel, Clarity e
      chave do Lead Hub. Vazio = não carrega.
- [ ] **Avaliações do Google**: seção pronta e comentada no `index.html`;
      só ativar com nota, quantidade e link reais.
- [ ] **Antes e depois**: só com autorização das pacientes e dentro das regras
      do CFM (Res. 2.336/2023).
- [ ] **CAPI**: publicar `worker/` na Cloudflare (preencher `PIXEL_ID`, id do KV
      e os secrets `META_ACCESS_TOKEN`/`OFFLINE_EVENTS_TOKEN`) e colar a URL em
      `CAPI_ENDPOINT` no `script.js`. Ajustar `ALLOWED_ORIGIN` ao domínio final.
- [ ] Confirmar que o (11) 3064-2676 recebe WhatsApp (`WHATSAPP_NUMBER`).

## Atenção: categoria sensível na Meta

O texto cita Rinoplastia, cirurgia e hospitais (pedido da cliente, no FAQ).
O domínio provavelmente será classificado como saúde; por isso nada do quiz
ou texto livre vai para a Meta, só o evento `Lead` com `value`/`currency`.
Como a URL não é mais limpa (exigência do Lead Hub), o pixel passa a ver os
`utm_*` do endereço: use nomes neutros nas UTMs dos anúncios (ex.: IDs ou
`{{campaign.id}}`), sem termos de saúde.

## Deploy

Estático: Netlify/Cloudflare Pages apontando para a raiz do repositório, sem build.

# LP — Dra. Leila Freire (Rinoplastia e Harmonia da Face)

Landing page de qualificação para tráfego pago (Meta Ads). Site estático
(HTML/CSS/JS puro, sem build), mobile-first, no mesmo padrão da LP da
Dra. Letícia Caproni (`pkposites/draleticiacaproni`, ver `PADRAO-LP.md` lá).

```
index.html        página
styles.css        estilos (paleta grafite + rosé, Cormorant Garamond + Jost)
script.js         quiz/triagem, WhatsApp, tracking, CAPI
privacidade.html  política de privacidade (LGPD)
assets/           favicon e fotos
worker/           Cloudflare Worker da API de Conversões (CAPI)
```

## Seções (ordem)

1. Header fixo · 2. Hero com foto · 3. Faixa de formação (USP, FAMERP, Santa Casa)
4. Sobre · 5. Diferenciais · 6. **A consulta** (particular, 1h, presencial ou online)
7. Como funciona (4 etapas) · 8. Instagram / YouTube · 9. FAQ (valores, convênio,
hospitais, idade) · 10. **Triagem (quiz)** · 11. Caixinha de confirmação + WhatsApp
12. Localização (Pinheiros + mapa) · 13. CTA final · Footer com CRM/RQE

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

## Pendências antes de ir ao ar

- [ ] **Fotos**: `assets/dra-leila.webp` (hero, retrato 4:5) e
      `assets/dra-leila-sobre.webp` (seção Sobre). Sem elas aparece o monograma "LF".
- [ ] `assets/og-image.jpg` (1200×630) para compartilhamento.
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

O texto cita rinoplastia, cirurgia e hospitais (pedido da cliente, no FAQ).
O domínio provavelmente será classificado como saúde; por isso nada do quiz,
nomes de campanha/anúncio ou texto livre vai para a Meta — só o evento `Lead`
com `value`/`currency` (mesma proteção da LP Caproni).

## Deploy

Estático: Netlify/Cloudflare Pages apontando para a raiz do repositório, sem build.

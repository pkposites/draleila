document.getElementById('year').textContent = new Date().getFullYear();

/* ============================================================
   CONFIG
============================================================= */
var WHATSAPP_NUMBER = "551130642676"; // (11) 3064-2676

/* ============================================================
   CAPTURA DE ORIGEM DO LEAD (UTM + parâmetros dinâmicos do Meta Ads)
   Captura na URL no carregamento da página e persiste em
   sessionStorage, para não perder a origem se o usuário navegar
   pela página antes de preencher/enviar o formulário.
============================================================= */
var ORIGEM_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'campaign_name', 'campaign_id', 'adset_name', 'adset_id', 'ad_name', 'ad_id',
  'site_source_name', 'fbclid', 'gclid'
];

/* Resolve a fonte real (Instagram/Facebook) a partir do macro do Meta Ads
   {{site_source_name}}, que retorna "fb" ou "ig" — mais confiável que
   depender só de utm_source, que costuma vir fixo como "facebook". */
function resolveFonte(origem) {
  var siteSource = (origem.site_source_name || '').toLowerCase();
  if (siteSource === 'ig') return 'Instagram';
  if (siteSource === 'fb') return 'Facebook';
  if (origem.fbclid) return 'Facebook/Instagram (Meta Ads)';
  if (origem.gclid) return 'Google Ads';

  var source = (origem.utm_source || '').toLowerCase();
  if (source.indexOf('instagram') !== -1 || source === 'ig') return 'Instagram';
  if (source.indexOf('facebook') !== -1 || source === 'fb') return 'Facebook';
  if (source === 'google') return 'Google Ads';
  return origem.utm_source || '';
}
var ORIGEM_STORAGE_KEY = 'lead_origem_params';

function captureOrigemParams() {
  var urlParams = new URLSearchParams(window.location.search);
  var found = {};

  ORIGEM_PARAMS.forEach(function (key) {
    var value = urlParams.get(key);
    if (value) found[key] = value;
  });

  if (Object.keys(found).length > 0) {
    try {
      var existing = JSON.parse(sessionStorage.getItem(ORIGEM_STORAGE_KEY) || '{}');
      sessionStorage.setItem(ORIGEM_STORAGE_KEY, JSON.stringify(Object.assign(existing, found)));
    } catch (e) { /* sessionStorage indisponível: segue só com o objeto em memória */ }
  }

  return found;
}

function getOrigemParams() {
  var fromUrl = captureOrigemParams();
  var stored = {};
  try {
    stored = JSON.parse(sessionStorage.getItem(ORIGEM_STORAGE_KEY) || '{}');
  } catch (e) { /* sessionStorage indisponível */ }

  return Object.assign({}, stored, fromUrl);
}

function buildOrigemMessageBlock(origem) {
  var campanha = origem.campaign_name || origem.utm_campaign || '';
  var conjunto = origem.adset_name || '';
  var anuncio = origem.ad_name || origem.utm_content || '';
  var termo = origem.utm_term || '';
  var fonte = resolveFonte(origem);

  // "Fonte do lead:" sempre é a primeira linha do bloco (mesmo padrão da
  // LP Excalibur), mesmo sem UTM — nesse caso cai no fallback "Direto/Orgânico".
  var linhas = ['Fonte do lead: ' + (fonte || 'Direto/Orgânico')];
  if (campanha) linhas.push('Campanha: ' + campanha);
  if (conjunto) linhas.push('Conjunto: ' + conjunto);
  if (anuncio) linhas.push('Anúncio: ' + anuncio);
  if (termo) linhas.push('Termo/Público: ' + termo);

  return '\n\n' + linhas.join('\n');
}

/* Captura assim que o script carrega, para não perder o clique inicial */
captureOrigemParams();

/* ============================================================
   CAPI (Conversions API) — envio server-side via Cloudflare Worker
   Espelha o lead_contato (Lead) no servidor, com o mesmo
   event_id do fbq() do navegador (dedupe automático no Ads Manager).
   Preencher CAPI_ENDPOINT com a URL do worker depois do deploy
   (ex: https://draleilacapi.<subdomínio>.workers.dev). Vazio = desligado.
============================================================= */
var CAPI_ENDPOINT = ''; // TODO: URL do worker (pasta worker/)
var LEAD_REF_KEY = 'lead_ref';
// Valor fixo do lead (a Meta exige número + moeda; sem valor real, usa 1 BRL).
var LEAD_VALUE = 1;
var LEAD_CURRENCY = 'BRL';
// Parâmetros de URL que podem ir para a Meta: nenhum deles carrega texto livre.
var SAFE_URL_PARAMS = ['fbclid', 'utm_source', 'utm_medium', 'utm_id', 'campaign_id', 'adset_id', 'ad_id'];

// ID persistente do visitante (vira external_id na Meta). Criado no <head>.
function getOrCreateLeadRef() {
  try {
    var ref = window.leadRef || localStorage.getItem(LEAD_REF_KEY);
    if (!ref) {
      ref = 'ref-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(LEAD_REF_KEY, ref);
    }
    return ref;
  } catch (e) {
    return window.leadRef || '';
  }
}

// URL da página sem querystring sensível (só os parâmetros de SAFE_URL_PARAMS).
function cleanPageUrl() {
  try {
    var url = new URL(window.location.href);
    var clean = new URL(url.origin + url.pathname);
    SAFE_URL_PARAMS.forEach(function (k) {
      var v = url.searchParams.get(k);
      if (v) clean.searchParams.set(k, v);
    });
    return clean.toString();
  } catch (e) {
    return window.location.origin + window.location.pathname;
  }
}

// fbc: cookie _fbc do pixel; sem ele, montado a partir do fbclid do anúncio
// no formato fb.1.<hora do clique em ms>.<fbclid>.
function getFbc() {
  var cookie = getCookie('_fbc');
  if (cookie) return cookie;
  try {
    var saved = JSON.parse(localStorage.getItem('lead_fbclid') || 'null');
    if (saved && saved.v) return 'fb.1.' + (saved.ts || Date.now()) + '.' + saved.v;
  } catch (e) {}
  var fbclid = getOrigemParams().fbclid;
  return fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '';
}

function getCookie(name) {
  var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

function generateEventId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* Envia ao worker só o necessário para a Meta reconhecer a pessoa:
   fbp, fbc, external_id e, quando digitados, telefone e primeiro nome
   (o worker aplica o hash SHA-256). Nada de quiz, campanha ou anúncio. */
function sendToCapi(metaEventName, eventId, extra) {
  if (!CAPI_ENDPOINT) return; // worker ainda não configurado nesta LP

  var ref = getOrCreateLeadRef();
  var payload = Object.assign({
    event_name: metaEventName,
    event_id: eventId,
    event_source_url: cleanPageUrl(),
    fbp: getCookie('_fbp'),
    fbc: getFbc(),
    external_id: ref,
    ref: ref
  }, extra || {});

  fetch(CAPI_ENDPOINT.replace(/\/$/, '') + '/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(function () { /* falha no envio server-side não deve travar o fluxo do usuário */ });
}

/* ============================================================
   TRACKING HELPERS
   - lead_contato: clique no botão de WhatsApp já liberado
     -> fbq track 'Lead' com value 1 e currency BRL
   Também é espelhado na Conversions API (server-side) com o
   mesmo event_id, para dedupe automático no Ads Manager.
   - quiz_resposta / quiz_completo / case_view / cta_click: ficam só no
     dataLayer, sem as respostas. NÃO vão para a Meta (dados sensíveis).
============================================================= */
function trackEvent(eventName, params) {
  params = params || {};
  window.dataLayer = window.dataLayer || [];
  // dataLayer: só o nome do evento e parâmetros neutros (sem respostas do quiz).
  dataLayer.push(Object.assign({ event: eventName }, params));

  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
  if (typeof fbq !== 'function') return;

  if (eventName === 'lead_contato') {
    var leadId = generateEventId();
    fbq('track', 'Lead', { value: LEAD_VALUE, currency: LEAD_CURRENCY }, { eventID: leadId });
    sendToCapi('Lead', leadId, {
      value: LEAD_VALUE,
      currency: LEAD_CURRENCY,
      phone: (leadTelefoneInput && leadTelefoneInput.value.trim()) || '',
      first_name: ((leadNomeInput && leadNomeInput.value.trim()) || '').split(/\s+/)[0] || ''
    });
  }
  // Quiz, cases e CTAs NÃO vão para a Meta: as respostas do quiz contêm
  // dados sensíveis e a Meta bloqueia domínios que enviam esse tipo de dado.
}

function buildWhatsappUrl() {
  var nome = (leadNomeInput && leadNomeInput.value.trim()) || '';
  var telefone = (leadTelefoneInput && leadTelefoneInput.value.trim()) || '';

  var msg = nome ? "Olá! Meu nome é " + nome + "." : "Olá!";
  msg += " Vim pela página da Dra. Leila Freire e gostaria de agendar "
    + "uma consulta de avaliação.";
  if (telefone) msg += "\n\nMeu WhatsApp: " + telefone;

  var respondidas = QUIZ_FIELDS.filter(function (f) { return quizAnswers[f.key]; });
  if (respondidas.length) {
    msg += "\n\nMinhas respostas:";
    respondidas.forEach(function (f) {
      msg += "\n- " + f.label + ": " + quizAnswers[f.key];
    });
    if (quizTier) msg += "\n\nTriagem: " + TIERS[quizTier].whatsapp;
  }

  msg += buildOrigemMessageBlock(getOrigemParams());

  return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
}

/* ============================================================
   QUIZ INTERATIVO / TRIAGEM
   5 perguntas (necessidade, situação, prazo, formato da consulta e
   investimento). Cada opção tem data-score; a soma define a prioridade:
     - quente:      aceita a consulta particular + intenção alta
     - consideracao: interessada(o), mas ainda com dúvidas/valores
     - inicial:     ainda conhecendo / só quer ideia de valores
   Nenhuma resposta bloqueia o WhatsApp: a triagem só muda a orientação
   exibida e vai na mensagem pra equipe priorizar o atendimento.
============================================================= */
var QUIZ_FIELDS = [
  { key: 'objetivo', label: 'O que quer melhorar' },
  { key: 'situacao', label: 'Situação' },
  { key: 'prazo', label: 'Prazo' },
  { key: 'formato', label: 'Formato da consulta' },
  { key: 'investimento', label: 'Sobre a consulta particular' }
];

var TIERS = {
  quente: {
    tag: 'Atendimento prioritário',
    title: 'Seu próximo passo é a consulta com a Dra. Leila',
    text: 'Pelas suas respostas, a consulta é o caminho natural agora. Ao falar com a equipe, ela já recebe o seu perfil e prioriza o seu agendamento.',
    whatsapp: 'prioridade alta (quer agendar)'
  },
  consideracao: {
    tag: 'Conhecendo a consulta',
    title: 'Vale entender bem a consulta antes de decidir',
    text: 'Na consulta particular de 1 hora, presencial em Pinheiros ou online, a Dra. Leila faz uma análise detalhada da sua face, indica as melhores opções para o seu caso e esclarece todas as suas dúvidas. O valor da consulta é informado pela equipe no WhatsApp.',
    whatsapp: 'em consideração (quer entender valores/condições)'
  },
  inicial: {
    tag: 'Conhecendo as possibilidades',
    title: 'Sem pressa: entenda primeiro como funciona',
    text: 'Os valores de honorários e de hospital só são informados após a consulta, porque cada planejamento é individual e depende da avaliação da sua face. Enquanto isso, conheça o trabalho da Dra. e fale com a equipe quando quiser.',
    whatsapp: 'fase inicial (conhecendo, sem prazo definido)',
    links: true
  }
};

var quizAnswers = {};
var quizScores = {};
var quizTier = '';
var quizSteps = document.querySelectorAll('.quiz-step');
var quizDots = document.querySelectorAll('.quiz-dot');
var quizResult = document.getElementById('quiz-result');
var quizResultTag = document.getElementById('quiz-result-tag');
var quizResultTitle = document.getElementById('quiz-result-title');
var quizResultText = document.getElementById('quiz-result-text');
var quizResultSummary = document.getElementById('quiz-result-summary');
var quizRestart = document.getElementById('quiz-restart');
var quizContinue = document.getElementById('quiz-continue');
var currentQuizStep = 1;
var totalQuizSteps = quizSteps.length;

function goToQuizStep(n) {
  quizSteps.forEach(function (step) {
    step.hidden = Number(step.dataset.step) !== n;
  });
  quizDots.forEach(function (dot) {
    dot.classList.toggle('active', Number(dot.dataset.dot) <= n);
  });
  currentQuizStep = n;
}

function computeTier() {
  var total = 0;
  Object.keys(quizScores).forEach(function (k) { total += quizScores[k]; });
  var investimento = quizScores.investimento || 0;

  if (investimento >= 3 && total >= 6) return 'quente';
  if (investimento === 0) return 'inicial';
  return total >= 3 ? 'consideracao' : 'inicial';
}

function finishQuiz() {
  quizSteps.forEach(function (step) { step.hidden = true; });
  quizTier = computeTier();
  var tier = TIERS[quizTier];

  quizResultTag.textContent = tier.tag;
  quizResultTitle.textContent = tier.title;
  quizResultText.textContent = tier.text;
  quizResultSummary.textContent = QUIZ_FIELDS
    .filter(function (f) { return quizAnswers[f.key]; })
    .map(function (f) { return f.label + ': ' + quizAnswers[f.key]; })
    .join(' · ');

  var oldLinks = quizResult.querySelector('.quiz-result-links');
  if (oldLinks) oldLinks.remove();
  if (tier.links) {
    var links = document.createElement('p');
    links.className = 'quiz-result-links';
    links.innerHTML = '<a href="#consulta">Como é a consulta</a> · '
      + '<a href="#duvidas">Dúvidas sobre valores</a> · '
      + '<a href="https://www.instagram.com/draleilafreire/" target="_blank" rel="noopener" class="js-social-out">Instagram da Dra.</a>';
    quizResultText.insertAdjacentElement('afterend', links);
    var out = links.querySelector('.js-social-out');
    if (out) out.addEventListener('click', markSocialOut);
  }

  quizResult.hidden = false;
  // Só o nível da triagem (sem respostas) vai pro dataLayer; nada vai pra Meta.
  trackEvent('quiz_completo', { triagem: quizTier });
}

document.querySelectorAll('.quiz-option').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var field = btn.dataset.field;
    quizAnswers[field] = btn.dataset.value;
    quizScores[field] = Number(btn.dataset.score) || 0;

    btn.parentElement.querySelectorAll('.quiz-option').forEach(function (s) {
      s.classList.remove('selected');
    });
    btn.classList.add('selected');

    trackEvent('quiz_resposta');

    setTimeout(function () {
      if (currentQuizStep < totalQuizSteps) {
        goToQuizStep(currentQuizStep + 1);
      } else {
        finishQuiz();
      }
    }, 250);
  });
});

if (quizContinue) {
  quizContinue.addEventListener('click', function () {
    callAttentionToCheckbox('quiz_continuar');
  });
}

if (quizRestart) {
  quizRestart.addEventListener('click', function () {
    quizAnswers = {};
    quizScores = {};
    quizTier = '';
    document.querySelectorAll('.quiz-option.selected').forEach(function (btn) {
      btn.classList.remove('selected');
    });
    quizResult.hidden = true;
    goToQuizStep(1);
    document.getElementById('quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ============================================================
   CAIXA DE CONFIRMAÇÃO -> LIBERA O BOTÃO DE WHATSAPP
   A qualificação do lead acontece aqui: o usuário leu/entendeu a LP
   e marcou a caixinha confirmando interesse antes de poder seguir.
============================================================= */
var confirmCheckbox = document.getElementById('confirm-interesse');
var whatsappQualificado = document.getElementById('whatsapp-qualificado');
var confirmHint = document.getElementById('confirm-hint');
var optionalFields = document.getElementById('optional-fields');
var leadNomeInput = document.getElementById('lead-nome');
var leadTelefoneInput = document.getElementById('lead-telefone');

confirmCheckbox.addEventListener('change', function () {
  if (confirmCheckbox.checked) {
    whatsappQualificado.classList.add('unlocked');
    whatsappQualificado.setAttribute('aria-disabled', 'false');
    confirmHint.classList.add('hidden');
    optionalFields.hidden = false;
  } else {
    whatsappQualificado.classList.remove('unlocked');
    whatsappQualificado.setAttribute('aria-disabled', 'true');
    confirmHint.classList.remove('hidden');
    optionalFields.hidden = true;
  }
});

var confirmCheckLabel = document.getElementById('confirm-check');
var confirmBox = document.getElementById('confirm-box');

function callAttentionToCheckbox(origem) {
  confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Reinicia a animação mesmo se o usuário clicar de novo rapidamente
  confirmCheckLabel.classList.remove('attention');
  // eslint-disable-next-line no-unused-expressions
  void confirmCheckLabel.offsetWidth; // força reflow pra reiniciar a animação CSS
  confirmCheckLabel.classList.add('attention');

  clearTimeout(callAttentionToCheckbox._timer);
  callAttentionToCheckbox._timer = setTimeout(function () {
    confirmCheckLabel.classList.remove('attention');
  }, 1600);

  trackEvent('cta_click', { origem: origem || 'whatsapp_bloqueado_sem_confirmar' });
}

whatsappQualificado.addEventListener('click', function (e) {
  e.preventDefault();
  if (!confirmCheckbox.checked) {
    callAttentionToCheckbox('whatsapp_bloqueado_sem_confirmar');
    return;
  }

  // Abre a aba em branco AGORA (síncrono com o clique, exigido pelo Safari/iOS
  // para não ser bloqueado como pop-up) e só troca a URL dela depois do
  // tracking, dando tempo do fetch do CAPI sair antes do WhatsApp assumir.
  var whatsappWindow = window.open('', '_blank');
  trackEvent('lead_contato', { origem: 'botao_qualificado' });

  var leadNome = (leadNomeInput && leadNomeInput.value.trim()) || '';
  if (leadNome && window.LeadHub && typeof window.LeadHub.identify === 'function') {
    window.LeadHub.identify({ name: leadNome });
  }

  setTimeout(function () {
    var url = buildWhatsappUrl();
    // Lead Hub intercepta o clique e injeta o código de rastreio na URL;
    // se o script não carregar por qualquer motivo, segue com a URL normal.
    var destino = window.LeadHub ? window.LeadHub.whatsappUrl(url) : url;
    if (whatsappWindow) {
      whatsappWindow.location.href = destino;
    } else {
      window.location.href = destino; // pop-up bloqueado: segue na mesma aba
    }
  }, 300);
});

/* ============================================================
   DEMAIS CTAs (header, CTA final e barra fixa mobile)
   Estes NÃO abrem o WhatsApp diretamente — levam até a caixinha de
   confirmação com o mesmo destaque (chacoalhão + cor) do botão
   bloqueado, já deixando claro o que falta pra liberar o contato.
   O único caminho até o WhatsApp é o botão liberado pela caixinha.
============================================================= */
function goToConfirmBox(e, origem) {
  if (e) e.preventDefault();
  callAttentionToCheckbox(origem);
}

var ctaHeaderScroll = document.querySelector('.header-cta');
if (ctaHeaderScroll) {
  ctaHeaderScroll.addEventListener('click', function (e) {
    goToConfirmBox(e, 'cta_header');
  });
}

var ctaHeroScroll = document.getElementById('cta-hero-scroll');
if (ctaHeroScroll) {
  ctaHeroScroll.addEventListener('click', function (e) {
    goToConfirmBox(e, 'cta_hero');
  });
}

var ctaFinalScroll = document.getElementById('cta-final-scroll');
if (ctaFinalScroll) {
  ctaFinalScroll.addEventListener('click', function (e) {
    goToConfirmBox(e, 'cta_final');
  });
}

var ctaStickyScroll = document.getElementById('cta-sticky-scroll');
if (ctaStickyScroll) {
  ctaStickyScroll.addEventListener('click', function (e) {
    goToConfirmBox(e, 'barra_fixa_mobile');
  });
}

/* ============================================================
   BARRA FIXA MOBILE: esconder perto do rodapé
   Some quando a seção de qualificação entra na tela — a partir dali
   o CTA final já cumpre o mesmo papel, e ter os dois juntos empilhados
   no fim da página é redundante.
============================================================= */
var mobileStickyCta = document.querySelector('.mobile-sticky-cta');
if (mobileStickyCta && 'IntersectionObserver' in window) {
  var qualifySection = document.getElementById('qualificacao');
  var stickyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      // Esconde assim que a seção de qualificação entra na tela e continua
      // escondida dali pra baixo (CTA final, rodapé) — só reaparece se o
      // usuário rolar de volta pra cima, antes de chegar nela.
      var jaPassouDaSecao = entry.boundingClientRect.top <= 0;
      mobileStickyCta.classList.toggle('is-hidden', entry.isIntersecting || jaPassouDaSecao);
    });
  }, { threshold: 0 });
  stickyObserver.observe(qualifySection);
}

/* ============================================================
   "BEM-VINDO DE VOLTA" — RETORNO DO INSTAGRAM / YOUTUBE
   Os links das redes abrem em nova aba, então esta aba da LP nunca
   fecha. Se a pessoa voltar pra cá depois, mostramos um convite
   puxando de volta pro funil.
============================================================= */
var welcomeBackToast = document.getElementById('welcome-back-toast');
var welcomeBackCta = document.getElementById('welcome-back-cta');
var wentToSocial = false;

function markSocialOut(e) {
  wentToSocial = true;
  var rede = (e && e.currentTarget && e.currentTarget.dataset.social) || 'instagram';
  trackEvent('cta_click', { origem: 'card_' + rede });
}

document.querySelectorAll('.social-card').forEach(function (card) {
  card.addEventListener('click', markSocialOut);
});

if (welcomeBackToast) {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && wentToSocial) {
      wentToSocial = false;
      welcomeBackToast.hidden = false;
      trackEvent('cta_click', { origem: 'retorno_redes_toast' });

      clearTimeout(welcomeBackToast._timer);
      welcomeBackToast._timer = setTimeout(function () {
        welcomeBackToast.hidden = true;
      }, 8000);
    }
  });

  if (welcomeBackCta) {
    welcomeBackCta.addEventListener('click', function () {
      welcomeBackToast.hidden = true;
      clearTimeout(welcomeBackToast._timer);
      var destino = quizTier ? 'qualificacao' : 'quiz';
      document.getElementById(destino).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

var mapLink = document.getElementById('map-link');
if (mapLink) {
  mapLink.addEventListener('click', function () {
    trackEvent('cta_click', { origem: 'google_maps' });
  });
}

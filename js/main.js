import { LINES, VITOLAS, LINE_COPY, COUNTRIES, T, SHOP, productImg, productUrl, chf } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t * t * (3 - 2 * t);
const root = document.documentElement;
root.classList.add('js');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

let lang = store.get('ch_lang') || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'fr');
let qty = 'single';
let shopLine = 0;
let lineIdx = 0;
const mq = matchMedia('(max-width: 900px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const t = k => (T[lang][k] ?? T.fr[k] ?? k);

/* ---------------- text splitting ---------------- */
function split(el) {
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--d', i++);
          wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
}
function splitManifesto() {
  const el = $('#manifesto-text');
  el.innerHTML = el.textContent.split(/\s+/).map(w => `<span class="mw">${w}</span>`).join(' ');
}

/* ---------------- builders ---------------- */
const band = l => l.band;

function buildMarquee() {
  const items = t('marquee');
  const set = items.map(x => `<span>${x}<img src="img/scorpion.png" alt=""></span>`).join('');
  $('#marquee').innerHTML = set.repeat(4);
}

function blendRows(line) {
  const C = COUNTRIES[lang];
  return [
    [t('col.wrapper'), C[line.blend.wrapper]],
    [t('col.binder'), C[line.blend.binder]],
    [t('col.filler'), line.blend.filler.map(c => C[c]).join(' / ')],
  ];
}
const minPrice = Math.min(...VITOLAS.filter(v => v.stock).map(v => v.single));

function buildLines() {
  const panel = $('#line-panel');
  panel.innerHTML = LINES.map((l, i) => {
    const c = LINE_COPY[lang][l.key];
    const gauge = Array.from({ length: 10 }, (_, k) => `<i class="${k < l.strength ? 'on' : ''}" style="height:${8 + k * 1.6}px"></i>`).join('');
    return `<article class="lp${i === lineIdx ? ' is-on' : ''}" data-i="${i}" style="--accent:${l.accent}">
      <p class="lp__n"><b>N° 0${i + 1}</b> / 04</p>
      <h3 class="lp__name">${l.name}</h3>
      <p class="lp__tag">${c.tag}</p>
      <p class="lp__intro">${c.intro}</p>
      <div class="lp__meta">
        <div><h4>${t('col.strength')}</h4><div class="gauge" aria-label="${t('col.strength')} ${l.strength}/10">${gauge}<b>${l.strength}<small>/10</small></b></div></div>
        <div><h4>${t('col.blend')}</h4><div class="blend">${blendRows(l).map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div></div>
        <div class="lp__notesbox"><h4>${t('col.notes')}</h4><div class="lp__notes">${c.notes.map(n => `<span>${n}</span>`).join('')}</div></div>
        <div class="lp__momentbox"><h4>${t('col.moment')}</h4><p class="lp__moment">${c.moment}</p></div>
      </div>
      <div class="lp__foot">
        <p class="lp__price">${t('col.from')} <strong>${chf(minPrice)}</strong> ${t('col.single')}</p>
        <a class="btn btn--line" href="#shop" data-goto-line="${i}"><span>${t('col.see')}</span></a>
      </div>
    </article>`;
  }).join('');
  $('#line-nav').innerHTML = LINES.map((l, i) =>
    `<button type="button" data-line="${i}" class="${i === lineIdx ? 'is-on' : ''}" style="--c:${band(l)}"><i></i>${l.name}</button>`).join('');
  $('#line-moods').innerHTML = LINES.map((l, i) =>
    `<div class="${i === lineIdx ? 'is-on' : ''}" style="background-image:url(img/mood-${l.key}.webp)"></div>`).join('');
}

function buildOrigins() {
  const C = COUNTRIES[lang];
  $('#origins').innerHTML = `<table><caption>${t('ana.table')}</caption>
    <thead><tr><th></th><th>${t('col.wrapper')}</th><th>${t('col.binder')}</th><th>${t('col.filler')}</th></tr></thead>
    <tbody>${LINES.map(l => `<tr><th style="--c:${band(l)}"><i></i>${l.name}</th><td>${C[l.blend.wrapper]}</td><td>${C[l.blend.binder]}</td><td>${l.blend.filler.map(c => C[c]).join(' / ')}</td></tr>`).join('')}</tbody></table>`;
}

const ICON_CLOCK = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.6"/></svg>';
const ICON_ARROW = '<svg viewBox="0 0 18 10"><path d="M0 5h16M12 1l4 4-4 4"/></svg>';

function buildShop(animate = false) {
  $('#shop-tabs').innerHTML = LINES.map((l, i) =>
    `<button type="button" role="tab" aria-selected="${i === shopLine}" data-shop="${i}" style="--c:${band(l)}"><i></i>${l.name}</button>`).join('');
  const l = LINES[shopLine], c = LINE_COPY[lang][l.key];
  $('#shop').style.setProperty('--accent', l.accent);
  $('#shop-line').innerHTML = `<h3>${l.name}</h3><p>${c.tag}</p>
    <span class="blend-inline">${blendRows(l).map(([k, v]) => `${k} ${v}`).join(' · ')} · ${t('shop.strength')} ${l.strength}/10</span>`;
  const tray = $('#tray');
  tray.innerHTML = VITOLAS.map((v, k) => {
    const price = v.stock
      ? `<p class="card__price">${chf(qty === 'box' ? v.box : v.single)}<small>${qty === 'box' ? t('shop.box') : t('shop.single')}</small></p>`
      : `<p class="card__price">${t('shop.outd')}</p>`;
    return `<a class="card${v.stock ? '' : ' is-out'}" href="${productUrl(l, v, lang)}" target="_blank" rel="noopener" style="--i:${k}">
      ${v.stock ? '' : `<span class="card__flag">${t('shop.out')}</span>`}
      <div class="card__stage"><img src="${productImg(l, v)}" alt="${l.name} ${v.name}" loading="lazy"></div>
      <div class="card__body">
        <h4 class="card__name">${v.name}</h4>
        <div class="card__meta"><span>${ICON_CLOCK}${v.time} ${t('shop.time')}</span><span>${t('shop.strength')} ${l.strength}/10</span></div>
        ${price}
        <span class="card__btn">${v.stock ? t('shop.order') : t('shop.out')} ${ICON_ARROW}</span>
      </div>
    </a>`;
  }).join('');
  if (animate) { tray.classList.remove('is-swap'); void tray.offsetWidth; tray.classList.add('is-swap'); tray.scrollLeft = 0; }
  $$('.qty button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.qty === qty)));
  $('.qty').classList.toggle('is-box', qty === 'box');
}

function buildRitual() {
  $('#dial-stops').innerHTML = LINES.map((l, i) =>
    `<li class="stop" style="--c:${band(l)}"><span class="stop__time">${t('rit.m' + (i + 1))}</span><h3><i></i>${l.name}</h3><p>${LINE_COPY[lang][l.key].moment}</p></li>`).join('');
}

function buildFootLines() {
  $('#foot-lines').innerHTML = LINES.map((l, i) => `<li><a href="#shop" data-goto-line="${i}" style="--c:${band(l)}"><i></i>${l.name}</a></li>`).join('');
}

function applyLang(first = false) {
  root.lang = lang;
  document.title = t('meta.title');
  $('meta[name="description"]').setAttribute('content', t('meta.desc'));
  $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (typeof v === 'string') el.innerHTML = v; });
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('.nav__brand small').textContent = lang === 'de' ? 'Zigarren aus Nicaragua' : 'Cigares du Nicaragua';
  $$('[data-legal]').forEach(a => { a.href = lang === 'de' ? `${SHOP}/${a.dataset.legal}/` : `${SHOP}/fr/${a.dataset.legal}/`; });
  $('#shop-all').href = lang === 'de' ? `${SHOP}/shop/` : `${SHOP}/fr/shop/`;
  buildMarquee(); buildLines(); buildOrigins(); buildShop(); buildRitual(); buildFootLines();
  $$('[data-split]').forEach(split);
  splitManifesto();
  if (!first) {
    $$('[data-split], [data-reveal]').forEach(el => { if (!el.closest('#hero') || heroShown) el.classList.add('is-in'); });
    window.ScrollTrigger && ScrollTrigger.refresh();
    updateManifesto(lastManifesto);
  }
}

/* ---------------- gate ---------------- */
let heroShown = false;
const gate = $('#gate');
function showHero() {
  heroShown = true;
  $$('#hero [data-split]').forEach(el => el.classList.add('is-in'));
  ['.hero__eyebrow', '.hero__text', '.hero__ctas', '.hero__foot'].forEach((s, i) => {
    const el = $(s); el.style.transition = `opacity 1.2s ${0.5 + i * 0.12}s, transform 1.4s cubic-bezier(.19,1,.22,1) ${0.5 + i * 0.12}s`;
    el.style.opacity = 1; el.style.transform = 'none';
  });
  const v = $('.hero__smoke'); v && v.play().catch(() => {});
}
function openGate() {
  if (gate.classList.contains('is-open')) return;
  gate.classList.add('is-open');
  document.body.classList.remove('is-loading', 'is-gated');
  lenis && lenis.start();
  intro = false;
  setTimeout(showHero, 500);
  setTimeout(() => { gate.classList.add('is-gone'); }, 1900);
  setTimeout(() => { gate.remove(); }, 2700);
}
['.hero__eyebrow', '.hero__text', '.hero__ctas', '.hero__foot'].forEach(s => { const el = $(s); el.style.opacity = 0; el.style.transform = 'translateY(26px)'; });

/* ---------------- boot ---------------- */
let lenis = null, sceneApi = null, intro = true;
applyLang(true);
$('#year').textContent = new Date().getFullYear();

$$('.lang button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.lang === lang) return;
  lang = b.dataset.lang; store.set('ch_lang', lang); applyLang();
}));

const verified = store.get('ch_age') === '1';
requestAnimationFrame(() => gate.classList.add('is-ready'));
if (verified) { gate.classList.add('is-auto'); }
$('#gate-yes').addEventListener('click', () => { store.set('ch_age', '1'); openGate(); });
$('#gate-no').addEventListener('click', () => { $('#gate-denied').hidden = false; });

function whenLibs() {
  return new Promise(res => {
    const ok = () => window.gsap && window.ScrollTrigger && window.Lenis;
    if (ok()) return res(true);
    let n = 0; const id = setInterval(() => { if (ok() || ++n > 100) { clearInterval(id); res(ok()); } }, 50);
  });
}

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

(async function init() {
  const libs = await whenLibs();
  if (webglOK()) {
    try {
      const { createScene } = await import('./scene.js?v=6');
      sceneApi = await createScene($('#stage'), { mobile: mq.matches });
    } catch (e) { console.warn('3D disabled', e); root.classList.add('no-webgl'); }
  } else root.classList.add('no-webgl');

  if (libs) setupScroll(); else fallbackReveal();
  setupUI();
  if (verified) setTimeout(openGate, 1100);
})();

/* ---------------- scroll choreography ---------------- */
const prog = { p1: 0, p2: 0, p3: 0, pl: 0, pe: 0, pf: 0 };
let lastManifesto = 0;
function updateManifesto(p) {
  lastManifesto = p;
  const words = $$('#manifesto-text .mw'), n = words.length;
  words.forEach((w, i) => { w.style.opacity = (0.16 + 0.84 * clamp(p * n * 1.1 - i)).toFixed(3); });
}

function poses() {
  const m = mq.matches;
  let linesNy = 0, anaNy = -0.08;
  if (m) {
    const pin = $('.lines__pin'), head = $('.lines__head'), panel = $('.lp.is-on');
    const H = pin.clientHeight || innerHeight;
    const top = head.offsetTop + head.offsetHeight;
    const bottom = panel ? H - (64 + panel.offsetHeight) : H * 0.5;
    linesNy = 0.5 - ((top + bottom) / 2) / H;
    anaNy = 0.04;
  }
  return m ? {
    hero: { nx: 0.02, ny: 0.3, rz: -1.2, rx: 0.3, s: 0.95, lit: 1, opacity: 1 },
    man: { nx: 0.08, ny: 0.34, rz: -1.52, rx: 0.2, s: 0.8, lit: 1, opacity: 0.35 },
    lines: { nx: 0, ny: linesNy, rz: -Math.PI / 2 + 0.08, rx: 0.5, s: 1.1, lit: 0, opacity: 1 },
    ana: { nx: 0, ny: anaNy, rz: -Math.PI / 2, rx: 0.1, s: 1.05, lit: 0, opacity: 1 },
  } : {
    hero: { nx: 0.3, ny: 0.1, rz: -0.92, rx: 0.3, s: 0.9, lit: 1, opacity: 1 },
    man: { nx: 0.4, ny: 0.04, rz: -0.22, rx: 0.25, s: 0.74, lit: 1, opacity: 0.75 },
    lines: { nx: -0.18, ny: 0.0, rz: -Math.PI / 2 + 0.1, rx: 0.45, s: 0.92, lit: 0, opacity: 1 },
    ana: { nx: 0.21, ny: -0.07, rz: -Math.PI / 2, rx: 0.12, s: 0.84, lit: 0, opacity: 1 },
  };
}
const INTRO = { nx: 0.75, ny: -0.15, rz: -2.2, rx: 0.9, s: 0.7, lit: 1, opacity: 1 };
const mix = (a, b, k) => { const o = {}; for (const p in a) o[p] = a[p] + (b[p] - a[p]) * k; return o; };

function setLine(i) {
  if (i === lineIdx) return;
  lineIdx = i;
  $$('.lp').forEach(el => el.classList.toggle('is-on', +el.dataset.i === i));
  $$('#line-nav button').forEach(el => el.classList.toggle('is-on', +el.dataset.line === i));
  $$('#line-moods div').forEach((el, k) => el.classList.toggle('is-on', k === i));
}

let linesST, anaST;
function setupScroll() {
  gsap.registerPlugin(ScrollTrigger);
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    if (!gate.classList.contains('is-open')) lenis.stop();
  }

  const st = (trigger, start, end, key) => ScrollTrigger.create({ trigger, start, end, onUpdate: s => { prog[key] = s.progress; }, onRefresh: s => { prog[key] = s.progress; } });
  st('#manifesto', 'top bottom', 'top 15%', 'p1');
  ScrollTrigger.create({ trigger: '#manifesto-text', start: 'top 82%', end: 'bottom 40%', onUpdate: s => updateManifesto(s.progress) });
  st('#lines', 'top bottom', 'top top', 'p2');
  linesST = ScrollTrigger.create({
    trigger: '.lines__pin', pin: true, start: 'top top', end: () => '+=' + innerHeight * (mq.matches ? 2.6 : 3.2),
    onUpdate: s => { prog.pl = s.progress; setLine(Math.min(3, Math.floor(s.progress * 4))); },
  });
  st('#anatomy', 'top bottom', 'top top', 'p3');
  anaST = ScrollTrigger.create({
    trigger: '.anatomy__pin', pin: true, start: 'top top', end: () => '+=' + innerHeight * 1.8,
    onUpdate: s => { prog.pe = s.progress; },
  });
  st('#shop', 'top bottom', 'top 30%', 'pf');

  // craft: horizontal on desktop
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = $('#craft-track');
    const dist = () => track.scrollWidth - innerWidth;
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.craft__pin', pin: true, scrub: 0.8, start: 'top top', end: () => '+=' + dist(), invalidateOnRefresh: true,
        onUpdate: s => { $('#craft-bar').style.transform = `scaleX(${s.progress})`; } },
    });
    $$('.step__img img', track).forEach(img => {
      gsap.fromTo(img, { xPercent: -8 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentElement, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
    });
  });

  // carlos parallax
  $$('[data-parallax] img').forEach(img => gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } }));

  // ritual dial
  const path = $('#arc-path'), done = $('#arc-done'), sun = $('#sun'), svg = $('.dial__arc');
  const len = path.getTotalLength();
  done.style.strokeDasharray = len; done.style.strokeDashoffset = len;
  const placeSun = p => {
    const pt = path.getPointAtLength(len * p), r = svg.getBoundingClientRect();
    sun.style.transform = `translate(${pt.x / 1000 * r.width}px, ${pt.y / 300 * r.height}px)`;
    done.style.strokeDashoffset = len * (1 - p);
    const k = Math.min(3, Math.floor(p * 4 * 0.999));
    $$('.stop').forEach((el, i) => el.classList.toggle('is-on', i === k));
  };
  placeSun(0);
  ScrollTrigger.create({ trigger: '#dial', start: 'top 85%', end: 'bottom 35%', scrub: true, onUpdate: s => placeSun(s.progress), onRefresh: s => placeSun(s.progress) });

  // gift fan
  ScrollTrigger.create({ trigger: '#gift-boxes', start: 'top 75%', once: true, onEnter: () => $('#gift-boxes').classList.add('is-in') });

  // drive the 3D scene
  gsap.ticker.add(tick);
  ScrollTrigger.addEventListener('refreshInit', () => { if (sceneApi) sceneApi.cur.line = sceneApi.target.line; });
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());

  setupReveals();
  window.__ch = { lenis, prog, get scene() { return sceneApi; }, get lines() { return linesST; }, get ana() { return anaST; } };
}

const callouts = $$('.callout');
function tick() {
  const P = poses();
  let pose = mix(P.hero, P.man, ease(prog.p1));
  pose = mix(pose, P.lines, ease(prog.p2));
  pose = mix(pose, P.ana, ease(prog.p3));
  if (intro) pose = INTRO;
  $('#line-moods').style.opacity = (prog.p2 * (1 - prog.p3)).toFixed(3);
  $('#ana-glow').classList.toggle('is-on', prog.p3 > 0.6 && prog.pf < 0.5);
  if (!sceneApi) return;
  const T = sceneApi.target;
  Object.assign(T, { nx: pose.nx, ny: pose.ny, rz: pose.rz, rx: pose.rx, s: pose.s, lit: pose.lit });
  T.explode = clamp(prog.pe * 1.25);
  T.opacity = pose.opacity * (1 - prog.pf);
  T.line = prog.p3 > 0.02 ? 3 : lineIdx;
  sceneApi.setVisible(prog.pf < 0.999);
  sceneApi.setSpinSpeed(prog.p2 > 0.5 ? 0.45 : 0.22);

  // anatomy callouts follow the exploded layers
  if (prog.p3 > 0.5 && prog.pf < 1) {
    const e = clamp(prog.pe * 1.25);
    const show = { wrapper: clamp((e - 0.62) / 0.25), binder: clamp((e - 0.25) / 0.25), filler: clamp((e - 0.35) / 0.25) };
    callouts.forEach(c => {
      const a = c.dataset.anchor, p = sceneApi.project(a);
      c.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      c.style.opacity = (show[a] * (1 - prog.pf)).toFixed(3);
    });
  } else callouts.forEach(c => { c.style.opacity = 0; });
}

/* ---------------- reveals ---------------- */
function setupReveals() {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in'); io.unobserve(en.target);
  }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-split], [data-reveal]').forEach(el => { if (!el.closest('#hero')) io.observe(el); });
  // stagger siblings
  $$('.pillars, .service__grid, .contact__list, .carlos__txt').forEach(g => [...g.querySelectorAll('[data-reveal]')].forEach((el, i) => el.style.setProperty('--d', i)));
}
function fallbackReveal() {
  $$('[data-split], [data-reveal]').forEach(el => el.classList.add('is-in'));
  $$('#manifesto-text .mw').forEach(w => { w.style.opacity = 1; });
  document.body.classList.remove('is-loading');
}

/* ---------------- UI ---------------- */
function scrollToEl(target, offset = 0) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.6 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
function scrollToY(y) { if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: 'smooth' }); }

function setupUI() {
  // anchors
  document.addEventListener('click', e => {
    const goto = e.target.closest('[data-goto-line]');
    if (goto) { e.preventDefault(); shopLine = +goto.dataset.gotoLine; buildShop(true); scrollToEl('#shop'); closeMenu(); return; }
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) {
      e.preventDefault(); closeMenu();
      const id = a.getAttribute('href');
      if (id === '#top') scrollToY(0); else scrollToEl(id);
    }
  });

  // lines nav → scroll to that line inside the pin
  $('#line-nav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !linesST) return;
    const i = +b.dataset.line;
    scrollToY(linesST.start + (linesST.end - linesST.start) * ((i + 0.5) / 4));
  });

  // shop
  $('#shop-tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    shopLine = +b.dataset.shop; buildShop(true);
  });
  $('#shop-tabs').addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    shopLine = (shopLine + (e.key === 'ArrowRight' ? 1 : 3)) % 4; buildShop(true);
    $(`#shop-tabs [data-shop="${shopLine}"]`).focus();
  });
  $$('.qty button').forEach(b => b.addEventListener('click', () => { qty = b.dataset.qty; buildShop(true); }));
  $('#gift-cta').addEventListener('click', () => { qty = 'box'; buildShop(true); });

  // nav state
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('.nav__links a');
  const sio = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['lines', 'shop', 'craft', 'carlos', 'contact'].forEach(id => sio.observe($('#' + id)));

  // mobile menu
  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open)); menu.hidden = !open;
    if (lenis) open ? lenis.stop() : lenis.start();
  });

  // videos only play while visible
  const vio = new IntersectionObserver(es => es.forEach(en => {
    const v = en.target;
    if (en.isIntersecting && (heroShown || !v.classList.contains('hero__smoke'))) { v.preload = 'auto'; v.play().catch(() => {}); }
    else v.pause();
  }), { rootMargin: '200px' });
  $$('video').forEach(v => { v.muted = true; vio.observe(v); });

  // gift boxes follow the pointer
  const boxes = $('#gift-boxes');
  boxes.parentElement.addEventListener('pointermove', e => {
    const r = boxes.getBoundingClientRect();
    boxes.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    boxes.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });

  // contact form → mail client
  $('#contact-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target; let ok = true;
    ['name', 'email', 'msg'].forEach(n => {
      const el = f.elements[n]; const bad = !el.value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.classList.toggle('is-bad', bad); if (bad) ok = false;
    });
    if (!ok) return;
    const subject = `${t('form.subject')} — ${f.elements.name.value.trim()}`;
    const body = `${f.elements.msg.value.trim()}\n\n${f.elements.name.value.trim()}\n${f.elements.email.value.trim()}`;
    location.href = `mailto:info@rhums-cigares.ch?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // ember cursor + magnetic buttons (fine pointers only)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    document.body.classList.add('has-cursor');
    const cur = $('.cursor'); let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
    const loop = () => { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener('pointerover', e => cur.classList.toggle('is-link', !!e.target.closest('a, button, .card, input, textarea')));
    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
      b.style.transition = 'transform .6s cubic-bezier(.19,1,.22,1), color .5s, border-color .5s';
    });
  }

  mq.addEventListener('change', () => window.ScrollTrigger && ScrollTrigger.refresh());
}
function closeMenu() {
  const burger = $('#burger'); if (burger.getAttribute('aria-expanded') !== 'true') return;
  burger.setAttribute('aria-expanded', 'false'); $('#menu').hidden = true; lenis && lenis.start();
}

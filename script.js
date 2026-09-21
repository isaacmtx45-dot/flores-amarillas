/* ============================================================
   Día de las Flores Amarillas — toda la escena es SVG generado aquí.
   Nada de imágenes, nada de vídeo: cada flor es un <path> dibujado
   con bézieres y una animación CSS con su propio retraso.

   Mapa del archivo:
     1. utilidades          6. la secuencia (escenas 1 a 5)
     2. geometría del corazón   7. interacción con el corazón
     3. fábrica de flores       8. easter egg: modo cachondito
     4. piezas de la planta     9. easter egg: modo chismosas
     5. el corazón de flores   10. arranque
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------ */

  var NS = 'http://www.w3.org/2000/svg';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var svg      = $('#scene');
  var L = {
    ground: $('#l-ground'),
    sway:   $('#l-sway'),
    plant:  $('#l-plant'),
    crown:  $('#l-crown'),
    intro:  $('#l-intro'),
    fx:     $('#l-fx')
  };
  var heartHit  = $('#heartHit');
  var letterEl  = $('#letter');
  var hintTap    = $('#hintTap');
  var hintTexto  = $('#hintTexto');
  var hintPuntos = $('#hintPuntos');
  var btnMain   = $('#btnMain');
  var btnHot    = $('#btnHot');
  var btnChisme = $('#btnChisme');
  var btnAmor   = $('#btnAmor');
  var pistaInicio = $('#pistaInicio');
  var toastEl   = $('#toast');

  // Respetar a quien pide menos movimiento: la historia es la misma, más corta.
  var SLOW = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;

  var timers = [];
  var runId  = 0;                     // cada reinicio invalida la secuencia anterior

  function sleep(ms) {
    return new Promise(function (res) { timers.push(setTimeout(res, ms * SLOW)); });
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  var toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 3200);
  }

  /* ------------------------------------------------------------
     2. GEOMETRÍA DEL CORAZÓN
     Curva clásica  x = 16 sen³t ,  y = 13cos t − 5cos2t − 2cos3t − cos4t
     La uso para dos cosas: el contorno (silueta) y el test de
     "¿este punto cae dentro?" por lanzamiento de rayo.
     ------------------------------------------------------------ */

  var GROUND = 600, CX = 300, TRUNK_TOP = 440;
  var HK = 11.5, HCX = 300, HCY = 241.5;   // escala y centro del corazón en el viewBox

  function heartPt(t) {
    var s = Math.sin(t);
    return [
      16 * s * s * s,
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    ];
  }
  function toSvg(x, y) { return [HCX + x * HK, HCY - y * HK]; }

  var POLY = (function () {
    var p = [], i;
    for (i = 0; i < 280; i++) p.push(heartPt(i / 280 * Math.PI * 2));
    return p;
  })();

  function inHeart(x, y) {
    var inside = false, i, j, xi, yi, xj, yj;
    for (i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      xi = POLY[i][0]; yi = POLY[i][1];
      xj = POLY[j][0]; yj = POLY[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function heartD() {
    var d = '', i, p;
    for (i = 0; i < POLY.length; i++) {
      p = toSvg(POLY[i][0], POLY[i][1]);
      d += (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  /* ------------------------------------------------------------
     3. FÁBRICA DE FLORES
     Una flor = un <path> con n pétalos + un <circle> de centro.
     Dos nodos por flor: con doscientas flores en pantalla, importa.
     ------------------------------------------------------------ */

  var YELLOWS = ['#f6c026', '#ffd447', '#f2b705', '#ffca28', '#e9a900', '#ffdc63'];

  function petalPath(n, rIn, rOut) {
    var d = '', i;
    var P = function (r, a) { return (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a)).toFixed(2); };
    for (i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var w = (Math.PI / n) * 0.95;
      d += 'M' + P(rIn, a - w) +
           'C' + P(rOut, a - w * 0.85) + ' ' + P(rOut * 1.06, a - w * 0.3) + ' ' + P(rOut * 1.08, a) +
           'C' + P(rOut * 1.06, a + w * 0.3) + ' ' + P(rOut, a + w * 0.85) + ' ' + P(rIn, a + w) + 'Z';
    }
    return d;
  }

  // pos() construye la variable CSS que usan todas las animaciones de escala
  function pos(x, y, rot) {
    return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' +
           (rot === undefined ? '' : ' rotate(' + rot.toFixed(0) + 'deg)');
  }

  function flowerNode(x, y, r, delay, cls) {
    var g = el('g', { 'class': cls || 'fl' });
    g.style.setProperty('--pos', pos(x, y, rnd(0, 360)));
    g.style.animationDelay = (delay * SLOW).toFixed(0) + 'ms';
    var petals = Math.random() < 0.38 ? 6 : (Math.random() < 0.6 ? 7 : 8);
    g.appendChild(el('path', { 'class': 'pt', d: petalPath(petals, r * 0.33, r), fill: pick(YELLOWS) }));
    g.appendChild(el('circle', { 'class': 'core', r: (r * 0.29).toFixed(1) }));
    return g;
  }

  /* ------------------------------------------------------------
     4. PIEZAS DE LA PLANTA
     ------------------------------------------------------------ */

  function buildIntroFlower() {
    L.intro.innerHTML = '';
    var posG   = el('g', { 'class': 'intro-pos' });
    var floatG = el('g', { 'class': 'intro-float' });
    var r = 44, i;

    posG.style.setProperty('--pos', pos(CX, 296));
    floatG.appendChild(el('path', { 'class': 'pt', d: petalPath(8, r * 0.33, r), fill: '#f6c026' }));
    floatG.appendChild(el('path', { 'class': 'pt', d: petalPath(8, r * 0.30, r * 0.78), fill: '#ffd447', opacity: 0.9, transform: 'rotate(22)' }));
    floatG.appendChild(el('circle', { 'class': 'core', r: (r * 0.32).toFixed(1) }));
    for (i = 0; i < 12; i++) {          // textura del centro, solo en esta flor grande
      var a = rnd(0, Math.PI * 2), rr = rnd(2, r * 0.23);
      floatG.appendChild(el('circle', {
        cx: (Math.cos(a) * rr).toFixed(1), cy: (Math.sin(a) * rr).toFixed(1),
        r: 1.2, fill: '#7d5c1d', opacity: 0.5
      }));
    }
    posG.appendChild(floatG);
    L.intro.appendChild(posG);
    return posG;
  }

  function drawGround() {
    L.ground.innerHTML = '';
    [[CX, 62], [CX, 538]].forEach(function (p, i) {
      var ln = el('line', { 'class': 'ground-line', x1: p[0], y1: GROUND, x2: p[1], y2: GROUND });
      ln.style.setProperty('--len', Math.abs(p[1] - p[0]));
      ln.style.animationDelay = (i * 90 * SLOW) + 'ms';
      L.ground.appendChild(ln);
    });
  }

  function dropSeed() {
    var g = el('g', { 'class': 'seed' });
    g.style.setProperty('--pos', pos(CX, GROUND - 5));
    g.appendChild(el('circle', { 'class': 'seed-pulse', r: 5.4, fill: '#d24b2a' }));
    g.appendChild(el('circle', { cx: -1.7, cy: -1.9, r: 1.7, fill: '#ffd76b', opacity: 0.8 }));
    L.ground.appendChild(g);
  }

  var TRUNK_D = 'M300,601 C302,568 296,538 300,508 C304,480 298,460 300,' + TRUNK_TOP;

  function growTrunk() {
    var p = el('path', { 'class': 'trunk', d: TRUNK_D, 'stroke-width': 8.5 });
    L.plant.appendChild(p);
    p.style.setProperty('--len', p.getTotalLength().toFixed(1));
    p.style.setProperty('--dur', (1.75 * SLOW) + 's');

    var base = el('path', { 'class': 'trunk-base', d: 'M285,601 L300,556 L315,601 Z' });
    base.style.animationDelay = (1200 * SLOW) + 'ms';
    L.plant.appendChild(base);
    return 1750;
  }

  // Ramas: del tronco hacia puntos dentro del corazón. Curva cuadrática
  // con el control desplazado en perpendicular para que no salgan rectas.
  var BRANCHES = [
    { sy: 574, u: -4.6, v: -11.2, w: 3.4, bow:  26 },
    { sy: 562, u:  4.8, v: -11.4, w: 3.4, bow: -26 },
    { sy: 536, u: -8.4, v:  -6.2, w: 3.1, bow:  30 },
    { sy: 528, u:  8.6, v:  -6.4, w: 3.1, bow: -30 },
    { sy: 502, u: -9.8, v:   0.4, w: 2.8, bow:  34 },
    { sy: 496, u:  9.9, v:   0.3, w: 2.8, bow: -34 },
    { sy: 476, u: -5.2, v:   5.0, w: 2.5, bow:  22 },
    { sy: 470, u:  5.4, v:   4.8, w: 2.5, bow: -22 },
    { sy: 458, u: -2.6, v:   6.6, w: 2.2, bow:  12 },
    { sy: 450, u:  2.8, v:   6.4, w: 2.2, bow: -12 }
  ];

  function quadAt(sx, sy, qx, qy, ex, ey, t) {
    var m = 1 - t;
    return [m * m * sx + 2 * m * t * qx + t * t * ex,
            m * m * sy + 2 * m * t * qy + t * t * ey];
  }

  function growBranches() {
    var leafSpots = [];
    BRANCHES.forEach(function (b, i) {
      var e  = toSvg(b.u, b.v);
      var sx = CX + (b.bow > 0 ? -1.5 : 1.5), sy = b.sy;
      var dx = e[0] - sx, dy = e[1] - sy, len = Math.hypot(dx, dy);
      var qx = (sx + e[0]) / 2 + (-dy / len) * b.bow;
      var qy = (sy + e[1]) / 2 + ( dx / len) * b.bow;

      var p = el('path', {
        'class': 'branch',
        'stroke-width': b.w,
        d: 'M' + sx + ',' + sy + ' Q' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' ' + e[0].toFixed(1) + ',' + e[1].toFixed(1)
      });
      L.plant.appendChild(p);
      p.style.setProperty('--len', p.getTotalLength().toFixed(1));
      p.style.setProperty('--dur', (0.95 * SLOW) + 's');
      p.style.animationDelay = (i * 125 * SLOW) + 'ms';

      [0.42, 0.68].forEach(function (t, k) {
        var a = quadAt(sx, sy, qx, qy, e[0], e[1], t);
        var b2 = quadAt(sx, sy, qx, qy, e[0], e[1], t + 0.05);
        leafSpots.push({
          x: a[0], y: a[1],
          rot: Math.atan2(b2[1] - a[1], b2[0] - a[0]) * 180 / Math.PI + (k ? 34 : -34),
          delay: i * 125 + 620 + k * 110
        });
      });
    });
    return leafSpots;
  }

  function sproutLeaves(spots) {
    spots.forEach(function (s) {
      var sc = rnd(0.85, 1.25);
      var g = el('path', {
        'class': 'leaf',
        d: 'M0,0 Q' + (9 * sc) + ',' + (-6.5 * sc) + ' ' + (19 * sc) + ',0 Q' + (9 * sc) + ',' + (6.5 * sc) + ' 0,0'
      });
      g.style.setProperty('--pos', pos(s.x, s.y, s.rot));
      g.style.animationDelay = (s.delay * SLOW) + 'ms';
      L.plant.appendChild(g);
    });
  }

  /* ------------------------------------------------------------
     5. EL CORAZÓN DE FLORES
     Rejilla con temblor + anillo de contorno. El orden de floración
     va del pico de abajo hacia afuera: parece que sube por el tronco.
     ------------------------------------------------------------ */

  var crownPts = [];

  function heartPoints() {
    var pts = [], x, y;
    var small = window.innerWidth < 620;
    var d  = small ? 2.4 : 1.95;                 // separación → cuántas flores
    var cx = 0, cy = -2.5;                       // centroide aproximado

    for (y = -17; y <= 12; y += d) {
      for (x = -17; x <= 17; x += d) {
        var jx = x + rnd(-d * 0.34, d * 0.34);
        var jy = y + rnd(-d * 0.34, d * 0.34);
        // erosión: exijo que siga dentro tras alejarlo un 7 % del centro,
        // así ninguna flor interior se desborda del contorno
        if (!inHeart(cx + (jx - cx) * 1.07, cy + (jy - cy) * 1.07)) continue;
        pts.push({ x: jx, y: jy, edge: false });
      }
    }

    var steps = small ? 42 : 56;
    for (var i = 0; i < steps; i++) {
      var p = heartPt(i / steps * Math.PI * 2);
      pts.push({
        x: p[0] * 0.98 + rnd(-0.25, 0.25),
        y: (p[1] - cy) * 0.98 + cy + rnd(-0.25, 0.25),
        edge: true
      });
    }

    pts.forEach(function (p) {
      p.rank = Math.hypot(p.x, p.y + 17) * 0.72 +
               Math.hypot(p.x - cx, p.y - cy) * 0.38 + rnd(-1.1, 1.1);
    });
    pts.sort(function (a, b) { return a.rank - b.rank; });
    return pts;
  }

  var BLOOM_WINDOW = 3500;

  function bloomHeart() {
    L.crown.innerHTML = '';
    crownPts = [];
    var pts  = heartPoints();
    var frag = document.createDocumentFragment();

    pts.forEach(function (p, i) {
      var c = toSvg(p.x, p.y);
      var r = p.edge ? rnd(9, 12.5) : rnd(10, 15.5);
      var delay = (i / pts.length) * BLOOM_WINDOW + rnd(0, 240);
      var node = flowerNode(c[0], c[1], r, delay);
      crownPts.push({ x: c[0], y: c[1], r: r, node: node, calor: Math.random() });
      frag.appendChild(node);
    });

    L.crown.appendChild(frag);
    heartHit.setAttribute('d', heartD());
    return BLOOM_WINDOW + 900;
  }

  /* ------------------------------------------------------------
     6. LA SECUENCIA — escenas 1 a 5
     ------------------------------------------------------------ */

  var state = 'idle';   // idle | playing | done

  function hardReset() {
    runId++;
    clearTimers();
    document.body.classList.remove('done', 'mood-hot', 'mode-chisme', 'final', 'texto');
    letterEl.classList.remove('visible');
    letterEl.hidden = true;                 // E-03: la carta se gana otra vez
    clearTimeout(finalTimer);
    escena.style.transition = '';
    escena.style.transform = '';
    L.ground.innerHTML = '';
    L.plant.innerHTML  = '';
    L.crown.innerHTML  = '';
    L.fx.innerHTML     = '';
    heartHit.removeAttribute('d');
    hintTap.hidden = true;
    crownPts = [];
    resetEggs();
    buildIntroFlower();
  }

  async function play() {
    var my = ++runId;
    var alive = function () { return my === runId; };

    state = 'playing';
    if (pistaInicio) pistaInicio.hidden = true;
    btnMain.disabled = true;
    btnMain.textContent = 'Floreciendo…';

    // --- ESCENA 1: la flor pequeña aparece y flota ---
    var intro = L.intro.firstChild || buildIntroFlower();
    await sleep(60);   if (!alive()) return;
    intro.classList.add('in');
    await sleep(2200); if (!alive()) return;

    // --- ESCENA 2: la flor se va al suelo y se vuelve semilla ---
    drawGround();
    intro.classList.add('to-seed');
    await sleep(820);  if (!alive()) return;
    dropSeed();
    await sleep(760);  if (!alive()) return;

    // ...del punto crece el tallo
    var trunkMs = growTrunk();
    await sleep(trunkMs * 0.72); if (!alive()) return;

    // --- ramas y hojas ---
    var spots = growBranches();
    sproutLeaves(spots);
    await sleep(1850); if (!alive()) return;

    // --- ESCENAS 3 y 4: las flores van llenando el corazón ---
    var bloomMs = bloomHeart();
    await sleep(bloomMs * 0.82); if (!alive()) return;

    // E-03: la carta ya no sale aquí. Se gana al final de la cadena.
    await sleep(900); if (!alive()) return;

    // --- estado final ---
    document.body.classList.add('done');
    // Con la floración ya terminada, la animación estorba: si sigue puesta gana
    // a la transición y las flores no podrían viajar a formar el mensaje.
    crownPts.forEach(function (f) { soltarAnimacion(f.node); });
    state = 'done';
    btnMain.disabled = false;
    btnMain.textContent = 'Volver a florecer 🌻';
    // E-01: al terminar de florecer solo queda «Volver a florecer». Los otros
    // botones se ganan: corazón → chismosas → No presionar → aviso → botón final.
    construirPuntos();
    pintarCuenta();
    hintTap.hidden = false;

    await sleep(1400); if (!alive()) return;
    toast('Toca el corazón 🌻', 7000);      // E-03: que dure, es la única pista
  }

  /* ------------------------------------------------------------
     7. TOCAR EL CORAZÓN — pétalos que se desprenden
     ------------------------------------------------------------ */

  var HEART_SMALL = 'M0,1.2 C-2.6,-3.4 -9,-1.2 -9,3.6 C-9,8.2 -3.6,10.8 0,13.6 ' +
                    'C3.6,10.8 9,8.2 9,3.6 C9,-1.2 2.6,-3.4 0,1.2 Z';

  function localPoint(evt) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: HCX, y: HCY };
    var p = svg.createSVGPoint();
    p.x = evt.clientX; p.y = evt.clientY;
    var q = p.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  }

  function fxNode(child, x, y, cls, opts) {
    var g = el('g', { 'class': cls });
    g.style.setProperty('--pos', pos(x, y));
    g.style.setProperty('--dx', opts.dx.toFixed(0) + 'px');
    g.style.setProperty('--dy', opts.dy.toFixed(0) + 'px');
    if (opts.rot !== undefined) g.style.setProperty('--rot', opts.rot.toFixed(0) + 'deg');
    g.style.setProperty('--dur', (opts.dur * SLOW).toFixed(2) + 's');
    g.style.animationDelay = ((opts.delay || 0) * SLOW) + 'ms';
    g.appendChild(child);
    g.addEventListener('animationend', function () { g.remove(); });
    L.fx.appendChild(g);
  }

  function petalBurst(px, py) {
    if (!crownPts.length) return;
    if (L.fx.childNodes.length > 60) return;         // techo barato contra el abuso

    var near = crownPts.filter(function (f) { return Math.hypot(f.x - px, f.y - py) < 115; });
    if (near.length < 6) near = crownPts;

    var n = Math.min(7, near.length), used = {};
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(Math.random() * near.length);
      if (used[idx]) { i--; continue; }
      used[idx] = 1;
      var f = near[idx];

      // la flor de origen da un saltito y se queda
      f.node.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'ease-out', composite: 'add' }
      );

      var petal = el('g');
      petal.appendChild(el('path', { 'class': 'pt', d: petalPath(5, f.r * 0.3, f.r * 0.92), fill: pick(YELLOWS) }));
      petal.appendChild(el('circle', { 'class': 'core', r: (f.r * 0.26).toFixed(1) }));
      fxNode(petal, f.x, f.y, 'fx-fall', {
        dx: rnd(-80, 80), dy: rnd(150, 275), rot: rnd(-260, 260),
        dur: rnd(2.4, 3.6), delay: i * 70
      });
    }

    for (var h = 0; h < 3; h++) {
      var hp = el('path', { 'class': 'fx-heart', d: HEART_SMALL, opacity: 0.85 });
      fxNode(hp, px + rnd(-45, 45), py + rnd(-35, 35), 'fx-rise', {
        dx: rnd(-40, 40), dy: rnd(-170, -105), dur: rnd(2.6, 3.6), delay: h * 220
      });
    }
  }

  var heartTaps = 0;
  var TOQUES_CHISME = 7;

  // Cuenta regresiva del modo chismosas. Sin esto, quien toque el corazón dos
  // veces y lo deje no llega a enterarse de que había algo escondido.
  var PISTAS = [
    'toca el corazón',                  // 0 toques
    'algo se movió ahí detrás…',        // 1
    'se oyen cuchicheos',               // 2
    'alguien te está mirando',          // 3
    'eso de ahí parece un ojo 👀',      // 4
    'vienen en camino',                 // 5
    'una más y se destapa esto'         // 6
  ];

  function construirPuntos() {
    hintPuntos.innerHTML = '';
    for (var i = 0; i < TOQUES_CHISME; i++) {
      hintPuntos.appendChild(document.createElement('span')).className = 'punto';
    }
  }

  function pintarCuenta() {
    var p = hintPuntos.children, i;
    for (i = 0; i < p.length; i++) {
      p[i].className = 'punto' + (i < heartTaps ? ' on' : '');
    }
    if (chismeOn) {
      hintTexto.textContent = '👀 el comité ya está viendo esto';
      hintTap.classList.add('cerca');
      return;
    }
    hintTexto.textContent = PISTAS[Math.min(heartTaps, PISTAS.length - 1)];
    hintTap.classList.toggle('cerca', heartTaps >= TOQUES_CHISME - 3);
  }

  // El toque va en el <svg> entero, no solo en la silueta del corazón: el hueco
  // de arriba del corazón no es silueta, y ahí un dedo no encontraba nada.
  svg.addEventListener('click', function (e) {
    if (state === 'idle') { play(); return; }      // tocar la flor también arranca
    if (state !== 'done') return;
    if (document.body.classList.contains('final')) return;   // solo queda el mensaje
    var p = localPoint(e);
    petalBurst(p.x, p.y);
    if (chismeOn) return;                          // ya se destapó: solo pétalos
    heartTaps++;
    if (heartTaps >= TOQUES_CHISME) openChisme(true);
    pintarCuenta();
  });

  /* ------------------------------------------------------------
     7-bis. EL FINAL: LAS FLORES ESCRIBEN
     El texto se dibuja en un <canvas> que nadie ve, se leen los píxeles
     pintados y cada uno se convierte en el destino de una flor. Ninguna
     imagen, ninguna fuente descargada: lo dibuja el propio navegador.
     ------------------------------------------------------------ */

  var MENSAJE = ['TE QUIERO', 'SARA'];
  var modoTexto = false;

  function puntosTexto(lineas, objetivo) {
    var W = 600, H = 640;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d');
    if (!cx) return [];
    cx.fillStyle = '#000';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';

    // E-04: sans gruesa. Con serif, en Android (que no tiene Georgia) las patitas y los
    // trazos finos se muestreaban a medias y el mensaje salía chueco.
    var fam = ' "Arial Black", "Helvetica Neue", Arial, Roboto, sans-serif';
    var base = 150, ancho = 0, i;
    try { cx.letterSpacing = '10px'; } catch (e) { /* navegador viejo: sin separación */ }
    cx.font = '900 ' + base + 'px' + fam;
    for (i = 0; i < lineas.length; i++) ancho = Math.max(ancho, cx.measureText(lineas[i]).width);
    var size = Math.min(base, base * 430 / ancho);   // 430 cabe en la caja del dibujo
    cx.font = '900 ' + size + 'px' + fam;

    var alto = size * 1.25;
    var y0 = 320 - (lineas.length - 1) * alto / 2;   // centro del dibujo: el tronco se va
    for (i = 0; i < lineas.length; i++) cx.fillText(lineas[i], 300, y0 + i * alto);

    var d = cx.getImageData(0, 0, W, H).data, x, y;
    var area = 0;
    for (y = 0; y < H; y += 2) for (x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 128) area += 4;
    if (!area) return [];

    var paso = Math.max(6, Math.round(Math.sqrt(area / objetivo)));
    var pts = [];
    for (y = 0; y < H; y += paso) for (x = 0; x < W; x += paso) {
      if (d[(y * W + x) * 4 + 3] > 128) pts.push({ x: x + rnd(-0.4, 0.4), y: y + rnd(-0.4, 0.4) });
    }
    pts.paso = paso;
    return pts;
  }

  // Las flores ya no están animándose: al llegar al final se cancela su
  // animación de floración para que mande la transición de la hoja de estilo
  // y puedan viajar cambiando su --pos.
  function soltarAnimacion(node) {
    if (!node.getAnimations) return;
    node.getAnimations().forEach(function (a) { try { a.cancel(); } catch (e) { } });
  }

  function formarMensaje() {
    if (modoTexto || !crownPts.length) return;
    modoTexto = true;
    document.body.classList.add('texto');

    // E-04: en el teléfono, menos flores (cada una que viaja repinta el dibujo entero)
    var objetivo = window.innerWidth < 620 ? 215 : 250;   // punto medio: se leen y se ven flores
    var destinos = puntosTexto(MENSAJE, objetivo);
    if (!destinos.length) { modoTexto = false; document.body.classList.remove('texto'); return; }

    // faltan flores para escribirlo: nacen las que hagan falta
    var faltan = destinos.length - crownPts.length, frag = document.createDocumentFragment(), i;
    for (i = 0; i < faltan; i++) {
      var base = pick(crownPts);
      var rNueva = rnd(9, 13);
      var nueva = flowerNode(base.x, base.y, rNueva, rnd(0, 420));
      var reg = { x: base.x, y: base.y, r: rNueva, node: nueva, calor: Math.random(), extra: true };
      crownPts.push(reg);
      frag.appendChild(nueva);
    }
    L.crown.appendChild(frag);

    // de izquierda a derecha, para que no se crucen todas entre sí
    var orden = crownPts.slice().sort(function (a, b) { return (a.x - b.x) || (a.y - b.y); });
    destinos.sort(function (a, b) { return (a.x - b.x) || (a.y - b.y); });

    // E-04: todas del MISMO tamaño al escribir (antes iban de 9 a 15,5 y el trazo salía
    // desigual). El radio sale del paso del muestreo: se solapan un poco, así se ven flores y no puntos.
    var radio = destinos.paso * 0.86;
    setTimeout(function () {
      orden.forEach(function (f, k) {
        soltarAnimacion(f.node);
        f.node.style.transitionDelay = (rnd(0, 520) | 0) + 'ms';
        if (k >= destinos.length) {              // sobran: se apagan donde están
          f.node.classList.add('sobra');
          return;
        }
        var d = destinos[k];
        f.node.style.setProperty('--esc', (radio / f.r).toFixed(3));
        f.node.style.setProperty('--pos', pos(d.x, d.y, rnd(0, 360)));
      });
    }, faltan > 0 ? 620 : 40);
  }

  /* ------------------------------------------------------------
     8. EASTER EGG 1 — MODO CACHONDITO
     El botón dice "No presionar". Nadie ha resistido eso jamás.
     ------------------------------------------------------------ */

  var HOT = [
    { t: 36.5, lvl: 'nivel 1 · decente',
      txt: 'Me dijiste, con todas sus letras: «no me vayas a salir con algo cachondito». Y yo juré que no. Aquí empieza la parte donde se nota que mentí.' },
    { t: 37.2, lvl: 'nivel 2 · sospechoso',
      txt: 'Y que conste que lo nombraste tú. Yo iba a hacer una página cursi y normal, pero me quedé pensando en eso y ya no pude concentrarme en las flores.' },
    { t: 37.9, lvl: 'nivel 3 · tibio',
      txt: 'Aviso: las flores son amarillas. Lo que estaba pensando mientras las dibujaba, no tanto. Mira cómo se están poniendo algunas.' },
    { t: 38.6, lvl: 'nivel 4 · caliente',
      txt: 'Te lo digo bonito: hay días en que no tengo ganas de hablar. Tengo ganas de que se te olvide de qué estábamos hablando.' },
    { t: 39.3, lvl: 'nivel 5 · peligroso',
      txt: 'Si en vez de estar leyendo esto estuvieras aquí, te juro que esta página no habría alcanzado a terminarse. Ni el corazón, ni la carta, ni nada. Y no me arrepentiría.' },
    { t: 40.0, lvl: 'nivel 6 · termómetro reventado',
      txt: 'Listo: mira el corazón. Todas rojas. Así me pongo yo cuando te demoras en contestar y apareces como si nada. Y hasta aquí llego, que tus amigas están leyendo por encima de tu hombro. 👀' }
  ];
  var HOT_EXTRA = [
    'Ya. Respira. Yo también.',
    'El termómetro presentó la renuncia por escrito.',
    'Sigue presionando y le cuento a tus amigas qué era lo que ibas a preguntar.',
    'Se acabó el chiste. Cierra esto y vuelve a leer la carta, que esa sí es en serio. 💛'
  ];

  var hotLevel = 0;

  // Cuántas flores se sonrojan en cada nivel. Cada flor lleva su propio número
  // fijo (f.calor), así el grupo CRECE de forma estable en vez de sortearse otra
  // vez en cada pulsación — que era lo que acababa con medio corazón en rojo.
  function proporcionCalor() {
    if (hotLevel >= HOT.length) return 1;      // máximo: todas
    if (hotLevel >= 5) return 0.45;
    if (hotLevel >= 4) return 0.25;
    if (hotLevel >= 3) return 0.12;
    return 0;
  }

  function aplicarCalor() {
    var cl = document.body.classList;
    cl.toggle('mood-hot', hotLevel >= 3);
    cl.toggle('hot-max', hotLevel >= HOT.length);
    var prop = proporcionCalor();
    crownPts.forEach(function (f) {
      f.node.classList.toggle('hot', prop > 0 && f.calor <= prop);
    });
  }

  // Salir del modo devuelve el corazón a su amarillo: el nivel se conserva,
  // así que si vuelve a entrar lo encuentra donde lo dejó.
  function enfriar() {
    document.body.classList.remove('mood-hot', 'hot-max');
    crownPts.forEach(function (f) { f.node.classList.remove('hot'); });
  }

  function paintHot() {
    var i = Math.min(hotLevel, HOT.length) - 1;
    var h = i < 0 ? { t: 36.5, lvl: 'nivel 0 · decente', txt: 'Presiona y verás.' } : HOT[i];
    var extra = hotLevel > HOT.length ? HOT_EXTRA[Math.min(hotLevel - HOT.length, HOT_EXTRA.length) - 1] : null;

    $('#thermoNum').textContent  = h.t.toFixed(1);
    $('#hotLevel').textContent   = h.lvl;
    $('#hotLine').textContent    = extra || h.txt;
    $('#thermoFill').style.width = Math.min(100, (h.t - 36) / 4 * 100) + '%';

    aplicarCalor();

    if (hotLevel >= 5 && crownPts.length) {
      for (var k = 0; k < 4; k++) {
        var f = pick(crownPts);
        var hp = el('path', { 'class': 'fx-heart', d: HEART_SMALL, opacity: 0.9 });
        fxNode(hp, f.x, f.y, 'fx-rise', { dx: rnd(-50, 50), dy: rnd(-200, -120), dur: rnd(2.8, 4), delay: k * 260 });
      }
    }
    if (hotLevel >= HOT.length) {
      $('#hotMore').textContent = hotLevel > HOT.length ? 'Ya te dije que no 🔥' : 'Una más y ya 🔥';
    }
  }

  function openHot() {
    clearTimeout(enfriarTimer);
    hotLevel = Math.max(hotLevel, 1);
    paintHot();
    showCard('#cardHot');
  }

  /* ------------------------------------------------------------
     9. EASTER EGG 2 — MODO CHISMOSAS
     Ella avisó que sus amigas lo iban a ver. Pues que pasen.
     ------------------------------------------------------------ */

  var CHISME = [
    'Se confirma: sí lo hizo él. Solo. Sin plantilla y sin ayuda de nadie.',
    'Acta N.º 1: queda constancia de que sí se acordó del día de las flores amarillas.',
    'A la que dijo «ese man no da para tanto»: ahí tiene {N} flores. Cuéntelas.',
    'Pueden capturar todo lo que quieran; el original viene con dedicatoria y no es para ustedes.',
    'Si ya vieron el botón rojo de abajo: no cuenten nada. O cuenten, igual para eso están. 👀'
  ];

  var chismeOn = false, voted = false, liveTimer = null, liveN = 3;

  function openChisme(firstTime) {
    if (!chismeOn) {
      chismeOn = true;
      document.body.classList.add('mode-chisme');
      btnChisme.hidden = false;
      btnChisme.classList.add('entra');
      aparecer(btnHot);                 // E-01, paso 2: se gana el «No presionar»

      var list = $('#chismeList');
      list.innerHTML = '';
      CHISME.forEach(function (txt, i) {
        var li = document.createElement('li');
        li.style.setProperty('--i', i);
        li.textContent = txt.replace('{N}', crownPts.length);
        list.appendChild(li);
      });

      $('#liveBanner').hidden = false;
      liveN = 3;
      $('#liveCount').textContent = liveN;
      clearInterval(liveTimer);
      liveTimer = setInterval(function () {
        liveN += Math.floor(rnd(1, 4));
        if (liveN >= 27) {
          $('#liveCount').textContent = 'demasiadas';
          clearInterval(liveTimer);
        } else {
          $('#liveCount').textContent = liveN;
        }
      }, 2600);

      eyeStorm();
      if (firstTime) toast('Detectadas amigas en el perímetro 👀', 2600);
    }
    showCard('#cardChisme');
  }

  function eyeStorm() {
    if (!crownPts.length) return;
    for (var i = 0; i < 9; i++) {
      var f = pick(crownPts);
      var t = el('text', { 'class': 'fx-eye' });
      t.textContent = '👀';
      fxNode(t, f.x, f.y, 'fx-rise', {
        dx: rnd(-60, 60), dy: rnd(-210, -120), dur: rnd(3, 4.4), delay: i * 190
      });
    }
  }

  $('#voteBox').addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b) return;
    var r = $('#voteResult');
    if (b.dataset.v === 'no' && !voted) {
      voted = true;
      r.textContent = 'Voto no registrado. El sistema lo revisó y considera que usted no leyó bien. Intente de nuevo.';
      return;
    }
    r.textContent = 'Resultado oficial: APROBADO POR UNANIMIDAD. (El sistema no acepta votos negativos. Lo programó él.)';
  });

  /* ------------------------------------------------------------
     LA CADENA DEL FINAL (E-01)
     Los botones no están desde el principio: se ganan de uno en uno.
     corazón ×7 → chismosas → «No presionar» → 40 °C y salir → aviso →
     botón final resaltado → mensaje de flores.
     ------------------------------------------------------------ */

  var avisoMostrado = false, tarjetaActual = null, avisoTimer = null;

  function aparecer(btn) {
    if (!btn.hidden) return;
    btn.hidden = false;
    btn.classList.remove('entra');
    void btn.offsetWidth;              // reiniciar la animación si ya la tuvo
    btn.classList.add('entra');
  }

  // E-03 paso 5: EN EL MISMO MOMENTO en que sale el aviso se van los botones
  // intermedios, el banner y el reinicio, y aparece el botón final. Antes esperaba
  // a «Voy a leerla» y él lo marcó como fallo.
  function abrirAviso() {
    avisoMostrado = true;
    btnHot.hidden = true;
    btnChisme.hidden = true;
    btnMain.hidden = true;
    clearInterval(liveTimer);
    $('#liveBanner').hidden = true;
    aparecer(btnAmor);
    setTimeout(function () { btnAmor.classList.add('resaltado'); }, 850);
    showCard('#cardAviso');
  }

  // Al cerrar el aviso aparece la carta, línea por línea, debajo del árbol.
  function mostrarCarta() {
    letterEl.hidden = false;
    void letterEl.offsetWidth;          // que la transición de cada línea arranque de cero
    letterEl.classList.add('visible');
    setTimeout(function () {
      var top = letterEl.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 250);
  }

  // E-03 paso 6 y 7: la carta se desvanece, se van tronco y suelo, las flores
  // escriben en el centro, y un rato después vuelve «Volver a florecer».
  var finalTimer = null;
  // Antes la carta se plegaba animando max-height: eso recalcula la página en cada
  // fotograma mientras el dibujo se mueve, y en el teléfono se notaba (E-04). Ahora:
  // se desvanece → se quita de golpe → el dibujo, que salta al centro, se devuelve
  // con un transform a donde estaba y se desliza (técnica FLIP: solo compositor).
  var escena = $('.scene');
  function elFinal() {
    btnAmor.classList.remove('resaltado');
    btnAmor.hidden = true;
    document.body.classList.add('final');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    finalTimer = setTimeout(function () {
      var antes = escena.getBoundingClientRect().top;
      letterEl.hidden = true;
      var despues = escena.getBoundingClientRect().top;
      escena.style.transition = 'none';
      escena.style.transform = 'translateY(' + (antes - despues).toFixed(1) + 'px)';
      void escena.offsetWidth;
      escena.style.transition = 'transform 1s cubic-bezier(.4,0,.2,1)';
      escena.style.transform = '';

      finalTimer = setTimeout(function () {
        escena.style.transition = '';
        formarMensaje();
        // viaje de las flores ≈ 0,6 s de nacer + 0,5 de retraso + 1,9 de viaje
        finalTimer = setTimeout(function () {
          btnMain.textContent = 'Volver a florecer 🌻';
          aparecer(btnMain);
        }, 3100 + 3000);
      }, 1050);
    }, 950);
  }

  /* ------------------------------------------------------------
     tarjetas
     ------------------------------------------------------------ */

  var backdrop = $('#backdrop');

  function showCard(sel) {
    $('#cardHot').hidden    = true;
    $('#cardChisme').hidden = true;
    $('#cardAviso').hidden  = true;
    $(sel).hidden  = false;
    backdrop.hidden = false;
    tarjetaActual = sel;
  }
  var enfriarTimer = null;

  // Al cerrar, el corazón vuelve al amarillo — pero no de golpe: la tarjeta tapa
  // el dibujo (en el teléfono, casi entero), así que se deja ver el rojo un par
  // de segundos y recién ahí se enfría.
  function closeCards(inmediato) {
    clearTimeout(enfriarTimer);
    if (inmediato) enfriar();
    else if (document.body.classList.contains('mood-hot')) {
      enfriarTimer = setTimeout(enfriar, 2600);
    }
    var cerrada = tarjetaActual;
    tarjetaActual = null;
    backdrop.hidden = true;
    $('#cardHot').hidden = true;
    $('#cardChisme').hidden = true;
    $('#cardAviso').hidden = true;
    if (inmediato) return;

    // E-01 paso 3: sale del «No presionar» HABIENDO LLEGADO AL MÁXIMO.
    // El aviso espera a que el corazón se enfríe: primero se ve pasar de rojo
    // a amarillo, y recién entonces aparece la ventana.
    if (cerrada === '#cardHot' && hotLevel >= HOT.length && !avisoMostrado) {
      clearTimeout(avisoTimer);
      avisoTimer = setTimeout(abrirAviso, 3400);
    }
    // E-03: cerró el aviso → sale la carta (el botón final ya estaba).
    if (cerrada === '#cardAviso') mostrarCarta();
  }

  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop || e.target.hasAttribute('data-close')) closeCards();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCards();
  });

  function resetEggs() {
    hotLevel = 0; heartTaps = 0; chismeOn = false; voted = false;
    modoTexto = false;
    avisoMostrado = false; tarjetaActual = null;
    clearTimeout(avisoTimer);
    document.body.classList.remove('mood-hot', 'hot-max', 'texto');
    btnAmor.hidden = true;
    btnAmor.classList.remove('resaltado', 'entra');
    btnHot.classList.remove('entra');
    btnChisme.classList.remove('entra');
    btnAmor.textContent = '💛 Una última cosa';
    btnMain.hidden = false;
    if (pistaInicio) pistaInicio.hidden = false;
    hintTexto.textContent = PISTAS[0];
    hintTap.classList.remove('cerca');
    construirPuntos();
    clearInterval(liveTimer);
    $('#liveBanner').hidden = true;
    $('#voteResult').textContent = '';
    $('#hotMore').textContent = 'Subir la temperatura 🔥';
    $('#thermoFill').style.width = '0%';
    btnHot.hidden = true;
    btnChisme.hidden = true;
    closeCards(true);
  }

  /* ------------------------------------------------------------
     10. ARRANQUE
     ------------------------------------------------------------ */

  btnMain.addEventListener('click', function () {
    if (state === 'playing') return;
    if (state === 'done') {
      hardReset();
      state = 'idle';
      setTimeout(play, 420);
    } else {
      play();
    }
  });

  btnAmor.addEventListener('click', elFinal);

  btnHot.addEventListener('click', openHot);
  btnChisme.addEventListener('click', function () { openChisme(false); eyeStorm(); });
  $('#hotMore').addEventListener('click', function () {
    hotLevel = Math.min(hotLevel + 1, HOT.length + HOT_EXTRA.length);
    paintHot();
  });

  // atajos de teclado para quien ande con computador
  var buf = '';
  document.addEventListener('keydown', function (e) {
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-7);
    if (state !== 'done') return;
    if (buf.indexOf('chisme') >= 0) { buf = ''; openChisme(true); }
    // (el atajo «calor» se quitó con E-03: se saltaba el orden de la cadena)
  });

  // Al girar el teléfono cambia la densidad de la rejilla (< 620 px va más
  // suelta). Solo rehago el corazón si de verdad cruzó ese umbral.
  var rzT = null, wasNarrow = window.innerWidth < 620;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      var narrow = window.innerWidth < 620;
      if (narrow === wasNarrow) return;
      wasNarrow = narrow;
      if (state !== 'done') return;
      bloomHeart();
      if (document.body.classList.contains('mood-hot')) paintHot();
    }, 450);
  });

  buildIntroFlower();
  setTimeout(function () { $('.intro-pos').classList.add('in'); }, 260);

  // Todo lo de arriba ya está enganchado: recién ahora el botón sirve de algo.
  btnMain.disabled = false;
  btnMain.textContent = '🌻 Haz florecer algo';


  // Ganchos de prueba: solo si la URL trae ?auto o ?debug.
  // ?auto arranca la animación sin tocar el botón (sirve para captura y demo).
  var qs = location.search;
  if (qs.indexOf('debug') >= 0 || qs.indexOf('auto') >= 0) {
    window.__flores = {
      play: play, reset: hardReset, burst: petalBurst, hot: openHot, chisme: openChisme,
      info: function () {
        return { state: state, flores: crownPts.length, taps: heartTaps,
                 hotLevel: hotLevel, chisme: chismeOn, fx: L.fx.childNodes.length };
      }
    };
  }
  if (qs.indexOf('auto') >= 0) setTimeout(play, 300);
})();

(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Экран загрузки ---------- */
  const loader = document.getElementById('loader');
  const pctEl = document.getElementById('pct');
  let pct = 0, loaded = false;
  addEventListener('load', () => { loaded = true; });
  const loadTick = () => {
    const cap = loaded ? 100 : 90;
    pct = Math.min(cap, pct + (loaded ? 4 : Math.random() * 3));
    pctEl.textContent = Math.floor(pct);
    if (pct < 100) return setTimeout(loadTick, 30);
    setTimeout(() => {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      startCounters();
    }, 250);
  };
  loadTick();

  /* ---------- Меню ---------- */
  const menu = document.getElementById('menu');
  const menuBtn = document.getElementById('menuBtn');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
  };
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Появление глав и блоков ---------- */
  const chapters = [...document.querySelectorAll('.chapter')];
  const chapterIO = new IntersectionObserver(entries => entries.forEach(e => {
    e.target.classList.toggle('is-active', e.isIntersecting);
  }), { threshold: 0.45 });
  chapters.forEach(c => chapterIO.observe(c));

  const revealIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); revealIO.unobserve(e.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- Счётчики ---------- */
  function startCounters() {
    const fmt = n => n.toLocaleString('ru-RU').replace(/ /g, ' ');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, target = +el.dataset.count, suffix = el.dataset.suffix || '';
      if (reduce) return;
      const t0 = performance.now(), dur = 1800;
      const step = t => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 4)))) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
  }

  /* ---------- 3D-сцена ---------- */
  const canvas = document.getElementById('scene');
  if (!window.THREE) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) { return; }

  const isMobile = innerWidth < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);

  const ORANGE = 0xff6a1a, CYAN = 0x5fe3ff, WHITE = 0xf2f2f0;

  // Рельеф: холмы, ровная площадка вокруг вышки
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    const k = THREE.MathUtils.smoothstep(d, 6, 34);
    return k * (Math.sin(x * 0.07) * Math.cos(z * 0.09) * 2.2 + Math.sin(x * 0.021 + z * 0.033) * 5 + Math.cos(z * 0.05) * 1.5) - 0.2;
  };

  // Сетка точек земли
  {
    const size = 260, seg = isMobile ? 110 : 170;
    const pts = [];
    for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) {
      const x = (i / seg - 0.5) * size, z = (j / seg - 0.5) * size;
      pts.push(x, heightAt(x, z), z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8a96a8, size: 0.11, transparent: true, opacity: 0.75 })));
  }

  // Звёзды
  {
    const n = isMobile ? 900 : 1800, pts = [];
    for (let i = 0; i < n; i++) {
      const r = 220 + Math.random() * 120, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
      pts.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 10, r * Math.sin(ph) * Math.sin(th));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: WHITE, size: 0.7, fog: false, transparent: true, opacity: 0.7 })));
  }

  // Решётчатая вышка
  const TOWER_H = 15;
  const buildTower = (h, base, top, opacity) => {
    const seg = [];
    const levels = Math.round(h / 1.25);
    const corner = (y, sx, sz) => {
      const w = THREE.MathUtils.lerp(base, top, y / h);
      return [sx * w, y, sz * w];
    };
    const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let l = 0; l < levels; l++) {
      const y0 = (l / levels) * h, y1 = ((l + 1) / levels) * h;
      for (let c = 0; c < 4; c++) {
        const a = C[c], b = C[(c + 1) % 4];
        seg.push(...corner(y0, ...a), ...corner(y1, ...a));          // пояс
        seg.push(...corner(y1, ...a), ...corner(y1, ...b));          // распорка
        seg.push(...corner(y0, ...a), ...corner(y1, ...b));          // раскос
        seg.push(...corner(y0, ...b), ...corner(y1, ...a));          // раскос
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity }));
  };

  const tower = new THREE.Group();
  tower.add(buildTower(TOWER_H, 2.1, 0.45, 0.75));
  scene.add(tower);

  // Фундамент
  {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 0.6, 6));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.8 }));
    m.position.y = 0.1; tower.add(m);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.06, side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.41; tower.add(pad);
  }

  // Шкаф оборудования у подножия
  {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 1.8, 0.8));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }));
    m.position.set(3.8, 1.3, 1.2); tower.add(m);
    const cable = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.8, 2.2, 1.2), new THREE.Vector3(3.8, 3.2, 0.6), new THREE.Vector3(1.4, 4, 0.6)]);
    tower.add(new THREE.Line(cable, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 })));
  }

  // Антенны (3 сектора) + RRU + РРЛ-тарелка
  const antennaMat = new THREE.MeshBasicMaterial({ color: ORANGE });
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2 + 0.3;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2, 0.14), antennaMat);
    panel.position.set(Math.cos(a) * 1.05, 13.2, Math.sin(a) * 1.05);
    panel.rotation.y = -a + Math.PI / 2;
    tower.add(panel);
    const rru = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 0.5, 0.2)), new THREE.LineBasicMaterial({ color: WHITE }));
    rru.position.set(Math.cos(a) * 0.9, 11.8, Math.sin(a) * 0.9);
    rru.rotation.y = panel.rotation.y;
    tower.add(rru);
  }
  {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32, 1, true), new THREE.MeshBasicMaterial({ color: CYAN, side: THREE.DoubleSide }));
    dish.rotation.z = Math.PI / 2; dish.position.set(1.05, 10.2, 0); tower.add(dish);
  }

  // Маячок на вершине
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true }));
  beacon.position.y = TOWER_H + 0.3; tower.add(beacon);
  const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,80,40'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beaconGlow.scale.set(2.4, 2.4, 1); beaconGlow.position.copy(beacon.position); tower.add(beaconGlow);

  // Радиоволны
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const pts = new THREE.EllipseCurve(0, 0, 1, 1, 0, Math.PI * 2).getPoints(96).map(p => new THREE.Vector3(p.x, 0, p.y));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0 }));
    line.position.y = 13.2; scene.add(line); waves.push({ line, phase: i / 5 });
  }

  // Сеть соседних станций и линии связи
  const network = [], pulses = [];
  const nodeCount = isMobile ? 8 : 12;
  for (let i = 0; i < nodeCount; i++) {
    const a = (i / nodeCount) * Math.PI * 2 + Math.random() * 0.4;
    const r = 30 + Math.random() * 55;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(x, z);
    const h = 6 + Math.random() * 4;
    const t = buildTower(h, 0.9, 0.2, 0.45);
    t.position.set(x, y, z); scene.add(t);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,106,26'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(x, y + h + 0.3, z); glow.scale.set(2.2, 2.2, 1); scene.add(glow);
    network.push({ glow, phase: Math.random() * Math.PI * 2 });

    const from = new THREE.Vector3(0, 13.2, 0), to = new THREE.Vector3(x, y + h, z);
    const mid = from.clone().lerp(to, 0.5); mid.y += 8 + r * 0.12;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22 })));
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('95,227,255'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dot.scale.set(1.1, 1.1, 1); scene.add(dot);
    pulses.push({ curve, dot, offset: Math.random(), speed: 0.15 + Math.random() * 0.15 });
  }

  function glowTexture(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.25, `rgba(${rgb},.6)`); grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Кадры камеры для каждой главы: [позиция x,y,z, цель x,y,z]
  const KEYS = [
    [-17, 6, 42, -17, 9, 0],    // главный экран — вышка справа от текста
    [-22, 4, 20, 0, 3, 0],      // изыскания — низко над площадкой
    [8, 2.2, 10, 0, 1.2, 0],    // фундамент
    [5, 14.5, 6, 0, 12.6, 0],   // антенны
    [7, 3.5, 6, 3, 2.2, 0],     // электромонтаж — шкаф у подножия
    [-4, 20, 14, 0, 13, 0],     // пусконаладка — волны
    [30, 34, 52, 0, 4, 0],      // обслуживание — вся сеть
  ];

  // На телефоне текст по центру — вышку ставим ниже заголовка
  if (isMobile) KEYS[0] = [0, 4, 52, 0, 15, 0];

  const chaptersEl = document.getElementById('chapters');
  const camPos = new THREE.Vector3(...KEYS[0].slice(0, 3));
  const camTgt = new THREE.Vector3(...KEYS[0].slice(3));
  const wantPos = new THREE.Vector3(), wantTgt = new THREE.Vector3();
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 60 : 45;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();

  const smooth = t => t * t * (3 - 2 * t);
  const clock = new THREE.Clock();

  const frame = () => {
    requestAnimationFrame(frame);
    const rect = chaptersEl.getBoundingClientRect();
    if (rect.bottom < -innerHeight * 0.2) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';

    const t = clock.getElapsedTime();

    // Где мы в главах: 0 … KEYS.length-1
    const span = rect.height - innerHeight;
    const prog = Math.min(Math.max(-rect.top / span, 0), 1) * (KEYS.length - 1);
    const i = Math.min(Math.floor(prog), KEYS.length - 2), f = smooth(prog - i);
    const A = KEYS[i], B = KEYS[i + 1];
    wantPos.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
    wantTgt.set(A[3] + (B[3] - A[3]) * f, A[4] + (B[4] - A[4]) * f, A[5] + (B[5] - A[5]) * f);

    // Лёгкий облёт и реакция на мышь
    if (!reduce) {
      mouse.sx += (mouse.x - mouse.sx) * 0.04;
      mouse.sy += (mouse.y - mouse.sy) * 0.04;
      const orbit = Math.sin(t * 0.08) * 0.08;
      const cx = wantPos.x - wantTgt.x, cz = wantPos.z - wantTgt.z;
      wantPos.x = wantTgt.x + cx * Math.cos(orbit) - cz * Math.sin(orbit);
      wantPos.z = wantTgt.z + cx * Math.sin(orbit) + cz * Math.cos(orbit);
      wantPos.x += mouse.sx * 2.2;
      wantPos.y -= mouse.sy * 1.2;
    }
    camPos.lerp(wantPos, reduce ? 1 : 0.06);
    camTgt.lerp(wantTgt, reduce ? 1 : 0.06);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // Анимации объектов
    const blink = (Math.sin(t * 4) + 1) / 2;
    beacon.material.opacity = 0.4 + blink * 0.6;
    beaconGlow.material.opacity = blink;

    waves.forEach(w => {
      const s = reduce ? w.phase : (t * 0.22 + w.phase) % 1;
      const sc = 0.8 + s * 26;
      w.line.scale.set(sc, 1, sc);
      w.line.material.opacity = (1 - s) * 0.7;
    });
    network.forEach(n => { n.glow.material.opacity = 0.5 + Math.sin(t * 2 + n.phase) * 0.5; });
    pulses.forEach(p => {
      const k = reduce ? p.offset : (t * p.speed + p.offset) % 1;
      p.dot.position.copy(p.curve.getPoint(k));
      p.dot.material.opacity = Math.sin(k * Math.PI);
    });

    renderer.render(scene, camera);
  };
  frame();
})();

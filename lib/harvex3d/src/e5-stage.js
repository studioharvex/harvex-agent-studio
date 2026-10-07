/* Harvex — stage: renderer, lighting, platform, look-at, power VFX, thumbnails. */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX;
const { TAU, clamp, lerp, sstep, ease, angNorm } = R.util;
const PI = Math.PI;

/* ---------- look defaults & migration ---------- */
const DEFAULT_LOOK = {
  kind: 'human', model: null, body: 'masculine', build: 'regular', headStyle: 'human',
  skin: '#c98e66', eyes: '#4a3526', facial: 'none',
  hair: { style: 'short', color: '#2b201c' },
  top: { type: 'tee', color: '#2b3a33', accent: '#ffe600' },
  bottom: { type: 'pants', color: '#1f2528' }, legwear: 'bare',
  shoes: { type: 'sneaker', color: '#e9ece4' },
  head: 'none', face: 'none', back: 'none', accColor: '#20262a',
  glow: '#ffe600', finish: 'matte',
};
function normalizeLook(l) {
  const o = JSON.parse(JSON.stringify(DEFAULT_LOOK));
  if (!l) return o;
  for (const k in l) { if (l[k] && typeof l[k] === 'object' && !Array.isArray(l[k])) o[k] = Object.assign({}, o[k] || {}, l[k]); else if (l[k] !== undefined) o[k] = l[k]; }
  return o;
}
function structKey(L) { return JSON.stringify([L.kind, L.model, L.body, L.build, L.headStyle, L.hair.style, L.facial, L.top.type, L.bottom.type, L.shoes.type, L.head, L.face, L.back, L.legwear, L.finish, L.sim ? [L.sim.hair, L.sim.outfit, L.sim.shoes, L.sim.brows, L.sim.lashes, L.sim.lite, L.sim.baked] : 0]); }
R.DEFAULT_LOOK = DEFAULT_LOOK; R.normalizeLook = normalizeLook; R.structKey = structKey;

/* ---------- textures ---------- */
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
let GLOW_TEX = null;
function glowTex() { return GLOW_TEX || (GLOW_TEX = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); })); }
function platformTex(accent) {
  return canvasTex(1024, 1024, (g, w) => {
    const c = w / 2; g.clearRect(0, 0, w, w); g.strokeStyle = accent;
    const ring = (r, a, lw, dash) => { g.globalAlpha = a; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); };
    ring(500, 0.9, 6); ring(470, 0.18, 2, [4, 10]); ring(360, 0.12, 2); ring(250, 0.08, 2, [2, 8]); ring(120, 0.06, 2);
    g.setLineDash([]); g.globalAlpha = 0.35; g.lineWidth = 3;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, l = i % 6 === 0 ? 28 : 12; g.beginPath(); g.moveTo(c + Math.cos(a) * (478 - l), c + Math.sin(a) * (478 - l)); g.lineTo(c + Math.cos(a) * 478, c + Math.sin(a) * 478); g.stroke(); }
    g.globalAlpha = 0.07; g.lineWidth = 1.5;
    for (let x = -480; x <= 480; x += 40) { g.beginPath(); g.moveTo(c + x, c - 440); g.lineTo(c + x, c + 440); g.stroke(); g.beginPath(); g.moveTo(c - 440, c + x); g.lineTo(c + 440, c + x); g.stroke(); }
    const rg = g.createRadialGradient(c, c, 0, c, c, 500); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.75, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  });
}
function envMap(renderer) {
  const s = new T.Scene();
  const g = new T.SphereGeometry(10, 32, 16), cols = [], p = g.attributes.position;
  const top = new T.Color('#4a4d52'), mid = new T.Color('#1b1c1e'), bot = new T.Color('#0b0b0a');   // a neutral studio: soft grey above, dark floor
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  s.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const box = (w, h, col, k, pos) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m); };
  box(6, 4, '#ffffff', 3.2, [-4, 5, 6]); box(3, 6, '#fff2c9', 2.4, [6, 2, -5]); box(5, 3, '#ffe7cf', 1.2, [6, 0.5, 4]); box(8, 2, '#ffe600', 0.5, [0, -3, -6]);   // key, rim, warm fill, a yellow bounce from the floor
  const pm = new T.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.035).texture; pm.dispose(); return tex;
}

/* ---------- particles ---------- */
class Particles {
  constructor(scene, max = 1200) {
    this.max = max; this.list = [];
    const g = new T.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('col', new T.BufferAttribute(this.col, 4)); g.setAttribute('size', new T.BufferAttribute(this.size, 1));
    this.mat = new T.ShaderMaterial({
      uniforms: { uPR: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float size;attribute vec4 col;varying vec4 vC;uniform float uPR;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uPR*(260./-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec4 vC;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);float a=smoothstep(.5,.0,r);a=a*a;gl_FragColor=vec4(vC.rgb*(1.+a),vC.a*a);}',
    });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 10; scene.add(this.pts); this.g = g;
  }
  emit(o) {
    if (this.list.length >= this.max) this.list.shift();
    const c = new T.Color(o.color || '#ffe600');
    this.list.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 1, r: c.r, g: c.g, b: c.b, s: o.size || 0.05, drag: o.drag ?? 1.5, grav: o.grav ?? 0, a: o.alpha ?? 1, shrink: o.shrink ?? true });
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt; if (p.life >= p.max) { L.splice(i, 1); continue; }
      const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01 && p.grav) { p.y = 0.01; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    const n = Math.min(L.length, this.max);
    for (let i = 0; i < n; i++) {
      const p = L[i], k = p.life / p.max, fade = Math.min(1, (1 - k) * 3) * Math.min(1, p.life * 12);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = fade * p.a;
      this.size[i] = p.s * (p.shrink ? 1 - k * 0.6 : 1);
    }
    for (let i = n; i < this.max; i++) this.col[i * 4 + 3] = 0;
    this.g.setDrawRange(0, Math.max(n, 1));
    this.g.attributes.position.needsUpdate = this.g.attributes.col.needsUpdate = this.g.attributes.size.needsUpdate = true;
  }
}

const shieldMat = () => new T.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new T.Color('#ffe600') } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);vP=position;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float uT;uniform float uA;uniform vec3 uC;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);vec3 p=vP*9.;float hex=abs(sin(p.x)+sin(p.y*.866+p.x*.5)+sin(p.y*.866-p.x*.5));float edge=smoothstep(.25,.0,abs(hex-1.5)-.2)*.5;float band=smoothstep(.96,1.,sin(vP.y*18.-uT*7.)*.5+.5)*.6;float a=(f*1.1+edge*(.25+f)+band+.04)*uA;gl_FragColor=vec4(uC*(1.2+f),a);}',
});

/* ---------- STAGE ---------- */
// what a standing character does by itself now and then: [motion, seconds when it is a loop played for a while]
const FIDGETS = [['Chat', 3.2], ['Stretch'], ['Nod'], ['Wave'], ['Think', 3], ['Use']];
class Stage {
  constructor(canvas, o = {}) {
    this.o = o; this.canvas = canvas;
    const r = this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!o.thumb, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.thumb ? 1.5 : 2));
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    const s = this.scene = new T.Scene();
    s.environment = envMap(r);
    const tight = !!(o.thumb || o.bare);       // the framing of a picture; the bare stage (home page) takes over from one
    this.camera = new T.PerspectiveCamera(tight ? 24 : 27, 1, 0.1, 50);
    // far enough back that a raised hand of the tallest build stays in the picture, feet where they were
    this.camTarget = new T.Vector3(0, tight ? 0.88 : 0.69, 0); this.camDist = tight ? 4.7 : 6.0; this.zoom = 1; this.camPitch = 0.08;
    // THREE-POINT LIGHT (user, 6 Oct 2026: "the shading is flat"): a key from the front, above and left (about 45
    // degrees round, 55 up: a short shadow), a soft warm fill from the other side, a rim from behind and above that
    // lifts dark clothes off the background; the sky light is warm above and dark below (the fold under an arm or
    // a chin stays darker).
    s.add(new T.HemisphereLight('#fff6e6', '#191611', 0.5));
    const key = new T.DirectionalLight('#fff3e6', 2.6); key.position.set(-2.6, 5.4, 2.8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);   // 1024 on purpose: a body now takes its own shadow, and at 2048 a hand near a thigh drew a hard-edged blot const sc = key.shadow.camera; sc.left = -1.6; sc.right = 1.6; sc.top = 2.4; sc.bottom = -0.6; sc.near = 1; sc.far = 12;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 5; s.add(key);
    this.rim = new T.DirectionalLight('#fff3c4', 1.8); this.rim.position.set(2.4, 3.6, -3.4); s.add(this.rim);
    const fill = new T.DirectionalLight('#ffe9c4', 0.6); fill.position.set(3, 1.2, 2.6); s.add(fill);
    // platform
    this.platform = new T.Group(); s.add(this.platform);
    const shadow = new T.Mesh(new T.CircleGeometry(1.6, 48), new T.ShadowMaterial({ opacity: 0.34 })); shadow.rotation.x = -PI / 2; shadow.position.y = 0.003; shadow.receiveShadow = true; this.platform.add(shadow);
    // the contact shadow: a soft dark pool right under the feet, which is what makes a figure stand ON the floor
    // (the cast shadow alone is one hard-edged shape lying beside it)
    { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g2 = cv.getContext('2d'), rg = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(0.45, 'rgba(0,0,0,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = rg; g2.fillRect(0, 0, 128, 128);
      const pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false })); pool.rotation.x = -PI / 2; pool.position.y = 0.005; pool.scale.set(0.74, 0.5, 1); pool.renderOrder = -1; this.platform.add(pool); this.pool = pool; }
    if (!o.thumb && !o.bare) {                 // `bare`: the page brings its own floor (the home page's stage): only the shadow is drawn
      const disc = new T.Mesh(new T.CylinderGeometry(1.08, 1.12, 0.06, 64), new T.MeshStandardMaterial({ color: '#0c1611', roughness: 0.45, metalness: 0.6 })); disc.position.y = -0.03; disc.receiveShadow = true; this.platform.add(disc);
      this.decal = new T.Mesh(new T.CircleGeometry(1.06, 64), new T.MeshBasicMaterial({ map: platformTex('#ffe600'), transparent: true, opacity: 0.55, depthWrite: false })); this.decal.rotation.x = -PI / 2; this.decal.position.y = 0.002; this.platform.add(this.decal);
      this.ringGlow = new T.Mesh(new T.TorusGeometry(1.1, 0.008, 8, 96), new T.MeshBasicMaterial({ color: '#ffe600' })); this.ringGlow.rotation.x = -PI / 2; this.ringGlow.position.y = 0.0; this.platform.add(this.ringGlow);
    }
    this.turn = new T.Group(); s.add(this.turn); this.yaw = tight ? 0.18 : 0; this.yawVel = 0;
    this.anim = new R.Animator(); this.char = null; this.look = null; this.key = '';
    this.fxOffset = new T.Vector3(); this.hidden = false; this.skills = []; this.lastRy = 0; this.yawRate = 0;
    this.lookTarget = new T.Vector3(0, 1.4, 5); this.lookCur = new T.Vector2(); this.pointerActive = 0;
    this.parts = new Particles(s); this.parts.mat.uniforms.uPR.value = r.getPixelRatio();
    if (!o.thumb) this.buildFx();
    this.clock = new T.Clock(); this.running = false;
    if (!o.thumb) { this.bindPointer(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement || canvas); }
    this.resize();
  }
  buildFx() {
    const s = this.scene;
    this.shield = new T.Mesh(new T.IcosahedronGeometry(1, 5), shieldMat()); this.shield.visible = false; this.shield.renderOrder = 12; s.add(this.shield);
    this.orb = new T.Group(); this.orb.visible = false; s.add(this.orb);
    this.orb.add(new T.Mesh(new T.SphereGeometry(0.05, 20, 14), new T.MeshBasicMaterial({ color: '#f6ffd8' })));
    const spr = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: '#ffe600', blending: T.AdditiveBlending, depthWrite: false, transparent: true })); spr.scale.setScalar(0.45); this.orb.add(spr); this.orbSpr = spr;
    this.orbLight = new T.PointLight('#ffe600', 0, 3, 1.6); this.orb.add(this.orbLight);
    this.scanRing = new T.Group(); this.scanRing.visible = false; s.add(this.scanRing);
    const rm = new T.MeshBasicMaterial({ color: '#ffe600', transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    this.scanRing.add(new T.Mesh(new T.TorusGeometry(0.48, 0.006, 6, 80), rm).rotateX(PI / 2));
    const dm = new T.MeshBasicMaterial({ map: glowTex(), color: '#ffe600', transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    this.scanRing.add(new T.Mesh(new T.CircleGeometry(0.5, 48), dm).rotateX(-PI / 2));
    // holo keyboard / screen for Typing
    this.holoTex = canvasTex(512, 256, () => {}); this.holoCanvas = this.holoTex.image; this.holoLines = [];
    this.holo = new T.Mesh(new T.PlaneGeometry(0.62, 0.31), new T.MeshBasicMaterial({ map: this.holoTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    this.holo.renderOrder = 11; s.add(this.holo); this.holoT = 0;
  }
  bindPointer() {
    const c = this.canvas; let drag = null;
    const ndc = e => { const b = c.getBoundingClientRect(); return new T.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
    const aim = e => { const n = ndc(e); const ray = new T.Raycaster(); ray.setFromCamera(n, this.camera); const plane = new T.Plane(new T.Vector3(0, 0, 1), -1.4); const pt = new T.Vector3(); if (ray.ray.intersectPlane(plane, pt)) { this.lookTarget.copy(pt); this.pointerActive = 3; } };
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, id: e.pointerId }; this.yawVel = 0; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', e => { aim(e); if (drag) { const dx = e.clientX - drag.x; drag.x = e.clientX; this.yaw += dx * 0.011; this.yawVel = dx * 0.011 * 60; } });
    const up = () => { drag = null; c.style.cursor = 'grab'; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.pointerActive = 0.4; });
    c.addEventListener('dblclick', () => { this.yaw = 0; this.yawVel = 0; this.zoom = 1; });
    if (!this.o.bare) c.addEventListener('wheel', e => { e.preventDefault(); this.zoom = clamp(this.zoom * (1 + e.deltaY * 0.001), 0.62, 1.25); }, { passive: false });   // on a page that scrolls, the wheel stays the page's
    c.style.cursor = 'grab'; c.style.touchAction = 'pan-y';
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas; const w = this.o.width || el.clientWidth || 300, h = this.o.height || el.clientHeight || 400;
    this.renderer.setSize(w, h, !this.o.width ? false : true); this.camera.aspect = w / h;
    // keep full body in frame on narrow screens
    const fitW = w / h < 0.7 ? 0.7 / (w / h) : 1; this.fit = Math.min(fitW, 1.5);
    this.camera.updateProjectionMatrix();
  }
  /* Shows a look. A human is a modelled character when its files are there (R.models); while they are on the way the
     stage keeps what it shows (or stays empty) and the returned promise resolves once the look is on stage. With
     o.now the look is built at once from what is loaded: the model, or the body made of shapes. */
  setLook(look, o = {}) {
    // a human is built by the parametric module when it is switched on (R.sim), else by the modelled one (R.models)
    const L = normalizeLook(look), md = R.sim && R.sim.wants(L, this.renderer) ? R.sim : R.models, want = !!md && md.wants(L, this.renderer);
    if (want && !md.ready(L)) {
      if (!o.now) {
        // a newer look asked for meanwhile takes over: this promise then waits for that one
        const mine = this.wait = {};
        return mine.done = md.ensure(L).catch(e => { md.failed = true; console.warn('Harvex: character files not loaded, using the built-in body.', e); }).then(() => {
          if (this.gone) return;
          if (this.wait === mine) { this.wait = null; this.show(L, md.wants(L, this.renderer) && md.ready(L) && md); } else if (this.wait) return this.wait.done;
        });
      }
      this.show(L, false); return Promise.resolve();
    }
    this.wait = null; this.show(L, want && md); return Promise.resolve();
  }
  show(L, model) {
    const k = (model ? (model === R.sim ? 's' : 'm') : 'p') + structKey(L);
    if (this.char && k === this.key) { this.char.mats.apply(L); if (this.char.apply) this.char.apply(L); this.look = L; this.applyGlow(L); return; }
    let ch = null; const mats = new R.Mats(L);
    if (model) try { ch = (model.build || R.buildModelHuman)(L, mats, this.renderer, { lite: !!(this.o.thumb || this.o.bare) }); } catch (e) { model.failed = true; console.warn('Harvex: modelled character failed, using the built-in body.', e); }
    if (!ch) ch = L.kind === 'companion' ? R.buildCompanion(L, mats) : R.buildHuman(L, mats);
    // The character before this one is let go after the next picture is drawn: until then its materials keep the
    // compiled programs alive, so the new one (which mostly needs the same programs) shows without a pause.
    if (this.char) { this.turn.remove(this.char.root); this.drop(); this.stale = this.char; }
    ch.mats = mats; this.char = ch; this.look = L; this.key = k; this.anim.relaxed = !!ch.sim;
    this.turn.add(ch.root); ch.root.updateMatrixWorld(true);
    ch.springs.forEach(sp => sp.reset());
    this.applyGlow(L);
  }
  drop() { const c = this.stale; if (c) { this.stale = null; c.mats.dispose(); if (c.dispose) c.dispose(); } }
  applyGlow(L) {
    const c = new T.Color(L.glow);
    if (this.ringGlow) this.ringGlow.material.color.copy(c);
    if (this.decal) this.decal.material.color.copy(c);
    this.rim.color.copy(new T.Color('#fff6dc').lerp(c, 0.3));
    if (this.shield) this.shield.material.uniforms.uC.value.copy(c);
    if (this.orbSpr) { this.orbSpr.material.color.copy(c); this.orbLight.color.copy(c); }
    if (this.scanRing) this.scanRing.children.forEach(m => m.material.color.copy(c));
    this.glowColor = '#' + c.getHexString();
  }
  play(name, o) { this.anim.play(name, o); }
  start() { if (this.running) return; this.running = true; this.clock.getDelta(); const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(Math.min(0.05, this.clock.getDelta())); }; loop(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  frame(dt) {
    const ch = this.char; if (!ch) return;
    const out = this.anim.update(dt);
    const J = ch.J;
    for (const j in out.Q) if (J[j] && j !== 'root') J[j].quaternion.copy(out.Q[j]);
    // root
    const hov = ch.extras.hover ? Math.sin(this.anim.g * 2.2) * ch.extras.hover : 0;
    const st = ch.stride || 1;                                         // a body with longer legs travels further with the same motion
    J.root.position.set(out.p.x * st + this.fxOffset.x, out.p.y * st + this.fxOffset.y + hov, out.p.z * st + this.fxOffset.z);
    J.root.rotation.y = out.ry;
    const bh = (R.BUILDS[this.look.build] || R.BUILDS.regular).h;
    J.scale.scale.set(out.sc.x * (ch.kind === 'human' ? bh : 1), out.sc.y * (ch.kind === 'human' ? bh : 1), out.sc.z * (ch.kind === 'human' ? bh : 1));
    if (ch.extras.spinRing) ch.extras.spinRing.rotation.y += dt * 0.9;
    // turntable
    if (!this.o.thumb) { this.yaw += this.yawVel * dt; this.yawVel *= Math.exp(-dt * 4); }
    this.turn.rotation.y = this.yaw;
    // yaw rate for cloth flare
    const ry = out.ry + this.yaw; this.yawRate = lerp(this.yawRate, dt > 0 ? angNorm(ry - this.lastRy) / dt : 0, 0.3); this.lastRy = ry;
    ch.extras.flare.forEach(f => { const k = 1 + clamp(Math.abs(this.yawRate) * 0.06, 0, 0.45); f.scale.set(k, 1 - (k - 1) * 0.35, k); });
    // look-at
    this.turn.updateMatrixWorld(true);
    let lx = 0, ly = 0;
    if (J.head && out.look > 0.01) {
      this.pointerActive = Math.max(0, this.pointerActive - dt);
      const tgt = this.pointerActive > 0 ? this.lookTarget : this.camera.position;
      const hp = new T.Vector3(); J.neck.getWorldPosition(hp);
      const inv = new T.Quaternion(); J.root.getWorldQuaternion(inv); inv.invert();
      const d = tgt.clone().sub(hp).applyQuaternion(inv);
      let yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y - 0.1, Math.hypot(d.x, d.z));
      if (Math.abs(yaw) > 1.9) yaw = 0;
      yaw = clamp(yaw, -0.75, 0.75); pitch = clamp(pitch, -0.35, 0.4);
      const k = 1 - Math.exp(-dt * 6);
      this.lookCur.x = lerp(this.lookCur.x, yaw * out.look, k); this.lookCur.y = lerp(this.lookCur.y, pitch * out.look, k);
      const qn = R.poseTools.toQ([this.lookCur.y * 0.35, this.lookCur.x * 0.4, 0]); J.neck.quaternion.multiply(qn);
      const qh = R.poseTools.toQ([this.lookCur.y * 0.55, this.lookCur.x * 0.55, -this.lookCur.x * 0.06]); J.head.quaternion.multiply(qh);
      lx = (yaw * out.look - this.lookCur.x) * 2 + this.lookCur.x * 0.6; ly = -this.lookCur.y * 1.5;
    }
    if (ch.face) { ch.face.set(out.expr); ch.face.update(Math.max(dt, 1 / 120), lx, ly); }
    if (ch.afterPose) ch.afterPose(out, dt, this.lookCur);              // a modelled body takes the pose over from the joints (and may play a clip instead)
    // small things a person does while standing around: now and then one of them plays by itself
    if (ch.sim && !this.o.thumb && this.o.fidget !== false && dt > 0 && this.anim.cur === this.anim.stance && (this.anim.stance === 'Idle' || this.anim.stance === 'Portrait')) {
      this.fidgetT = (this.fidgetT === undefined ? 4 + Math.random() * 4 : this.fidgetT) - dt;
      if (this.fidgetT <= 0) { this.fidgetT = 7 + Math.random() * 7; const f = FIDGETS[Math.floor(Math.random() * FIDGETS.length)]; this.anim.play(f[0], f[1] ? { temp: true, dur: f[1] } : {}); }
    }
    // halo bob
    J.root.traverse && (this._halo || (this._halo = null));
    ch.root.updateMatrixWorld(true);
    const sdt = Math.max(1 / 240, Math.min(dt, 1 / 30));
    if (dt > 0) ch.springs.forEach(sp => sp.update(sdt, this.yawRate));
    // fx
    this.updateFx(dt, out);
    // camera
    const dist = this.camDist * this.zoom * (this.fit || 1);
    this.camera.position.set(this.camTarget.x, this.camTarget.y + dist * Math.sin(this.camPitch), dist * Math.cos(this.camPitch));
    this.camera.lookAt(this.camTarget.x, this.camTarget.y - (this.zoom < 0.9 ? -0.25 * (1 - this.zoom) * 2 : 0), this.camTarget.z);
    this.ch = ch; this.renderer.render(this.scene, this.camera);
    if (this.stale) this.drop();
  }
  handPos(sd) { const v = new T.Vector3(); const h = this.char.J['ha' + sd]; if (h) { h.localToWorld(v.set(0, -0.06, 0.02)); } return v; }
  chestPos() { const v = new T.Vector3(); (this.char.J.chest || this.char.J.hips).localToWorld(v.set(0, 0.1, 0)); return v; }
  /* ----- powers ----- */
  cast(id) {
    if (!this.char) return 0;
    const now = { t: 0 }, P = this.parts, gc = () => this.glowColor || '#ffe600';
    const add = fn => { this.skills.push({ t: 0, fn }); };
    if (id === 'orb') {
      this.play('Cast');
      add((t, dt) => {
        const o = this.orb;
        if (t < 0.2) return true;
        if (t < 1.02) {
          const a = this.handPos('L').add(this.handPos('R')).multiplyScalar(0.5); a.y += 0.02;
          o.visible = true; o.position.copy(a); const k = sstep(0.2, 1.0, t); o.scale.setScalar(0.4 + k * 1.1); this.orbLight.intensity = k * 3;
          for (let i = 0; i < 3; i++) { const an = Math.random() * TAU, r = 0.25 + Math.random() * 0.2; P.emit({ x: a.x + Math.cos(an) * r, y: a.y + (Math.random() - 0.5) * 0.3, z: a.z + Math.sin(an) * r, vx: -Math.cos(an) * r * 3, vy: 0, vz: -Math.sin(an) * r * 3, life: 0.35, size: 0.05, color: gc(), drag: 0 }); }
          this.shotDir = new T.Vector3(0.12, 0.08, 1).applyQuaternion(this.char.root.getWorldQuaternion(new T.Quaternion())).normalize();
          return true;
        }
        if (t < 1.7) {
          o.position.addScaledVector(this.shotDir, dt * 4.2); o.scale.setScalar(1.5 + Math.sin(t * 40) * 0.1);
          for (let i = 0; i < 4; i++) P.emit({ x: o.position.x, y: o.position.y, z: o.position.z, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 0.45, size: 0.07, color: gc() });
          return true;
        }
        if (o.visible) { o.visible = false; this.orbLight.intensity = 0; for (let i = 0; i < 90; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 2.5); P.emit({ x: o.position.x, y: o.position.y, z: o.position.z, vx: v.x, vy: v.y, vz: v.z, life: 0.7 + Math.random() * 0.4, size: 0.06 + Math.random() * 0.05, color: i % 3 ? gc() : '#ffffff', drag: 2.5 }); } }
        return t < 2.2;
      });
      return 1.9;
    }
    if (id === 'shield') {
      this.play('Guard');
      add(t => {
        const s = this.shield, u = s.material.uniforms; s.visible = true; u.uT.value = t;
        const k = t < 0.45 ? 0 : t < 0.8 ? ease.back(sstep(0.45, 0.8, t)) : 1; const fade = 1 - sstep(3.2, 3.8, t);
        const c = this.char.root.position; s.position.set(c.x, 0.88, c.z); s.position.applyMatrix4(this.turn.matrixWorld);
        const big = this.look.kind === 'companion' ? 0.8 : 1;
        s.scale.set(0.6 * k * big, 0.98 * k * big, 0.6 * k * big); u.uA.value = fade * Math.min(1, k * 1.5) * (0.9 + 0.1 * Math.sin(t * 9));
        if (t > 0.45 && t < 0.6) for (let i = 0; i < 6; i++) { const v = new T.Vector3().randomDirection(); P.emit({ x: s.position.x + v.x * 0.8, y: s.position.y + v.y, z: s.position.z + v.z * 0.8, vx: v.x, vy: v.y, vz: v.z, life: 0.5, size: 0.05, color: gc() }); }
        if (t >= 3.8) { s.visible = false; return false; } return true;
      });
      return 3.8;
    }
    if (id === 'blink') {
      this.play('Blink');
      const side = Math.random() < 0.5 ? -1 : 1;
      add(t => {
        const burst = pos => { for (let i = 0; i < 70; i++) { const v = new T.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 1.6, (Math.random() - 0.5) * 1.2); P.emit({ x: pos.x + v.x * 0.3, y: v.y + 0.1, z: pos.z + v.z * 0.3, vx: v.x * 0.6, vy: 0.4 + Math.random(), vz: v.z * 0.6, life: 0.6 + Math.random() * 0.4, size: 0.045, color: i % 4 ? gc() : '#ffffff', drag: 2 }); } };
        const J = this.char.J;
        if (t > 0.32 && !this._b1) { this._b1 = 1; burst(new T.Vector3().setFromMatrixPosition(J.root.matrixWorld)); }
        const squish = t < 0.32 ? 1 : t < 0.45 ? 1 - sstep(0.32, 0.45, t) : t < 0.62 ? 0 : sstep(0.62, 0.8, t);
        J.root.visible = squish > 0.02; J.scale.scale.x *= Math.max(0.02, squish); J.scale.scale.z *= Math.max(0.02, squish);
        if (t > 0.55) this.fxOffset.x = side * 0.75 * (1 - sstep(1.6, 2.3, t));
        if (t > 1.6 && t < 2.3) this.fxOffset.y = Math.sin(sstep(1.6, 2.3, t) * PI) * 0.12;
        if (t > 0.6 && !this._b2) { this._b2 = 1; this.char.root.updateMatrixWorld(true); burst(new T.Vector3(side * 0.75, 0, 0).applyMatrix4(this.turn.matrixWorld)); this.char.springs.forEach(s => s.reset()); }
        if (t >= 2.3) { this.fxOffset.set(0, 0, 0); J.root.visible = true; this._b1 = this._b2 = 0; return false; }
        return true;
      });
      return 2.3;
    }
    if (id === 'levitate') {
      this.play('Float', { temp: true, dur: 3.6 });
      add((t, dt) => {
        const up = sstep(0.1, 0.8, t) * (1 - sstep(3.2, 3.9, t));
        this.fxOffset.y = up * (0.38 + Math.sin(t * 2.4) * 0.03);
        const c = new T.Vector3().setFromMatrixPosition(this.char.J.root.matrixWorld);
        if (up > 0.2) for (let i = 0; i < 2; i++) { const a = t * 5 + i * PI + Math.random() * 0.3; P.emit({ x: c.x + Math.cos(a) * 0.32, y: c.y - 0.02, z: c.z + Math.sin(a) * 0.32, vx: -Math.sin(a) * 0.4, vy: -0.25, vz: Math.cos(a) * 0.4, life: 0.7, size: 0.04, color: gc(), drag: 1 }); }
        for (const sd of ['L', 'R']) { const n = this.char.J['nozzle' + sd]; if (n && up > 0.05) { const p = new T.Vector3().setFromMatrixPosition(n.matrixWorld); for (let i = 0; i < 3; i++) P.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.2, vy: -1.4 - Math.random(), vz: (Math.random() - 0.5) * 0.2, life: 0.3, size: 0.07, color: i ? '#ffb347' : '#fff3c4', drag: 3 }); } }
        if (t >= 3.95) { this.fxOffset.y = 0; return false; } return true;
      });
      return 3.95;
    }
    if (id === 'scan') {
      this.play('Scan'); this.o.onEvent && this.o.onEvent('scan-start');
      add(t => {
        const r = this.scanRing; r.visible = true; const c = this.char.root.position;
        const u = (t % 1.25) / 1.25, y = (Math.floor(t / 1.25) % 2 === 0 ? u : 1 - u) * 1.8;
        r.position.set(c.x, y + 0.02, c.z).applyMatrix4(this.turn.matrixWorld); r.scale.setScalar(this.look.kind === 'companion' ? 0.9 : 0.75 + Math.sin(u * PI) * 0.1);
        r.children.forEach(m => m.material.opacity = (m.geometry.type === 'CircleGeometry' ? 0.3 : 1) * (1 - sstep(2.3, 2.6, t)));
        if (Math.random() < 0.5) { const a = Math.random() * TAU; P.emit({ x: r.position.x + Math.cos(a) * 0.4, y: r.position.y, z: r.position.z + Math.sin(a) * 0.4, vx: 0, vy: 0.2, vz: 0, life: 0.5, size: 0.035, color: gc() }); }
        if (t >= 2.6) { r.visible = false; this.o.onEvent && this.o.onEvent('scan-end'); return false; } return true;
      });
      return 2.6;
    }
    if (id === 'hype') {
      this.play('Cheer');
      const cols = ['#ffe600', '#ff6fb1', '#5ee0ff', '#ffffff', '#b28dff', '#ffd25e'];
      add(t => {
        if (!this._h) { this._h = 1; const c = new T.Vector3().setFromMatrixPosition(this.char.J.root.matrixWorld);
          for (let i = 0; i < 180; i++) { const a = Math.random() * TAU, r = 0.9 + Math.random() * 0.2; P.emit({ x: c.x + Math.cos(a) * r, y: 0.05, z: c.z + Math.sin(a) * r, vx: -Math.cos(a) * 0.4 + (Math.random() - 0.5) * 0.4, vy: 2.6 + Math.random() * 1.8, vz: -Math.sin(a) * 0.4 + (Math.random() - 0.5) * 0.4, life: 1.6 + Math.random() * 0.8, size: 0.045 + Math.random() * 0.03, color: cols[i % cols.length], grav: 3.2, drag: 0.6, shrink: false }); } }
        if (t > 2.4) { this._h = 0; return false; } return true;
      });
      return 2.5;
    }
    return 0;
  }
  updateFx(dt, out) {
    for (let i = this.skills.length - 1; i >= 0; i--) { const s = this.skills[i]; s.t += dt; if (!s.fn(s.t, dt)) this.skills.splice(i, 1); }
    this.parts.update(dt);
    if (this.holo) {
      const on = out.fx === 'holo' ? 1 : 0; this.holo.material.opacity = lerp(this.holo.material.opacity, on * 0.9, 1 - Math.exp(-dt * 6));
      this.holo.visible = this.holo.material.opacity > 0.02;
      if (this.holo.visible) {
        const J = this.char.J, c = new T.Vector3(); (J.hips).localToWorld(c.set(0, 0.2, 0.36));
        this.holo.position.copy(c); this.holo.quaternion.copy(J.root.getWorldQuaternion(new T.Quaternion())); this.holo.rotateX(-1.05);
        this.holoT += dt; if (this.holoT > 0.09) { this.holoT = 0; this.drawHolo(); }
      }
    }
    if (this.ringGlow) this.ringGlow.material.opacity = 1;
  }
  drawHolo() {
    const c = this.holoCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
    if (this.holoLines.length === 0 || Math.random() < 0.6) { this.holoLines.push({ ind: Math.floor(Math.random() * 4) * 24, len: 60 + Math.random() * 260, hi: Math.random() < 0.25 }); if (this.holoLines.length > 9) this.holoLines.shift(); }
    g.clearRect(0, 0, w, h); g.strokeStyle = this.glowColor || '#ffe600'; g.globalAlpha = 0.9; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.globalAlpha = 0.25; g.fillStyle = this.glowColor || '#ffe600'; g.fillRect(6, 6, w - 12, 30);
    g.globalAlpha = 1; this.holoLines.forEach((l, i) => { g.globalAlpha = l.hi ? 1 : 0.55; g.fillRect(28 + l.ind, 52 + i * 21, l.len, 9); });
    g.globalAlpha = Math.random() < 0.5 ? 1 : 0.2; const last = this.holoLines[this.holoLines.length - 1]; g.fillRect(28 + last.ind + last.len + 8, 52 + (this.holoLines.length - 1) * 21, 10, 12);
    this.holoTex.needsUpdate = true;
  }
  dispose() { this.gone = true; this.stop(); if (this.ro) this.ro.disconnect(); this.drop(); if (this.char && this.char.dispose) this.char.dispose(); this.renderer.dispose(); }
}
R.Stage = Stage;

/* ---------- thumbnails ---------- */
let THUMB = null;
/* `pose` picks the stance of the picture (R.PORTRAITS of them, each also mirrored); left out, it follows from the
   look, so one look always gets the same picture. The picture has the size asked for (before, the stage kept the
   size of its first picture). */
function poseOf(look) { const s = JSON.stringify([look.build, look.body, look.hair, look.top, look.bottom, look.skin]); let n = 7; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return n % (R.PORTRAITS * 2); }
R.poseOf = poseOf;
R.renderThumb = function (look, w = 220, h = 280, pose) {
  if (!THUMB) { const c = document.createElement('canvas'); THUMB = new Stage(c, { thumb: true, width: w, height: h }); }
  if (THUMB.o.width !== w || THUMB.o.height !== h) { THUMB.o.width = w; THUMB.o.height = h; THUMB.resize(); }
  THUMB.setLook(look, { now: true }); THUMB.anim = new R.Animator(3); THUMB.anim.g = 1.2;
  R.portrait = pose == null ? poseOf(normalizeLook(look)) : pose; THUMB.anim.play('Portrait');
  THUMB.char.springs.forEach(s => s.reset());
  for (let i = 0; i < 24; i++) THUMB.frame(1 / 30);
  THUMB.char.face && THUMB.char.face.set({ mouth: 'smile', eyes: 'open', brow: 0.1, raise: 0.3 });
  for (let i = 0; i < 6; i++) THUMB.frame(1 / 30);
  THUMB.char.face && THUMB.char.face.eyes.forEach(e => { e.visible = true; e.scale.y = 1; });
  if (THUMB.char.face && THUMB.char.face.rest) { const f = THUMB.char.face; f.rest(); if ('smile' in f && f.show) { f.smile = 0.55; f.brow = 0.45; f.show(); } }   // a modelled face: eyes open, looking ahead, a clear smile
  THUMB.renderer.render(THUMB.scene, THUMB.camera);
  return THUMB.canvas.toDataURL('image/webp', 0.9);
};
/** The same picture once the character's files are loaded (a human is a modelled character then). */
R.renderThumbAsync = function (look, w, h, pose) {
  const L = normalizeLook(look), md = R.sim && R.sim.wants(L) ? R.sim : R.models;
  const ready = md && md.wants(L) && !md.ready(L) ? md.ensure(L).catch(() => { md.failed = true; }) : Promise.resolve();
  return ready.then(() => R.renderThumb(look, w, h, pose));
};
})(window);

/* Harvex — companion bots (the ids scout, maker, guardian of saved looks) with screen faces and soft forms. */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX;
const { TAU } = R.util;
const { lathe, taper, sphere, capsule, torus, cyl, cone, rbox, cached } = R.geo;
const add = R.add, joint = R.joint;
const PI = Math.PI;

function buildCompanion(look, M) {
  const J = {}, springs = [], extras = { flare: [], float: [] };
  const root = new T.Group(); J.root = root;
  const scaleG = new T.Group(); root.add(scaleG); J.scale = scaleG;
  const body = M.get('body'), body2 = M.get('body2'), glow = M.get('glow'), screen = M.get('screen');
  const model = look.model;
  let face;
  if (model === 'scout') {
    const hips = joint(scaleG, 'hips', [0, 0.95, 0], J);
    const spine = joint(hips, 'spine', [0, 0, 0], J); const chest = joint(spine, 'chest', [0, 0, 0], J);
    const neck = joint(chest, 'neck', [0, 0, 0], J); const head = joint(neck, 'head', [0, 0, 0], J);
    add(head, sphere(0.3, 40, 30), body, [0, 0, 0], null, [1, 1.06, 0.98]);
    add(head, sphere(0.306, 40, 16, 0, TAU, 0, 1.05), body2, [0, 0.0, 0], [-0.25, 0, 0], [1, 1.06, 0.98]);
    add(head, sphere(0.21, 32, 20), screen, [0, -0.01, 0.2], null, [1.05, 0.78, 0.5]);
    face = buildFace2(head, M, { z: 0.308, y: -0.01, sp: 0.07, er: 0.024, my: 0.06 });
    const ant = joint(head, 'ant', [0, 0.3, -0.04]);
    add(ant, cyl(0.007, 0.007, 0.12, 8), M.get('metal'), [0, 0.06, 0]); add(ant, sphere(0.03), glow, [0, 0.13, 0]);
    springs.push(new R.Spring(ant, { k: 60, d: 3, g: 0, i: 0.025, lim: 0.8 }));
    const ring = joint(hips, 'ring', [0, -0.02, 0]);
    add(ring, torus(0.4, 0.022, 10, 48), M.get('grey'), [0, 0, 0], [PI / 2 + 0.2, 0, 0.1]);
    extras.spinRing = ring;
    for (const s of [1, -1]) {
      const sd = s > 0 ? 'L' : 'R';
      const cl = joint(chest, 'cl' + sd, [0.33 * s, 0.02, 0], J);
      const ua = joint(cl, 'ua' + sd, [0.02 * s, 0, 0], J); const fa = joint(ua, 'fa' + sd, [0, -0.07, 0], J); joint(fa, 'ha' + sd, [0, -0.05, 0], J);
      add(ua, capsule(0.018, 0.05, 4, 8), M.get('grey'), [0, -0.03, 0]);
      add(fa, sphere(0.06, 18, 14), body2, [0, -0.04, 0]);
      add(fa, torus(0.055, 0.008, 6, 18), glow, [0, -0.04, 0], [PI / 2, 0, 0], null, { noShadow: true });
    }
    extras.hover = 0.035;
  } else if (model === 'maker') {
    const hips = joint(scaleG, 'hips', [0, 0.46, 0], J);
    const spine = joint(hips, 'spine', [0, 0.02, 0], J); const chest = joint(spine, 'chest', [0, 0.12, 0], J);
    add(spine, rbox(0.46, 0.34, 0.34, 0.1, 5), body, [0, 0.12, 0]);
    add(spine, rbox(0.3, 0.12, 0.02, 0.03, 3), screen, [0, 0.08, 0.17]);
    for (let i = 0; i < 3; i++) add(spine, rbox(0.05, 0.03, 0.01, 0.01, 2), i === 1 ? glow : M.get('white'), [-0.08 + i * 0.08, 0.08, 0.182], null, null, { noShadow: true });
    const neck = joint(chest, 'neck', [0, 0.16, 0], J); const head = joint(neck, 'head', [0, 0.02, 0], J);
    add(head, rbox(0.44, 0.32, 0.32, 0.11, 5), M.get('white'), [0, 0.15, 0]);
    add(head, rbox(0.36, 0.23, 0.03, 0.07, 4), screen, [0, 0.15, 0.155]);
    face = buildFace2(head, M, { z: 0.175, y: 0.16, sp: 0.075, er: 0.024, my: 0.055 });
    add(head, rbox(0.12, 0.05, 0.08, 0.02, 2), body2, [0.1, 0.33, -0.02]);
    const ant = joint(head, 'ant', [-0.12, 0.3, 0]);
    add(ant, cyl(0.008, 0.008, 0.14, 8), M.get('metal'), [0, 0.07, 0]); add(ant, sphere(0.032), glow, [0, 0.15, 0]);
    springs.push(new R.Spring(ant, { k: 50, d: 3, g: 0, i: 0.03, lim: 0.9 }));
    for (const s of [1, -1]) {
      const sd = s > 0 ? 'L' : 'R';
      const cl = joint(chest, 'cl' + sd, [0.2 * s, 0.1, 0], J);
      const ua = joint(cl, 'ua' + sd, [0.05 * s, 0, 0], J); const fa = joint(ua, 'fa' + sd, [0, -0.13, 0], J); const ha = joint(fa, 'ha' + sd, [0, -0.13, 0], J);
      add(ua, sphere(0.05, 16, 12), M.get('grey'), [0, 0, 0]);
      add(ua, taper(0.034, 0.03, 0.13), M.get('grey'));
      add(fa, taper(0.03, 0.028, 0.13), M.get('white'));
      add(ha, rbox(0.07, 0.06, 0.06, 0.02, 2), body2, [0, -0.02, 0]);
      const th = joint(hips, 'th' + sd, [0.11 * s, -0.02, 0], J); const sh = joint(th, 'shin' + sd, [0, -0.18, 0], J); const ft = joint(sh, 'ft' + sd, [0, -0.17, 0], J);
      add(th, taper(0.05, 0.045, 0.18), M.get('grey'));
      add(sh, taper(0.045, 0.045, 0.17), M.get('white'));
      add(ft, rbox(0.12, 0.07, 0.18, 0.03, 3), M.get('grey'), [0, -0.02, 0.03]);
    }
  } else { // guardian
    const hips = joint(scaleG, 'hips', [0, 0.78, 0], J);
    const spine = joint(hips, 'spine', [0, 0, 0], J); const chest = joint(spine, 'chest', [0, 0.05, 0], J);
    const g = cached('guardBody', () => lathe([[0, -0.36], [0.08, -0.33], [0.2, -0.16], [0.28, 0.04], [0.3, 0.16], [0.26, 0.24], [0, 0.26]], 36, 0, TAU, 24));
    add(chest, g, body, [0, 0, 0], null, [1, 1, 0.74]);
    add(chest, rbox(0.14, 0.14, 0.03, 0.04, 3), screen, [0, 0.04, 0.215], [-0.15, 0, 0]);
    add(chest, torus(0.05, 0.01, 6, 20), glow, [0, 0.04, 0.235], [-0.15, 0, 0], null, { noShadow: true });
    const neck = joint(chest, 'neck', [0, 0.26, 0], J); const head = joint(neck, 'head', [0, 0.02, 0], J);
    add(head, sphere(0.18, 32, 24), M.get('white'), [0, 0.13, 0], null, [1.25, 0.86, 1.02]);
    add(head, rbox(0.34, 0.1, 0.05, 0.035, 3), screen, [0, 0.14, 0.165], [0, 0, 0], null);
    face = buildFace2(head, M, { z: 0.195, y: 0.145, sp: 0.07, er: 0.016, my: 0.1, noMouth: true });
    add(head, cone(0.03, 0.08, 8), body2, [0, 0.3, -0.02]);
    for (const s of [1, -1]) {
      const sd = s > 0 ? 'L' : 'R';
      const cl = joint(chest, 'cl' + sd, [0.3 * s, 0.12, 0], J);
      const ua = joint(cl, 'ua' + sd, [0.02 * s, 0, 0], J); const fa = joint(ua, 'fa' + sd, [0, -0.14, 0], J); joint(fa, 'ha' + sd, [0, -0.12, 0], J);
      add(ua, sphere(0.055, 16, 12), M.get('grey'));
      add(ua, rbox(0.05, 0.26, 0.16, 0.025, 3), body2, [0.03 * s, -0.1, 0], [0, 0, 0.1 * s]);
      add(ua, rbox(0.012, 0.16, 0.012, 0.005, 2), glow, [0.058 * s, -0.1, 0.02], [0, 0, 0.1 * s], null, { noShadow: true });
      add(fa, sphere(0.045, 14, 10), M.get('white'), [0.02 * s, -0.04, 0]);
    }
    const base = new T.Group(); base.position.y = 0.3; scaleG.add(base);
    add(base, torus(0.3, 0.03, 10, 44), M.get('grey'), [0, 0, 0], [PI / 2, 0, 0]);
    add(base, torus(0.3, 0.008, 6, 44), glow, [0, 0.02, 0], [PI / 2, 0, 0], null, { noShadow: true });
    extras.hover = 0.025;
  }
  J.face = face;
  return { root, J, springs, extras, kind: 'companion', face };
}
function buildFace2(head, M, o) { return R.buildScreenFace(head, M, o); }
R.buildCompanion = buildCompanion;
})(window);

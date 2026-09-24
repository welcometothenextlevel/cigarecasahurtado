/* The 3D cigar. One fixed WebGL canvas behind the first four sections.
   main.js feeds it scroll progress; everything else (pose blending, ember,
   smoke, line colours, exploded anatomy view) lives here. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LINES } from './data.js';

const L = 5.6;          // cigar length (world units)
const R = 0.3;          // radius
const ASH = 0.34;       // ash length when lit
const HEAD = L / 2, FOOT = -L / 2;
const TAU = Math.PI * 2;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t * t * (3 - 2 * t);

/* ---------- textures ---------- */

function leafCanvas(w = 1024, h = 2048, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
  // mottling
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 90;
    const light = rnd() > 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, light ? `rgba(255,255,255,${0.05 + rnd() * 0.08})` : `rgba(0,0,0,${0.06 + rnd() * 0.1})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fine fibres along the length
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * w, y = rnd() * h, len = 40 + rnd() * 220;
    g.strokeStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.06 + rnd() * 0.07})` : `rgba(0,0,0,${0.07 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 18, y + len); g.stroke();
  }
  // helical seams where the wrapper leaf overlaps itself + branching veins
  const slope = w * 0.9 / h; // u per v
  const wrapLine = (fn) => { for (let k = -2; k <= 2; k++) { g.save(); g.translate(k * w, 0); fn(); g.restore(); } };
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const x0 = rnd() * w;
    wrapLine(() => {
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + slope * h, h); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x0 + 4, 0); g.lineTo(x0 + 4 + slope * h, h); g.stroke();
    });
    // veins leaving the seam at an angle
    for (let v = 0; v < 26; v++) {
      const t = rnd(), y = t * h, x = x0 + slope * y;
      const dir = rnd() > 0.5 ? 1 : -1, len = 90 + rnd() * 260;
      wrapLine(() => {
        g.strokeStyle = `rgba(255,255,255,${0.22 + rnd() * 0.2})`;
        g.lineWidth = 1 + rnd() * 2.4;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + dir * len * 0.5, y + len * 0.15, x + dir * len, y + len * 0.55 * (rnd() + 0.4));
        g.stroke();
      });
    }
  }
  return c;
}

function drawBand(line, { metal = false, w = 2048, h = 640, scorpion }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const inkIsGold = line.key === 'maduro';
  const field = metal ? '#000' : line.band;
  const goldFill = () => {
    if (metal) return '#fff';
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f3dea0'); gr.addColorStop(0.5, '#b8913f'); gr.addColorStop(1, '#e8cd87');
    return gr;
  };
  const ink = metal ? (inkIsGold ? '#fff' : '#000') : line.ink;
  g.fillStyle = field; g.fillRect(0, 0, w, h);
  // gold borders
  g.fillStyle = goldFill();
  g.fillRect(0, 0, w, 34); g.fillRect(0, h - 34, w, 34);
  g.fillRect(0, 48, w, 6); g.fillRect(0, h - 54, w, 6);
  // filigree scrolls along the band
  g.strokeStyle = goldFill(); g.lineWidth = 5;
  const cy = h / 2;
  for (let x = 60; x < w; x += 150) {
    const dx = Math.abs(((x / w + 0.5) % 1) - 0.5) * w; // distance to medallion wrap-around centre (u=0.5)
    if (Math.abs(x - w / 2) < 330) continue;
    g.beginPath(); g.arc(x, cy - 60, 34, Math.PI * 0.2, Math.PI * 1.6); g.stroke();
    g.beginPath(); g.arc(x + 42, cy + 60, 34, Math.PI * 1.2, Math.PI * 2.6); g.stroke();
    g.beginPath(); g.moveTo(x + 20, cy - 30); g.bezierCurveTo(x + 40, cy - 5, x + 10, cy + 5, x + 30, cy + 30); g.stroke();
    void dx;
  }
  // CASA HURTADO on both flanks
  g.fillStyle = metal ? (inkIsGold ? '#fff' : '#000') : (inkIsGold ? goldFill() : line.ink);
  g.font = '600 64px "Bodoni Moda", Didot, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const spaced = t => t.split('').join(String.fromCharCode(8202));
  [w * 0.18, w * 0.82].forEach(x => { g.fillText(spaced('CASA HURTADO'), x, cy + 4); });
  // medallion at u = 0.5 (faces the camera, see thetaStart below)
  const mx = w / 2, mr = 250;
  g.fillStyle = field; g.beginPath(); g.ellipse(mx, cy, mr * 0.95, mr * 0.95 * (h / 640) * 1.05, 0, 0, TAU); g.fill();
  g.strokeStyle = goldFill(); g.lineWidth = 12;
  g.beginPath(); g.arc(mx, cy, mr - 30, 0, TAU); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(mx, cy, mr - 52, 0, TAU); g.stroke();
  // dotted inner ring
  for (let a = 0; a < TAU; a += TAU / 64) {
    g.fillStyle = goldFill(); g.beginPath(); g.arc(mx + Math.cos(a) * (mr - 70), cy + Math.sin(a) * (mr - 70), 3.2, 0, TAU); g.fill();
  }
  // scorpion + crown, tinted
  if (scorpion) {
    const sh = 290, sw = sh * scorpion.width / scorpion.height;
    const t = document.createElement('canvas'); t.width = sw; t.height = sh;
    const tg = t.getContext('2d'); tg.drawImage(scorpion, 0, 0, sw, sh);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = metal ? (inkIsGold ? '#fff' : '#000') : (inkIsGold ? '#d6b56a' : line.ink);
    tg.fillRect(0, 0, sw, sh);
    g.drawImage(t, mx - sw / 2, cy - sh / 2 - 22);
  }
  // PREMIUM CIGARS on the lower arc
  g.fillStyle = metal ? '#fff' : goldFill();
  g.font = '700 30px "Mulish", sans-serif';
  const text = 'PREMIUM  CIGARS'; const arcR = mr - 96; const span = 1.35;
  for (let i = 0; i < text.length; i++) {
    const a = Math.PI / 2 + span / 2 - (i / (text.length - 1)) * span;
    g.save(); g.translate(mx + Math.cos(a) * arcR, cy + Math.sin(a) * arcR); g.rotate(a - Math.PI / 2);
    g.fillText(text[i], 0, 0); g.restore();
  }
  return c;
}

function drawFootBand(line, { metal = false, w = 2048, h = 220 }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const silver = line.key === 'connecticut';
  g.fillStyle = metal ? (silver ? '#fff' : '#000') : line.foot; g.fillRect(0, 0, w, h);
  g.fillStyle = metal ? '#fff' : '#caa65a';
  g.fillRect(0, 10, w, 8); g.fillRect(0, h - 18, w, 8);
  g.fillStyle = metal ? (line.key === 'maduro' ? '#fff' : '#000') : (line.key === 'maduro' ? '#caa65a' : (silver ? '#3b3632' : '#fff'));
  g.font = '700 70px "Mulish", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = (line.key === 'maduro' ? 'MADURO' : line.name.toUpperCase()).split('').join(' ');
  [0.5, 0.0, 1.0].forEach(u => g.fillText(label, u * w, h / 2 + 3));
  return c;
}

function smokeSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 64 + (Math.random() - 0.5) * 40, y = 64 + (Math.random() - 0.5) * 40, r = 22 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,170,80,1)'); gr.addColorStop(0.25, 'rgba(255,110,30,0.45)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=.5; } return v; }
`;

/* ---------- scene ---------- */

export async function createScene(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.6 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x120a06, 0.55));
  const key = new THREE.DirectionalLight(0xffd8a8, 2.4); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9d57, 3.2); rim.position.set(5, 2, -5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xc9d4ff, 0.6); rim2.position.set(-6, -3, -4); scene.add(rim2);

  // wait for fonts + scorpion before painting canvases
  const scorpion = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'img/scorpion.png'; });
  try { await Promise.all([document.fonts.load('600 64px "Bodoni Moda"'), document.fonts.load('700 30px "Mulish"')]); } catch (e) { /* fallback fonts are fine */ }

  const leaf = new THREE.CanvasTexture(leafCanvas(1024, 2048, 3));
  leaf.colorSpace = THREE.SRGBColorSpace; leaf.wrapS = leaf.wrapT = THREE.RepeatWrapping;
  leaf.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const leafBump = new THREE.CanvasTexture(leafCanvas(1024, 2048, 3)); leafBump.wrapS = leafBump.wrapT = THREE.RepeatWrapping;
  const leaf2 = new THREE.CanvasTexture(leafCanvas(512, 1024, 7)); leaf2.colorSpace = THREE.SRGBColorSpace; leaf2.wrapS = leaf2.wrapT = THREE.RepeatWrapping;

  /* hierarchy: pose → [wrapperLayer, binderLayer, fillerLayer] → spin groups */
  const pose = new THREE.Group(); scene.add(pose);
  const wrapperLayer = new THREE.Group(), binderLayer = new THREE.Group(), fillerLayer = new THREE.Group();
  pose.add(wrapperLayer, binderLayer, fillerLayer);
  const spinW = new THREE.Group(), spinB = new THREE.Group(), spinF = new THREE.Group();
  wrapperLayer.add(spinW); binderLayer.add(spinB); fillerLayer.add(spinF);

  // wrapper: lathe from the ash line to the rounded head
  const y0 = FOOT + ASH;
  const pts = [];
  const bodyTop = HEAD - 0.42, steps = 60;
  for (let i = 0; i <= steps; i++) {
    const y = lerp(y0, bodyTop, i / steps);
    const wob = 1 + 0.006 * Math.sin(y * 7.3) + 0.004 * Math.sin(y * 17.1);
    pts.push(new THREE.Vector2(R * wob, y));
  }
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.max(0.0005, R * Math.cos(a)), bodyTop + 0.42 * Math.sin(a)));
  }
  const wrapperGeo = new THREE.LatheGeometry(pts, 128, Math.PI, TAU);
  const unroll = { value: 0 };
  const wrapperMat = new THREE.MeshPhysicalMaterial({
    map: leaf, bumpMap: leafBump, bumpScale: 3, color: new THREE.Color(LINES[0].wrapper),
    roughness: 0.58, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#6b4a2a'), side: THREE.DoubleSide,
  });
  wrapperMat.onBeforeCompile = sh => {
    sh.uniforms.uUnroll = unroll;
    sh.vertexShader = 'uniform float uUnroll;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3(normal);
        objectNormal = normalize(mix(objectNormal, vec3(0.,0.,1.), smoothstep(0.,1.,uUnroll)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float rr = length(position.xz);
        float ph = (uv.x - 0.5) * 6.2831853;               // -PI..PI, 0 faces the camera, seam at the back
        float vv = clamp((position.y - ${(FOOT + ASH).toFixed(3)}) / ${(HEAD - FOOT - ASH).toFixed(3)}, 0., 1.);
        float leafW = 0.5 + 0.5 * pow(sin(3.14159 * vv), 0.55);   // tapered like a real leaf
        vec3 flatPos = vec3(rr * ph * leafW, position.y, -0.12 * ph * ph);
        float k = smoothstep(0., 1., uUnroll);
        // curl open: the leaf rotates out from the back seam while flattening
        transformed = mix(transformed, flatPos, k);`);
  };
  const wrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
  spinW.add(wrapper);

  // band (thetaStart = PI so the medallion at u = .5 faces +Z)
  const bandTex = [], bandMetal = [], footTex = [], footMetal = [];
  LINES.forEach(line => {
    const t = new THREE.CanvasTexture(drawBand(line, { scorpion })); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; bandTex.push(t);
    bandMetal.push(new THREE.CanvasTexture(drawBand(line, { metal: true, scorpion })));
    const f = new THREE.CanvasTexture(drawFootBand(line, {})); f.colorSpace = THREE.SRGBColorSpace; f.anisotropy = 8; footTex.push(f);
    footMetal.push(new THREE.CanvasTexture(drawFootBand(line, { metal: true })));
  });
  const bandMat = new THREE.MeshStandardMaterial({ map: bandTex[0], metalnessMap: bandMetal[0], metalness: 1, roughness: 0.32, transparent: true });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.035, R * 1.035, 0.66, 128, 1, true, Math.PI, TAU), bandMat);
  band.position.y = HEAD - 1.35;
  spinW.add(band);
  const footMat = new THREE.MeshStandardMaterial({ map: footTex[0], metalnessMap: footMetal[0], metalness: 1, roughness: 0.3, transparent: true });
  const footBand = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.26, 128, 1, true, Math.PI, TAU), footMat);
  footBand.position.y = y0 + 0.62;
  spinW.add(footBand);

  // lit end: ash cylinder anchored at y0 growing downward, glowing seam, ember face
  const ashGroup = new THREE.Group(); ashGroup.position.y = y0; spinW.add(ashGroup);
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x8d8983, roughness: 1, map: leaf2, bumpMap: leaf2, bumpScale: 3 });
  const ashMesh = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R * 0.95, 1, 96, 1, true), ashMat);
  ashMesh.position.y = -0.5; ashGroup.add(ashMesh);
  const seam = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.0, 0.035, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, toneMapped: false }));
  seam.position.y = 0; ashGroup.add(seam);

  const emberU = { uTime: { value: 0 }, uLit: { value: 1 } };
  const emberMat = new THREE.ShaderMaterial({
    uniforms: emberU, transparent: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: NOISE + `
      uniform float uTime, uLit; varying vec2 vUv;
      void main(){
        vec2 p = vUv - .5; float r = length(p)*2.; float a = atan(p.y,p.x);
        // unlit: rolled filler leaves in cross section
        float swirl = fbm(vec2(a*2.5 + r*6., r*9.));
        vec3 filler = mix(vec3(.23,.13,.07), vec3(.52,.33,.18), swirl);
        filler *= .75 + .25*smoothstep(1.,.6,r);
        // lit: ash with breathing orange cracks
        float n = fbm(p*9. + vec2(0., uTime*.25));
        float cracks = smoothstep(.52,.72,n) * (0.6 + 0.4*sin(uTime*2.3 + n*9.));
        vec3 ash = mix(vec3(.28,.27,.26), vec3(.55,.53,.5), fbm(p*22.));
        vec3 glow = vec3(1.6,.55,.12) * cracks * (1.2 - r*.5);
        vec3 lit = ash*(1.-cracks) + glow;
        gl_FragColor = vec4(mix(filler, lit, uLit), 1.);
        #include <colorspace_fragment>
      }`,
  });
  const ember = new THREE.Mesh(new THREE.CircleGeometry(R * 0.98, 64), emberMat);
  ember.rotation.x = Math.PI / 2; // face -Y (down the axis)
  ashGroup.add(ember);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  glow.scale.set(1.6, 1.6, 1); scene.add(glow);
  const emberLight = new THREE.PointLight(0xff7a2a, 3, 3.5, 1.6); scene.add(emberLight);

  // binder: thinner, paler leaf that sits under the wrapper
  const binderMat = new THREE.MeshPhysicalMaterial({ map: leaf2, bumpMap: leaf2, bumpScale: 1.2, color: new THREE.Color('#b08a5c'), roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#5a3b1c') });
  const binder = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R * 0.93, L - 0.9, 96, 1, false), binderMat);
  binder.position.y = -0.05; spinB.add(binder);

  // filler: bunched leaves (seven folded rolls)
  const fillers = [];
  const fillerTints = ['#7b4d2b', '#93603a', '#6a3f22', '#a0703f', '#825330', '#5c361d', '#8d5a33'];
  const hexes = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * TAU / 6), Math.sin(i * TAU / 6)])];
  hexes.forEach(([hx, hz], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.29, R * 0.29, L - 1.2, 40, 1, false),
      new THREE.MeshPhysicalMaterial({ map: leaf2, bumpMap: leaf2, bumpScale: 2, color: new THREE.Color(fillerTints[i]), roughness: 0.8 }));
    m.userData.home = new THREE.Vector3(hx * R * 0.58, 0, hz * R * 0.58);
    m.position.copy(m.userData.home);
    spinF.add(m); fillers.push(m);
  });
  binderLayer.visible = false; fillerLayer.visible = false;

  /* smoke particles (CPU simulated, spawned at the ember's world position) */
  const N = mobile ? 42 : 80;
  const sPos = new Float32Array(N * 3), sAlpha = new Float32Array(N), sSize = new Float32Array(N), sRot = new Float32Array(N);
  const sVel = [], sAge = new Float32Array(N), sLife = new Float32Array(N);
  // negative age = not born yet, so the plume builds up gradually instead of sitting at the origin
  for (let i = 0; i < N; i++) { sLife[i] = 3.5 + Math.random() * 2.5; sAge[i] = -Math.random() * sLife[i]; sVel.push(new THREE.Vector3()); }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  sGeo.setAttribute('aRot', new THREE.BufferAttribute(sRot, 1));
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: smokeSprite() }, uScale: { value: 300 } },
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aAlpha, aSize, aRot; varying float vA, vR; uniform float uScale;
      void main(){ vA=aAlpha; vR=aRot; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*uScale/(-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA, vR;
      void main(){ vec2 c = gl_PointCoord-.5; float s=sin(vR), co=cos(vR); c = mat2(co,-s,s,co)*c + .5;
        vec4 t = texture2D(uTex, c); gl_FragColor = vec4(vec3(.86,.84,.82), t.a*vA); }`,
  });
  const smoke = new THREE.Points(sGeo, sMat); smoke.frustumCulled = false; scene.add(smoke);

  /* ---------- state ---------- */
  const view = { w: 1, h: 1, W: 1, H: 1, fit: 1 };
  const target = { nx: 0.2, ny: 0, rz: -0.95, rx: 0.25, s: 1, lit: 1, explode: 0, line: 0, opacity: 1 };
  const cur = { ...target };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let spin = 0, spinSpeed = 0.25, bandIdx = 0, bandFlip = 0, running = true, visible = true;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    view.w = w; view.h = h;
    view.H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.W = view.H * camera.aspect;
    view.fit = clamp(view.W / 7.2, 0.46, 1.1);
    sMat.uniforms.uScale.value = h / view.H * camera.position.z;
  }
  resize(); window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => { mouse.tx = e.clientX / view.w - 0.5; mouse.ty = e.clientY / view.h - 0.5; }, { passive: true });

  const tmp = new THREE.Vector3(), emberWorld = new THREE.Vector3(), upW = new THREE.Vector3();
  const colA = new THREE.Color(), colB = new THREE.Color();
  const clock = new THREE.Clock();

  function setBand(i) {
    if (i === bandIdx) return;
    bandIdx = i; bandFlip = 1;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    // ease towards target
    const k = 1 - Math.pow(0.0015, dt);
    for (const p in target) cur[p] = lerp(cur[p], target[p], p === 'line' ? k * 0.9 : k);
    mouse.x = lerp(mouse.x, mouse.tx, k * 0.5); mouse.y = lerp(mouse.y, mouse.ty, k * 0.5);

    const ex = ease(clamp(cur.explode));
    pose.position.set(cur.nx * view.W, cur.ny * view.H + Math.sin(t * 0.8) * 0.04 * (1 - ex), 0);
    pose.rotation.set(cur.rx + mouse.y * 0.25 * (1 - ex), mouse.x * 0.35 * (1 - ex), cur.rz, 'YXZ');
    pose.scale.setScalar(cur.s * view.fit);

    // spin around own axis; parks the medallion towards the camera while exploded
    if (ex > 0.02) { const home = Math.round(spin / TAU) * TAU; spin = lerp(spin, home, k * 1.4); }
    else spin += dt * spinSpeed;
    spinW.rotation.y = spin; spinB.rotation.y = spin * 0.7; spinF.rotation.y = spin * 0.5;

    // line colours
    const li = clamp(cur.line, 0, 3), a = Math.floor(li), b = Math.min(3, a + 1), f = ease(li - a);
    colA.set(LINES[a].wrapper); colB.set(LINES[b].wrapper);
    wrapperMat.color.copy(colA.lerp(colB, f)).multiplyScalar(1.08);
    setBand(Math.round(target.line));
    if (bandFlip > 0) {
      bandFlip = Math.max(0, bandFlip - dt * 1.6);
      const q = 1 - bandFlip;
      band.rotation.y = footBand.rotation.y = ease(q) * TAU;
      if (q > 0.5 && bandMat.map !== bandTex[bandIdx]) {
        bandMat.map = bandTex[bandIdx]; bandMat.metalnessMap = bandMetal[bandIdx];
        footMat.map = footTex[bandIdx]; footMat.metalnessMap = footMetal[bandIdx];
        bandMat.needsUpdate = footMat.needsUpdate = true;
      }
      band.scale.setScalar(1 + Math.sin(q * Math.PI) * 0.08);
    }

    // lit end
    const lit = clamp(cur.lit) * (1 - ex);
    ashGroup.scale.y = Math.max(0.001, lit * ASH);
    ember.position.y = -1; // the disc lies in the group's XZ plane, so the Y squash leaves it round
    emberU.uTime.value = t; emberU.uLit.value = lit;
    seam.material.opacity = lit; seam.visible = lit > 0.02;
    const flick = 0.75 + 0.25 * Math.sin(t * 7.1) * Math.sin(t * 3.3 + 1.2);
    ember.getWorldPosition(emberWorld);
    glow.position.copy(emberWorld); glow.material.opacity = lit * (0.35 + 0.35 * flick);
    glow.scale.setScalar((0.55 + flick * 0.25) * pose.scale.x);
    emberLight.position.copy(emberWorld); emberLight.intensity = lit * (2.2 + flick * 2.4);

    // exploded anatomy: wrapper lifts and unrolls, binder stays, filler drops and fans out
    binderLayer.visible = fillerLayer.visible = ex > 0.01;
    wrapperLayer.position.x = -ex * 1.25;
    binderLayer.position.x = ex * 0.05;
    fillerLayer.position.x = ex * 1.2;
    unroll.value = clamp((cur.explode - 0.35) / 0.65);
    bandMat.opacity = footMat.opacity = 1 - clamp(unroll.value * 2.2);
    band.visible = footBand.visible = bandMat.opacity > 0.01;
    fillers.forEach((m, i) => {
      const h = m.userData.home;
      m.position.set(h.x * (1 + ex * 2.2), (i % 2 ? 1 : -1) * ex * 0.08, h.z * (1 + ex * 3.2));
    });

    // smoke
    upW.set(0, 1, 0);
    const smokeOn = lit * (cur.opacity);
    for (let i = 0; i < N; i++) {
      const was = sAge[i];
      sAge[i] += dt;
      if (sAge[i] < 0) { sAlpha[i] = 0; continue; }
      if (sAge[i] > sLife[i] || was < 0) {
        sAge[i] = 0; sLife[i] = 3.2 + Math.random() * 2.6;
        sPos[i * 3] = emberWorld.x + (Math.random() - 0.5) * 0.08; sPos[i * 3 + 1] = emberWorld.y; sPos[i * 3 + 2] = emberWorld.z;
        sVel[i].set((Math.random() - 0.5) * 0.25, 0.32 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15);
        sRot[i] = Math.random() * TAU;
      }
      const u = sAge[i] / sLife[i];
      const sway = Math.sin(t * 0.7 + i * 1.7) * 0.45 + Math.sin(t * 1.9 + i) * 0.15;
      sPos[i * 3] += (sVel[i].x + sway * u) * dt;
      sPos[i * 3 + 1] += sVel[i].y * dt * (1 - u * 0.4);
      sPos[i * 3 + 2] += sVel[i].z * dt;
      sRot[i] += dt * 0.3 * (i % 2 ? 1 : -1);
      sSize[i] = (0.2 + u * 3.2) * pose.scale.x;
      sAlpha[i] = smokeOn * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.2 * (1 - u * 0.6);
    }
    sGeo.attributes.position.needsUpdate = sGeo.attributes.aAlpha.needsUpdate = sGeo.attributes.aSize.needsUpdate = sGeo.attributes.aRot.needsUpdate = true;

    canvas.style.opacity = cur.opacity.toFixed(3);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // screen positions of the anatomy callouts
  const anchors = {
    wrapper: [spinW, new THREE.Vector3(0, 1.1, 0)],
    band: [spinW, new THREE.Vector3(0, HEAD - 1.35, 0)],
    binder: [spinB, new THREE.Vector3(0, -1.2, R)],
    filler: [spinF, new THREE.Vector3(0, 0.9, 0)],
  };
  function project(name) {
    const [obj, local] = anchors[name];
    tmp.copy(local); obj.localToWorld(tmp); tmp.project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * view.w, y: (-tmp.y * 0.5 + 0.5) * view.h };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });

  return {
    target, cur, project,
    setVisible(v) { if (v !== visible) { visible = v; canvas.style.visibility = v ? 'visible' : 'hidden'; if (v) clock.getDelta(); } },
    setSpinSpeed(v) { spinSpeed = v; },
    snap() { Object.assign(cur, target); },
    destroy() { running = false; },
  };
}

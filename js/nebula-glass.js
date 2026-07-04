// nebula-glass.js — LIVE background engine for the Ayesha demo.
// The 21st.dev "Interactive Nebula Shader" (dhileepkumargm/liquid-shader),
// ported to vanilla three.js with the component's exact GLSL.
//
// DESKTOP (>900px): fullscreen nebula (component defaults: teal/pink palette,
//   center dimming ON) rendered into a texture that the bubbbly liquid-glass
//   card shader refracts. One canvas, one WebGL context.
// MOBILE (<=900px, per Malik 2026-07-04): the nebula lives INSIDE the glass
//   card only — a small canvas inside .callcard (low opacity, slow pace, no
//   center dimming), page behind stays clean black so text reads clean. The
//   canvas is DOM-attached to the card, so it scrolls WITH it: no glass drift.
//
// CSP-safe: three.js from esm.sh (allowed), no inline scripts.
import * as THREE from "https://esm.sh/three@0.170.0";

const MOBILE = window.matchMedia("(max-width: 900px)").matches;
const MOBILE_TIME_SCALE = 0.35; // slow pace inside the card

const card = document.querySelector(".callcard");

const NEBULA_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const NEBULA_FRAG = `
  precision mediump float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec2 iMouse;
  uniform bool hasActiveReminders;
  uniform bool hasUpcomingReminders;
  uniform bool disableCenterDimming;
  varying vec2 vUv;

  #define t iTime
  mat2 m(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
  float map(vec3 p){
    p.xz *= m(t*0.4);
    p.xy *= m(t*0.3);
    vec3 q = p*2. + t;
    return length(p + vec3(sin(t*0.7))) * log(length(p)+1.0)
         + sin(q.x + sin(q.z + sin(q.y))) * 0.5 - 1.0;
  }

  void mainImage(out vec4 O, in vec2 fragCoord) {
    vec2 uv = fragCoord / min(iResolution.x, iResolution.y) - vec2(.9, .5);
    uv.x += .4;
    vec3 col = vec3(0.0);
    float d = 2.5;

    for (int i = 0; i <= 5; i++) {
      vec3 p = vec3(0,0,5.) + normalize(vec3(uv, -1.)) * d;
      float rz = map(p);
      float f  = clamp((rz - map(p + 0.1)) * 0.5, -0.1, 1.0);

      vec3 base = hasActiveReminders
        ? vec3(0.05,0.2,0.5) + vec3(4.0,2.0,5.0)*f
        : hasUpcomingReminders
        ? vec3(0.05,0.3,0.1) + vec3(2.0,5.0,1.0)*f
        : vec3(0.1,0.3,0.4) + vec3(5.0,2.5,3.0)*f;

      col = col * base + smoothstep(2.5, 0.0, rz) * 0.7 * base;
      d += min(rz, 1.0);
    }

    float dist   = distance(fragCoord, iResolution*0.5);
    float radius = min(iResolution.x, iResolution.y) * 0.5;
    float dim    = disableCenterDimming
                 ? 1.0
                 : smoothstep(radius*0.3, radius*0.5, dist);

    O = vec4(col, 1.0);
    if (!disableCenterDimming) {
      O.rgb = mix(O.rgb * 0.3, O.rgb, dim);
    }
  }

  void main() {
    mainImage(gl_FragColor, vUv * iResolution);
  }
`;

function makeNebula(disableCenterDimming) {
  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2() },
    iMouse: { value: new THREE.Vector2() },
    hasActiveReminders: { value: false },
    hasUpcomingReminders: { value: false },
    disableCenterDimming: { value: disableCenterDimming },
  };
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG }),
  ));
  return { scene, uniforms };
}

function boot() {
  if (MOBILE) bootMobile();
  else bootDesktop();
}

/* ================= MOBILE: nebula inside the glass card only ================= */
function bootMobile() {
  const canvas = document.createElement("canvas");
  canvas.className = "callcard-nebula";
  card.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    canvas.remove();
    document.documentElement.classList.add("glass-fallback");
    return;
  }

  const { scene, uniforms } = makeNebula(true); // no center dimming inside the card
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clock = new THREE.Clock();

  function syncSize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    if (canvas.width !== Math.round(w * DPR) || canvas.height !== Math.round(h * DPR)) {
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      uniforms.iResolution.value.set(w, h);
    }
    return true;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!syncSize()) return;
    uniforms.iTime.value = clock.getElapsedTime() * MOBILE_TIME_SCALE;
    renderer.render(scene, cam);
  }

  document.documentElement.classList.add("glass-mobile");
  animate();
}

/* ================= DESKTOP: fullscreen nebula + liquid-glass card ================= */
function bootDesktop() {
  const canvas = document.getElementById("glassCanvas");
  if (!canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    document.documentElement.classList.add("glass-fallback");
    return;
  }

  const { scene: nebulaScene, uniforms: nebulaUniforms } = makeNebula(false);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clock = new THREE.Clock();
  window.addEventListener("mousemove", (e) => {
    nebulaUniforms.iMouse.value.set(e.clientX, window.innerHeight - e.clientY);
  });

  /* glass pass (bubbbly shader, sampling the nebula texture) */
  const glassScene = new THREE.Scene();
  let rt = null;

  const glassUniforms = {
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    uImgRes: { value: new THREE.Vector2(1, 1) },
    uCardPos: { value: new THREE.Vector2(0, 0) },
    uCardHalf: { value: new THREE.Vector2(1, 1) },
    uWhite: { value: 0.0 },
    uDim: { value: 1.0 },
    uPx: { value: 1.0 },
    iChannel0: { value: null },
  };

  const glassMat = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: "void main(){ gl_Position = vec4(position, 1.0); }",
    fragmentShader: `
uniform vec3 iResolution;
uniform vec2 uImgRes;
uniform vec2 uCardPos;
uniform vec2 uCardHalf;
uniform float uWhite;
uniform float uDim;
uniform float uPx;
uniform sampler2D iChannel0;

vec2 coverUv(vec2 uv) {
  float ca = iResolution.x / iResolution.y;
  float ia = uImgRes.x / uImgRes.y;
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  const float POWER_EXPONENT = 6.0;
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution.xy;

  vec2 d = (fragCoord - uCardPos) / uCardHalf;
  float roundedBox = pow(abs(d.x), POWER_EXPONENT) + pow(abs(d.y), POWER_EXPONENT);

  float rb1 = clamp((1.0 - roundedBox) * 8.0, 0.0, 1.0);
  float rb2 = clamp((0.955 - roundedBox * 0.95) * 16.0, 0.0, 1.0) -
              clamp((0.91  - roundedBox * 0.95) * 16.0, 0.0, 1.0);
  float rb3 = clamp((1.5 - roundedBox * 1.1) * 2.0, 0.0, 1.0) -
              clamp((1.0 - roundedBox * 1.1) * 2.0, 0.0, 1.0);

  vec4 bg = texture2D(iChannel0, coverUv(uv));
  bg.rgb *= uDim;
  float transition = smoothstep(0.0, 1.0, rb1 + rb2);
  vec4 color = bg;

  if (transition > 0.0) {
    vec2 cuv = uCardPos / iResolution.xy;
    vec2 lens = cuv + (uv - cuv) * (1.0 - roundedBox * 0.22);

    vec4 acc = vec4(0.0);
    float total = 0.0;
    for (float x = -4.0; x <= 4.0; x++) {
      for (float y = -4.0; y <= 4.0; y++) {
        vec2 off = vec2(x, y) * 1.2 * uPx / iResolution.xy;
        acc += texture2D(iChannel0, coverUv(lens + off));
        total += 1.0;
      }
    }
    acc /= total;
    acc.rgb *= uDim;

    float dy = uv.y - cuv.y;
    float gradient = clamp((clamp(dy, 0.0, 0.2) + 0.1) / 2.0, 0.0, 1.0) +
                     clamp((clamp(-dy, -1000.0, 0.2) * rb3 + 0.1) / 2.0, 0.0, 1.0);
    vec4 lighting = clamp(acc + vec4(rb1) * gradient + vec4(rb2) * 0.3, 0.0, 1.0);

    lighting = mix(lighting, vec4(1.0), uWhite * 0.97);
    color = mix(bg, lighting, transition);
  }
  gl_FragColor = vec4(color.rgb, 1.0);
}`,
  });
  glassScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glassMat));

  /* sizing (per-frame: survives viewport changes) */
  let DPR = 1;
  function syncSize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const bw = Math.round(w * DPR);
    const bh = Math.round(h * DPR);
    if (canvas.width !== bw || canvas.height !== bh) {
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      nebulaUniforms.iResolution.value.set(w, h); // component uses CSS-px resolution
      if (rt) rt.dispose();
      rt = new THREE.WebGLRenderTarget(bw, bh);
      glassUniforms.iChannel0.value = rt.texture;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    syncSize();
    if (!rt) return;

    nebulaUniforms.iTime.value = clock.getElapsedTime();

    renderer.setRenderTarget(rt);
    renderer.render(nebulaScene, quadCam);
    renderer.setRenderTarget(null);

    const rect = card.getBoundingClientRect();
    glassUniforms.iResolution.value.set(canvas.width, canvas.height, 1);
    glassUniforms.uImgRes.value.set(canvas.width, canvas.height);
    glassUniforms.uCardPos.value.set(
      (rect.left + rect.width / 2) * DPR,
      canvas.height - (rect.top + rect.height / 2) * DPR,
    );
    glassUniforms.uCardHalf.value.set((rect.width / 2 + 4) * DPR, (rect.height / 2 + 4) * DPR);
    glassUniforms.uPx.value = DPR;
    renderer.render(glassScene, quadCam);
  }

  document.documentElement.classList.add("glass-on");
  animate();
}

if (card) boot();

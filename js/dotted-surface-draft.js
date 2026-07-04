// dotted-surface-draft.js — DRAFT A background for the Ayesha demo.
// The 21st.dev "Dotted Surface" (sshahaider) three.js particle wave, ported to
// vanilla JS with the component's exact parameters, rendered into a texture that
// the bubbbly liquid-glass card shader then refracts. One canvas, one WebGL
// context, no per-frame CPU copies. CSP-safe: three.js from esm.sh (allowed).
import * as THREE from "https://esm.sh/three@0.170.0";

const canvas = document.getElementById("glassCanvas");
const card = document.querySelector(".callcard");
if (canvas && card) boot();

function boot() {
  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    document.documentElement.classList.add("glass-fallback");
    return;
  }
  const MAX_DPR = 2;

  /* ---------- dotted surface scene (exact component parameters) ---------- */
  const SEPARATION = 150;
  const AMOUNTX = 40;
  const AMOUNTY = 60;

  const dotsScene = new THREE.Scene();
  dotsScene.fog = new THREE.Fog(0xffffff, 2000, 10000);
  dotsScene.background = new THREE.Color(0x010004); // page --bg behind the dots

  const dotsCam = new THREE.PerspectiveCamera(60, 1, 1, 10000);
  dotsCam.position.set(0, 355, 1220);

  const positions = [];
  const colors = [];
  const geometry = new THREE.BufferGeometry();
  for (let ix = 0; ix < AMOUNTX; ix++) {
    for (let iy = 0; iy < AMOUNTY; iy++) {
      const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
      const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
      positions.push(x, 0, z);
      colors.push(200, 200, 200); // component's dark-theme values (clamp to white)
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 8,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  });
  dotsScene.add(new THREE.Points(geometry, material));
  let count = 0;

  /* ---------- glass pass (bubbbly shader, sampling the dots render target) ---------- */
  const glassScene = new THREE.Scene();
  const glassCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let rt = null;

  const glassUniforms = {
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    uImgRes: { value: new THREE.Vector2(1, 1) },
    uCardPos: { value: new THREE.Vector2(0, 0) },
    uCardHalf: { value: new THREE.Vector2(1, 1) },
    uWhite: { value: 0.0 },
    uDim: { value: 1.0 }, // dots bg is already dark
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

  /* ---------- sizing (per-frame: survives mobile URL-bar collapse) ---------- */
  let DPR = 1;
  function syncSize() {
    DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const bw = Math.round(w * DPR);
    const bh = Math.round(h * DPR);
    if (canvas.width !== bw || canvas.height !== bh) {
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      dotsCam.aspect = w / Math.max(1, h);
      dotsCam.updateProjectionMatrix();
      if (rt) rt.dispose();
      rt = new THREE.WebGLRenderTarget(bw, bh);
      glassUniforms.iChannel0.value = rt.texture;
    }
  }

  /* ---------- render loop ---------- */
  function animate() {
    requestAnimationFrame(animate);
    syncSize();
    if (!rt) return;

    // exact component wave animation
    const pos = geometry.attributes.position;
    const arr = pos.array;
    let i = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        arr[i * 3 + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
        i++;
      }
    }
    pos.needsUpdate = true;
    count += 0.1;

    // pass 1: dots into the texture
    renderer.setRenderTarget(rt);
    renderer.render(dotsScene, dotsCam);
    renderer.setRenderTarget(null);

    // pass 2: liquid glass over it, tracking the call card
    const rect = card.getBoundingClientRect();
    glassUniforms.iResolution.value.set(canvas.width, canvas.height, 1);
    glassUniforms.uImgRes.value.set(canvas.width, canvas.height);
    glassUniforms.uCardPos.value.set(
      (rect.left + rect.width / 2) * DPR,
      canvas.height - (rect.top + rect.height / 2) * DPR,
    );
    glassUniforms.uCardHalf.value.set((rect.width / 2 + 4) * DPR, (rect.height / 2 + 4) * DPR);
    glassUniforms.uPx.value = DPR;
    renderer.render(glassScene, glassCam);
  }

  document.documentElement.classList.add("glass-on");
  animate();
}

// Talk to Ayesha, Vapi web call (public key, safe to expose) + siri-wave visualizer.
import Vapi from "https://esm.sh/@vapi-ai/web@2";

const PUBLIC_KEY   = "3abf07c7-8a64-4701-a303-79ad43434d37";     // Vapi PUBLIC key
const ASSISTANT_ID = "63210d1b-1133-4753-9ed3-1d35ef802ddf";     // Skyline Estate Lahore (Urdu Demo)

/* =====================================================================
   Siri-wave (WebGL). Ported from the SiriWave "wave" variant into vanilla
   JS for this static page, with one added uniform `uActive` (0..1) so the
   wave stays flat/minimal at rest and expands only while there is talking.
   ===================================================================== */
const VERTEX_SHADER = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;

const WAVE_SHADER = `precision highp float;
uniform vec2 iResolution; uniform float iTime; uniform float uActive;
const float PI = 3.14159265359;
const float AMPLITUDE   = 0.32;
const float FREQ        = 1.1;
const float ABER_FREQ   = 1.0;
const float SPEED       = 2.4;
const float WAVE_SCALE  = 0.6;
const float ABERRATION  = 2.6;
const float THICKNESS   = 3.0;
const float INTENSITY   = 2.;
const float FALLOFF     = 1.7;
const float EDGE_MASK   = 0.4;
const float EDGE_INSET  = 0.0;
const float BAND_FILL   = 30000.0;
const float BAND_THICK  = 0.08;
const float SOFTNESS    = 2.5;
const float LOW_AMP     = 6.0;
const float LOW_INT     = 1.5;
const float MID_ABER    = 0.8;
const float MID_ABAMP   = 0.05;
const float MID_BAND    = 20.0;
const float MID_SOFT    = 0.4;
const float HIGH_ABER   = 0.5;
const float HIGH_ABAMP  = 0.06;
const float RESOLVED    = 1.0;
const float UNRES_SCALE = 0.14;

vec3 spectral4(int s){
    float x = float(s);
    return clamp(vec3(abs(x-3.0)-1.0, 2.0-abs(x-2.0), 2.0-abs(x-4.0)), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 R = iResolution.xy;
    float aspect = R.x / R.y;
    vec2 p = (fragCoord + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;
    p /= max(WAVE_SCALE, 0.1);

    float t   = iTime;
    float low  = clamp(0.45 + 0.45*sin(t*0.8)*sin(t*0.37+1.0), 0.0, 1.0);
    float mid  = clamp(0.40 + 0.40*sin(t*1.7+2.0)*sin(t*0.53), 0.0, 1.0);
    float high = clamp(0.30 + 0.30*sin(t*2.9+4.0)*sin(t*0.71+2.0), 0.0, 1.0);

    // gate the wave height by talking state: near-flat lines at rest, full wave when active
    float uAmp = mix(0.045, 1.0, clamp(uActive, 0.0, 1.0));

    float res   = clamp(RESOLVED, 0.0, 1.0);
    float drift = mod(t, 20.0*PI) * SPEED;

    float xN  = p.x / max(aspect, 1.0);
    float env = cos(PI*0.5 * min(abs(0.9*xN), 1.0));
    env *= env;

    float A1    = (AMPLITUDE + 0.01*low*LOW_AMP) * uAmp;
    float A2    = A1 + (mid*MID_ABAMP + high*HIGH_ABAMP) * uAmp;
    float AB    = (ABERRATION + mid*MID_ABER + high*HIGH_ABER)*res;
    float th    = mix(0.1, 0.01*THICKNESS, res);
    float inten = mix(0.1, 0.01*(INTENSITY + low*LOW_INT), res);
    float soft  = 0.01*res*max(0.0, SOFTNESS + mid*MID_SOFT);

    float dUnres = max(length(p) - mix(0.14, UNRES_SCALE, res), 0.0);
    float yMain = A1 * env * res * sin(p.x*FREQ + drift);

    float bandFillTh = max(BAND_THICK, 1e-4);
    float bandAmt    = 1e-4 * BAND_FILL * inten;
    vec3 num = vec3(0.0), den = vec3(0.0);
    for(int s = 0; s < 4; s++){
        vec3 hue = mix(vec3(1.0), spectral4(s), res);
        den += hue;
        float ab = mix(-AB, AB, float(s)/3.0);
        float yL = A2 * env * res * sin(p.x*ABER_FREQ + drift + ab);
        float d   = mix(dUnres, abs(p.y - yL), res);
        float lor = mix(1.0/(1.0 + (0.02*d)*(0.02*d)), 1.0, res);
        float line = inten / (sqrt(d*d + soft*soft) + th);
        float lo = min(yMain, yL), hi = max(yMain, yL);
        float dBand = max(0.0, max(p.y - hi, lo - p.y));
        float band  = bandAmt / (dBand + bandFillTh);
        num += hue * lor * (line + band);
    }
    vec3 col = num / den;

    float dM    = mix(dUnres, abs(p.y - yMain), res);
    float lorM  = mix(1.0/(1.0 + (0.02*dM)*(0.02*dM)), 1.0, res);
    float boost = (1.0 - res) * (14.0*low + 4.0);
    col += 0.5 * inten * (lorM + boost) / (sqrt(dM*dM + soft*soft) + th);

    col = pow(max(col, 0.0), vec3(1.5));
    float emT = clamp((abs(yScreen) - 1.0 + EDGE_INSET) / (-max(EDGE_MASK, 1e-4)), 0.0, 1.0);
    float em  = emT*emT*(3.0 - 2.0*emT);
    float gauss = exp(-pow(xN*FALLOFF, 2.0));
    col *= mix(1.0, em*gauss, res);
    col *= res;
    fragColor = vec4(col, 1.0);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }`;

function initSiri(canvas) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return { setTarget() {} };

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
    }
    return sh;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, WAVE_SHADER));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "iResolution");
  const uTime = gl.getUniformLocation(program, "iTime");
  const uAct = gl.getUniformLocation(program, "uActive");

  function resize() {
    const r = canvas.getBoundingClientRect();
    const scale = 0.75, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(2, Math.round(r.width  * scale * dpr));
    canvas.height = Math.max(2, Math.round(r.height * scale * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  let active = 0, target = 0;
  const start = performance.now();
  (function frame() {
    active += (target - active) * 0.08;           // smooth ease toward target
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1000);
    gl.uniform1f(uAct, active);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  })();

  return { setTarget: (v) => { target = v; } };
}

/* =====================================================================
   Vapi call
   ===================================================================== */
const siri   = initSiri(document.getElementById("siri"));
const vapi   = new Vapi(PUBLIC_KEY);
const btn    = document.getElementById("talkBtn");
const label  = document.getElementById("talkLabel");
const status = document.getElementById("callStatus");

let inCall = false;
const LIVE_BASE = 0.28;   // gentle wave while connected + listening
const SPEAK     = 1.0;    // full wave while Ayesha speaks

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

btn.addEventListener("click", async () => {
  if (inCall) { vapi.stop(); return; }
  try {
    btn.disabled = true;
    setStatus("Connecting...");
    await vapi.start(ASSISTANT_ID);
  } catch (e) {
    console.error("start failed", e);
    setStatus("Mic blocked or error, allow mic and retry");
    btn.disabled = false;
  }
});

vapi.on("call-start", () => {
  inCall = true;
  btn.disabled = false;
  btn.classList.add("is-live");
  label.textContent = "End call";
  setStatus("Ayesha is listening, speak in Urdu", true);
  siri.setTarget(LIVE_BASE);
});

vapi.on("call-end", () => {
  inCall = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to Ayesha";
  setStatus("Call ended, tap to talk again");
  siri.setTarget(0);
});

vapi.on("speech-start", () => siri.setTarget(SPEAK));
vapi.on("speech-end",   () => siri.setTarget(inCall ? LIVE_BASE : 0));

// bonus: if the SDK reports assistant output volume, ride it while speaking
vapi.on("volume-level", (v) => {
  if (inCall) siri.setTarget(Math.max(LIVE_BASE, Math.min(1, LIVE_BASE + v * 1.4)));
});

vapi.on("error", (e) => {
  console.error("vapi error", e);
  inCall = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to Ayesha";
  setStatus("Something went wrong, tap to retry");
  siri.setTarget(0);
});

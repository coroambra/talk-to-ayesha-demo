// Talk to Sarah (English demo), Vapi web call + siri-wave visualizer (reacts to both
// voices) + a 3-agent picker. Same backend code as Ayesha's demo.js; only the assistant
// selection and the on-screen English copy differ. The Urdu Ayesha page (index.html +
// demo.js) is untouched.
//
// Sarah / Alina / Zara are THREE separate Vapi assistants, each with its own name,
// persona and ElevenLabs voice baked in (no runtime overrides => full latency + prompt
// quality). The picker just chooses which assistant to start, so each introduces herself
// by her own name. Sarah is the recommended default.
import Vapi from "https://esm.sh/@vapi-ai/web@2";
import { createSiriWave } from "./siri-wave.js";
import { micPreflight, releaseMic, watchMic, MIC_ERRORS } from "./mic-preflight.js";

const PUBLIC_KEY = "3abf07c7-8a64-4701-a303-79ad43434d37";        // Vapi PUBLIC key (org-wide)

const LIVE_BASE = 0.28;   // gentle wave while connected
const SPEAK     = 1.0;    // full wave while the agent speaks

const siri   = createSiriWave(document.getElementById("siri"), { idle: 0.05 });
const vapi   = new Vapi(PUBLIC_KEY);
const btn    = document.getElementById("talkBtn");
const label  = document.getElementById("talkLabel");
const status = document.getElementById("callStatus");
const pick   = document.getElementById("voicePick");
const pills  = pick ? Array.from(pick.querySelectorAll(".voicepill")) : [];
const blurb  = document.getElementById("voiceBlurb");   // one-line persona of the selected agent

// default = the recommended agent (the pill marked is-active in the markup: Sarah)
const first = pills.find((p) => p.classList.contains("is-active")) || pills[0];
let selectedAgent = { assistantId: first.dataset.assistant, name: first.dataset.name };

let inCall = false;
let assistantSpeaking = false;

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

/* ---- Agent picker: choose Sarah / Alina / Zara before tapping Talk ---- */
function setPickerEnabled(on) { pills.forEach((p) => { p.disabled = !on; }); }
pills.forEach((p) => {
  p.addEventListener("click", () => {
    if (inCall) return;                       // locked during a live call
    pills.forEach((x) => x.classList.remove("is-active"));
    p.classList.add("is-active");
    selectedAgent = { assistantId: p.dataset.assistant, name: p.dataset.name };
    label.textContent = "Talk to " + selectedAgent.name;
    if (blurb && p.dataset.blurb) blurb.textContent = p.dataset.blurb;   // swap to this agent's persona line
  });
});

/* ---- Prospect mic reactivity: reuse the PREFLIGHTED stream (see mic-preflight.js) ----
   This no longer opens the microphone itself. The stream was already acquired and proven
   to be delivering real audio before the call was allowed to start, and it stays open for
   the whole call, so nothing is ever torn down and re-opened underneath Vapi. */
let mic = null;                                  // { stream, audioCtx, analyser, micData }
let unwatchMic = null;
let micRAF = 0, micRunning = false;

function startMic() {
  if (!mic) { micRunning = false; return; }
  micRunning = true;
  loopMic();
}
function loopMic() {
  if (!mic || !mic.analyser) return;
  mic.analyser.getByteTimeDomainData(mic.micData);
  let sum = 0;
  const d = mic.micData;
  for (let i = 0; i < d.length; i++) { const v = (d[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / d.length);
  const userLevel = Math.min(1, rms * 4.2);
  // wave rides whichever is louder: the caller's voice or the agent speaking
  siri.setTarget(Math.max(LIVE_BASE, assistantSpeaking ? SPEAK : 0, userLevel));
  micRAF = requestAnimationFrame(loopMic);
}
function stopMic() {
  micRunning = false;
  if (micRAF) cancelAnimationFrame(micRAF), (micRAF = 0);
  if (unwatchMic) { unwatchMic(); unwatchMic = null; }
  releaseMic(mic);
  mic = null;
}

/* ---- Call control ---- */
btn.addEventListener("click", async () => {
  if (inCall) { vapi.stop(); return; }
  btn.disabled = true;
  setPickerEnabled(false);

  // STEP 1: the mic must be granted, live, unmuted AND actually delivering audio frames
  // before we connect. The old code granted permission then immediately stopped the
  // tracks, which handed Vapi a live-but-silent device on some phones and killed the call
  // with `error-assistant-did-not-receive-customer-audio`. We now keep the stream open.
  try {
    setStatus("Checking your microphone...");
    mic = await micPreflight();
  } catch (e) {
    console.error("mic preflight failed", e.code, e);
    setStatus(MIC_ERRORS[e.code] || MIC_ERRORS.DENIED);
    btn.disabled = false;
    setPickerEnabled(true);
    return;                                   // never start a call we know has no audio
  }

  // If the mic dies mid-call (headset unplugged, OS mute, another app grabs it), say so
  // instead of letting the caller talk into a void.
  unwatchMic = watchMic(mic, (code) => {
    setStatus(MIC_ERRORS[code] || MIC_ERRORS.SILENT);
    try { vapi.stop(); } catch (_) {}
  });

  // STEP 2: only now connect.
  try {
    setStatus("Connecting...");
    await vapi.start(selectedAgent.assistantId);
  } catch (e) {
    console.error("start failed", e);
    setStatus("Couldn't connect, tap to retry");
    stopMic();                                // release the preflighted stream
    btn.disabled = false;
    setPickerEnabled(true);
  }
});

vapi.on("call-start", () => {
  inCall = true;
  btn.disabled = false;
  btn.classList.add("is-live");
  label.textContent = "End call";
  setStatus(selectedAgent.name + " is listening, speak in English or Urdu", true);
  siri.setTarget(LIVE_BASE);
  startMic();
});

vapi.on("call-end", () => {
  inCall = false; assistantSpeaking = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to " + selectedAgent.name;
  setStatus("Call ended, tap to talk again");
  stopMic();
  setPickerEnabled(true);
  siri.setTarget(0);
});

vapi.on("speech-start", () => { assistantSpeaking = true; if (!micRunning) siri.setTarget(SPEAK); });
vapi.on("speech-end",   () => { assistantSpeaking = false; if (!micRunning) siri.setTarget(inCall ? LIVE_BASE : 0); });
vapi.on("volume-level", (v) => { if (!micRunning && inCall) siri.setTarget(Math.max(LIVE_BASE, LIVE_BASE + v * 1.4)); });

vapi.on("error", (e) => {
  console.error("vapi error", e);
  inCall = false; assistantSpeaking = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to " + selectedAgent.name;
  setStatus("Something went wrong, tap to retry");
  stopMic();
  setPickerEnabled(true);
  siri.setTarget(0);
});

/* ---- Border Beam (SVG stroke-dash COMET): the beam is a stack of NESTED, CENTRED dashes on
   the pill's rounded-rect stroke -- one long faint dash draws a single continuous line, and
   progressively shorter dashes stack on its centre to build brightness -- so the line is
   UNBROKEN (no dots/beads) and the opacity tapers smoothly to soft ends. Riding the stroke
   keeps it ONE beam that follows the rounded corners and loops seamlessly. pathLength=100
   makes lengths size-independent; only the rect geometry is re-sized on resize / font load.
   Tune with CBEAM: lmax/lmin (length + fade), n (smoothness), op (brightness), dur (speed). ---- */
const CBEAM = { n: 16, lmax: 30, lmin: 3, dur: 7, op: 0.13 };
const SVGNS = "http://www.w3.org/2000/svg";
const cbeam = document.querySelector(".voicepill--beam .cbeam");
const cbeamTail = cbeam && cbeam.querySelector(".cbeam__tail");
let cbeamSegs = [];
function buildCbeam() {
  if (!cbeamTail) return;
  cbeamTail.textContent = "";
  cbeamSegs = [];
  for (let i = 0; i < CBEAM.n; i++) {
    const t = CBEAM.n === 1 ? 0 : i / (CBEAM.n - 1);
    const len = CBEAM.lmax - t * (CBEAM.lmax - CBEAM.lmin);       // longest (faint line) -> shortest (bright core)
    const delay = -((CBEAM.lmax - len) / 2 / 100) * CBEAM.dur;    // keep every dash centred on the same moving point
    const s = document.createElementNS(SVGNS, "rect");
    s.setAttribute("class", "cbeam__seg");
    s.setAttribute("pathLength", "100");
    s.setAttribute("fill", "none");
    s.style.strokeDasharray = len.toFixed(2) + " " + (100 - len).toFixed(2);
    s.style.animationDelay = delay.toFixed(3) + "s";
    s.style.opacity = CBEAM.op;
    cbeamTail.appendChild(s);
    cbeamSegs.push(s);
  }
}
function sizeCbeam() {
  if (!cbeam || !cbeamSegs.length) return;
  const box = cbeam.getBoundingClientRect();
  const w = box.width, h = box.height, sw = 1.2;              // sw = stroke-width (keep in sync with CSS)
  if (!w || !h) return;
  const r = (h - sw) / 2;
  for (const s of cbeamSegs) {
    s.setAttribute("x", sw / 2); s.setAttribute("y", sw / 2);
    s.setAttribute("width", Math.max(0, w - sw)); s.setAttribute("height", Math.max(0, h - sw));
    s.setAttribute("rx", r); s.setAttribute("ry", r);
  }
}
if (cbeam && cbeamTail) {
  buildCbeam(); sizeCbeam();
  window.addEventListener("resize", sizeCbeam, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(sizeCbeam).observe(cbeam.parentElement || cbeam);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeCbeam);
}

/* ---- Navbar: blur on scroll + hide on scroll-down / reveal on scroll-up (same as the site) ---- */
const nav = document.getElementById("nav");
let lastY = window.scrollY;
function updateNav(y) {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", y > 40);
  const dir = y - lastY;
  if (y > 130 && dir > 1) nav.classList.add("is-hidden");
  else if (dir < -1 || y <= 130) nav.classList.remove("is-hidden");
  lastY = y;
}
if (nav) {
  updateNav(window.scrollY);
  window.addEventListener("scroll", () => updateNav(window.scrollY), { passive: true });
}

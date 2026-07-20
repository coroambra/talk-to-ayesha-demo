// Talk to Sarah (English demo), Vapi web call + siri-wave visualizer (reacts to both
// voices) + a 3-agent picker. Same backend code as Ayesha's demo.js; only the assistant
// selection and the on-screen English copy differ. The Urdu Ayesha page (index.html +
// demo.js) is untouched.
//
// Sarah / Victoria / Lia are THREE separate Vapi assistants, each with its own name,
// persona and ElevenLabs voice baked in (no runtime overrides => full latency + prompt
// quality). The picker just chooses which assistant to start, so each introduces herself
// by her own name. Sarah is the recommended default.
import Vapi from "https://esm.sh/@vapi-ai/web@2";
import { createSiriWave } from "./siri-wave.js";

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

// default = the recommended agent (the pill marked is-active in the markup: Sarah)
const first = pills.find((p) => p.classList.contains("is-active")) || pills[0];
let selectedAgent = { assistantId: first.dataset.assistant, name: first.dataset.name };

let inCall = false;
let assistantSpeaking = false;

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

/* ---- Agent picker: choose Sarah / Victoria / Lia before tapping Talk ---- */
function setPickerEnabled(on) { pills.forEach((p) => { p.disabled = !on; }); }
pills.forEach((p) => {
  p.addEventListener("click", () => {
    if (inCall) return;                       // locked during a live call
    pills.forEach((x) => x.classList.remove("is-active"));
    p.classList.add("is-active");
    selectedAgent = { assistantId: p.dataset.assistant, name: p.dataset.name };
    label.textContent = "Talk to " + selectedAgent.name;
    setStatus("Voice set to " + selectedAgent.name + ", tap to talk");
  });
});

/* ---- Prospect mic reactivity: analyse the caller's own voice ---- */
let micStream = null, audioCtx = null, analyser = null, micData = null, micRAF = 0, micRunning = false;

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    micData = new Uint8Array(analyser.fftSize);
    micRunning = true;
    loopMic();
  } catch (e) {
    console.warn("mic analyser unavailable, falling back to assistant-only", e);
    micRunning = false;
  }
}
function loopMic() {
  if (!analyser) return;
  analyser.getByteTimeDomainData(micData);
  let sum = 0;
  for (let i = 0; i < micData.length; i++) { const v = (micData[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / micData.length);
  const userLevel = Math.min(1, rms * 4.2);
  // wave rides whichever is louder: the caller's voice or the agent speaking
  siri.setTarget(Math.max(LIVE_BASE, assistantSpeaking ? SPEAK : 0, userLevel));
  micRAF = requestAnimationFrame(loopMic);
}
function stopMic() {
  micRunning = false;
  if (micRAF) cancelAnimationFrame(micRAF), (micRAF = 0);
  analyser = null;
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

/* ---- Call control ---- */
btn.addEventListener("click", async () => {
  if (inCall) { vapi.stop(); return; }
  try {
    btn.disabled = true;
    setPickerEnabled(false);
    // Warm up the mic permission BEFORE starting the call: when the permission
    // prompt appeared mid-connect, Vapi received no audio and killed the call
    // (18 of 35 field calls died on the first tap this way). Grant, then connect.
    setStatus("Allow the microphone to talk...");
    const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
    warm.getTracks().forEach((t) => t.stop());
    setStatus("Connecting...");
    await vapi.start(selectedAgent.assistantId);
  } catch (e) {
    console.error("start failed", e);
    setStatus("Mic blocked or error, allow mic and retry");
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

/* ---- Border Beam (SVG stroke-dash): size the rounded-rect stroke to the pill so it hugs the
   border exactly. pathLength=100 keeps the dash a fixed % regardless of size, so only the
   rect geometry needs updating (on resize / font load); the dash itself travels via CSS. A
   single stroke dash can never split into two, and the stroke follows the rounded corners
   itself, so this is seamless where the offset-path square comet bled onto multiple edges. ---- */
const cbeam = document.querySelector(".voicepill--beam .cbeam");
const cbeamTrack = cbeam && cbeam.querySelector(".cbeam__track");
function updateCbeam() {
  if (!cbeam || !cbeamTrack) return;
  const box = cbeam.getBoundingClientRect();
  const w = box.width, h = box.height, sw = 1.5;   // sw = stroke-width (keep in sync with CSS)
  if (!w || !h) return;
  const r = (h - sw) / 2;
  cbeamTrack.setAttribute("x", sw / 2);
  cbeamTrack.setAttribute("y", sw / 2);
  cbeamTrack.setAttribute("width", Math.max(0, w - sw));
  cbeamTrack.setAttribute("height", Math.max(0, h - sw));
  cbeamTrack.setAttribute("rx", r);
  cbeamTrack.setAttribute("ry", r);
}
if (cbeam && cbeamTrack) {
  updateCbeam();
  window.addEventListener("resize", updateCbeam, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(updateCbeam).observe(cbeam.parentElement || cbeam);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateCbeam);
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

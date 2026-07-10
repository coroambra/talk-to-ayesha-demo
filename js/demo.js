// Talk to Ayesha, Vapi web call + siri-wave visualizer (reacts to both voices) + site nav.
import Vapi from "https://esm.sh/@vapi-ai/web@2";
import { createSiriWave } from "./siri-wave.js";

const PUBLIC_KEY   = "3abf07c7-8a64-4701-a303-79ad43434d37";     // Vapi PUBLIC key
const ASSISTANT_ID = "63210d1b-1133-4753-9ed3-1d35ef802ddf";     // Skyline Estate Lahore (Urdu Demo)

const LIVE_BASE = 0.28;   // gentle wave while connected
const SPEAK     = 1.0;    // full wave while Ayesha speaks

const siri   = createSiriWave(document.getElementById("siri"), { idle: 0.05 });
const vapi   = new Vapi(PUBLIC_KEY);
const btn    = document.getElementById("talkBtn");
const label  = document.getElementById("talkLabel");
const status = document.getElementById("callStatus");

let inCall = false;
let assistantSpeaking = false;

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

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
  // wave rides whichever is louder: the caller's voice or Ayesha speaking
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
    // Warm up the mic permission BEFORE starting the call: when the permission
    // prompt appeared mid-connect, Vapi received no audio and killed the call
    // (18 of 35 field calls died on the first tap this way). Grant, then connect.
    setStatus("Allow the microphone to talk...");
    const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
    warm.getTracks().forEach((t) => t.stop());
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
  startMic();
});

vapi.on("call-end", () => {
  inCall = false; assistantSpeaking = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to Ayesha";
  setStatus("Call ended, tap to talk again");
  stopMic();
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
  label.textContent = "Talk to Ayesha";
  setStatus("Something went wrong, tap to retry");
  stopMic();
  siri.setTarget(0);
});

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

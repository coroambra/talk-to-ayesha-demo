// Talk to Ayesha, Vapi web call + siri-wave visualizer (reacts to both voices) + site nav.
import Vapi from "https://esm.sh/@vapi-ai/web@2";
import { createSiriWave } from "./siri-wave.js";
import { micPreflight, releaseMic, watchMic, MIC_ERRORS } from "./mic-preflight.js";

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
  const micData = mic.micData;
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
  if (unwatchMic) { unwatchMic(); unwatchMic = null; }
  releaseMic(mic);
  mic = null;
}

/* ---- Call control ---- */
btn.addEventListener("click", async () => {
  if (inCall) { vapi.stop(); return; }
  btn.disabled = true;

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
    await vapi.start(ASSISTANT_ID);
  } catch (e) {
    console.error("start failed", e);
    setStatus("Couldn't connect, tap to retry");
    stopMic();                                // release the preflighted stream
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

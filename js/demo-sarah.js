// Talk to Sarah (English demo), Vapi web call + siri-wave visualizer (reacts to both
// voices) + 5-voice A/B picker. Same backend code as Ayesha's demo.js; only the assistant,
// the voice-override picker, and the on-screen English copy differ. The Urdu Ayesha page
// (index.html + demo.js) is untouched.
import Vapi from "https://esm.sh/@vapi-ai/web@2";
import { createSiriWave } from "./siri-wave.js";

const PUBLIC_KEY   = "3abf07c7-8a64-4701-a303-79ad43434d37";     // Vapi PUBLIC key (org-wide)
const ASSISTANT_ID = "74fa6c95-50d4-49cf-9214-cfafca604843";     // Skyline Estate Lahore (English Demo) — Sarah

// The 5 ElevenLabs voices to A/B. The default (Sarah) matches the assistant's baked-in
// voice; picking another applies it as a Vapi assistantOverride on the next call start.
const VOICE_MODEL  = "eleven_flash_v2_5";
let   selectedVoice = { voiceId: "nf4MCGNSdM0hxM95ZBQR", name: "Sarah" };

const LIVE_BASE = 0.28;   // gentle wave while connected
const SPEAK     = 1.0;    // full wave while Sarah speaks

const siri   = createSiriWave(document.getElementById("siri"), { idle: 0.05 });
const vapi   = new Vapi(PUBLIC_KEY);
const btn    = document.getElementById("talkBtn");
const label  = document.getElementById("talkLabel");
const status = document.getElementById("callStatus");
const pick   = document.getElementById("voicePick");
const pills  = pick ? Array.from(pick.querySelectorAll(".voicepill")) : [];

let inCall = false;
let assistantSpeaking = false;

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

/* ---- Voice A/B picker: choose the ElevenLabs voice before tapping Talk ---- */
function setPickerEnabled(on) {
  pills.forEach((p) => { p.disabled = !on; });
}
pills.forEach((p) => {
  p.addEventListener("click", () => {
    if (inCall) return;                       // locked during a live call
    pills.forEach((x) => x.classList.remove("is-active"));
    p.classList.add("is-active");
    selectedVoice = { voiceId: p.dataset.voice, name: p.dataset.name };
    label.textContent = "Talk to " + selectedVoice.name;
    setStatus("Voice set to " + selectedVoice.name + ", tap to talk");
  });
});

// The assistantOverride applied on start: swap only the voice identity, keep the tuned
// flash_v2_5 settings identical across all five so the A/B is voice-to-voice, nothing else.
function voiceOverride() {
  return {
    voice: {
      provider: "11labs",
      voiceId: selectedVoice.voiceId,
      model: VOICE_MODEL,
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
      fallbackPlan: { voices: [{ provider: "azure", voiceId: "en-US-JennyNeural" }] },
    },
  };
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
  // wave rides whichever is louder: the caller's voice or Sarah speaking
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
    await vapi.start(ASSISTANT_ID, voiceOverride());
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
  setStatus("Sarah is listening, speak in English or Urdu", true);
  siri.setTarget(LIVE_BASE);
  startMic();
});

vapi.on("call-end", () => {
  inCall = false; assistantSpeaking = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  label.textContent = "Talk to " + selectedVoice.name;
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
  label.textContent = "Talk to " + selectedVoice.name;
  setStatus("Something went wrong, tap to retry");
  stopMic();
  setPickerEnabled(true);
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

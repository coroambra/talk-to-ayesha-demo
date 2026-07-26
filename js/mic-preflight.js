// mic-preflight.js  (2026-07-26)
// Shared microphone preflight for BOTH demo pages (Ayesha/Urdu via demo.js, and
// Sarah/Alina/Zara/English via demo-sarah.js).
//
// WHY THIS EXISTS
// The old warm-up called getUserMedia and then IMMEDIATELY stop()ed every track:
//
//     const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
//     warm.getTracks().forEach((t) => t.stop());     // <-- device torn down here
//     await vapi.start(assistantId);                 // <-- Vapi re-opens it microseconds later
//
// That fixed the PERMISSION race (the prompt no longer appears mid-connect) but it
// introduced a DEVICE race. On several Android and Windows setups the capture device is
// still tearing down when Vapi re-opens it, and the browser hands back a track that is
// "live" but delivers no audio frames. The call connects, the caller talks, nothing
// arrives, and Vapi kills it with:
//     call.in-progress.error-assistant-did-not-receive-customer-audio
// Five calls died exactly that way between 22 and 26 July 2026 (0 seconds, zero user
// turns), each one followed 20 to 30 seconds later by a successful retry from the same
// person tapping again. Four more calls carried a fully silent stream with only the idle
// messages firing. Granting permission is NOT the same as the device actually sending audio.
//
// WHAT THIS DOES INSTEAD
//   1. Acquires the mic ONCE, with echo cancellation / noise suppression / AGC on.
//   2. Confirms the track is genuinely live and not muted at the OS level.
//   3. Confirms real audio SAMPLES are arriving, by watching the waveform for any
//      deviation from perfect digital silence (a real mic in a quiet room still dithers;
//      only a dead, muted or hijacked device stays perfectly flat).
//   4. KEEPS the stream open and hands it back, so nothing is torn down before the call
//      and the visualiser reuses this same stream instead of opening a second one.
// The call only starts once all four have passed.

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
};

// How long we watch for real samples before declaring the mic dead.
const FLOW_TIMEOUT_MS = 1500;
const FLOW_POLL_MS = 50;

// Distinct, actionable failure reasons. The pages map these to on-screen copy.
export const MIC_ERRORS = {
  NO_API: "This browser can't reach the microphone. Try Chrome, and make sure the page is on https.",
  DENIED: "Microphone blocked. Allow mic access for this site, then tap again.",
  NO_DEVICE: "No microphone found. Plug one in or check your device settings, then tap again.",
  IN_USE: "Your microphone is busy in another app or tab. Close it, then tap again.",
  MUTED: "Your microphone is muted. Unmute it, then tap again.",
  SILENT: "Your mic isn't sending any sound. Check it isn't muted or switched off, then tap again."
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// True as soon as ANY frame deviates from perfect silence. Deliberately the most
// permissive test that still catches a genuinely dead device: one LSB is enough, so a
// real mic in a silent room always passes and only a flat-line device fails.
async function samplesAreFlowing(analyser, buf, track) {
  const deadline = Date.now() + FLOW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (track.readyState !== "live") return false;
    if (!track.muted) {
      analyser.getByteTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== 128) return true;
      }
    }
    await sleep(FLOW_POLL_MS);
  }
  return false;
}

function classifyGetUserMediaError(e) {
  const n = (e && e.name) || "";
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return "DENIED";
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return "NO_DEVICE";
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return "IN_USE";
  return "DENIED";
}

/**
 * Acquire and fully validate the microphone.
 * Resolves with { stream, audioCtx, analyser, micData } on success. The caller OWNS these
 * and must call releaseMic() when the call ends. Never stop the tracks before vapi.start().
 * Rejects with an Error whose .code is a key of MIC_ERRORS.
 */
export async function micPreflight() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw Object.assign(new Error("no getUserMedia"), { code: "NO_API" });
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  } catch (e) {
    throw Object.assign(new Error(String(e)), { code: classifyGetUserMediaError(e) });
  }

  const track = stream.getAudioTracks()[0];
  if (!track || track.readyState !== "live") {
    stream.getTracks().forEach((t) => t.stop());
    throw Object.assign(new Error("no live track"), { code: "NO_DEVICE" });
  }
  if (track.muted) {
    stream.getTracks().forEach((t) => t.stop());
    throw Object.assign(new Error("track muted"), { code: "MUTED" });
  }

  // Build the analyser now: it doubles as the proof that samples are really arriving,
  // and the visualiser reuses it, so we never open a second capture of the same device.
  const AC = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AC();
  // Autoplay policy: this runs inside the button's click handler, so resume() is allowed.
  if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch (_) {} }

  const src = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  const micData = new Uint8Array(analyser.fftSize);

  const flowing = await samplesAreFlowing(analyser, micData, track);
  if (!flowing) {
    stream.getTracks().forEach((t) => t.stop());
    try { audioCtx.close(); } catch (_) {}
    throw Object.assign(new Error("no samples"), { code: track.muted ? "MUTED" : "SILENT" });
  }

  return { stream, audioCtx, analyser, micData };
}

/** Tear down everything micPreflight() handed back. Safe to call more than once. */
export function releaseMic(m) {
  if (!m) return;
  if (m.stream) { m.stream.getTracks().forEach((t) => t.stop()); }
  if (m.audioCtx) { try { m.audioCtx.close(); } catch (_) {} }
}

/**
 * Watch a validated mic for the device dying or being muted DURING a live call
 * (unplugged headset, OS mute, another app grabbing it). Calls onLost(code) once.
 * Returns an unsubscribe function.
 */
export function watchMic(m, onLost) {
  if (!m || !m.stream) return () => {};
  const track = m.stream.getAudioTracks()[0];
  if (!track) return () => {};
  let fired = false;
  const fire = (code) => { if (!fired) { fired = true; onLost(code); } };
  const onEnded = () => fire("NO_DEVICE");
  const onMute = () => fire("MUTED");
  track.addEventListener("ended", onEnded);
  track.addEventListener("mute", onMute);
  return () => {
    track.removeEventListener("ended", onEnded);
    track.removeEventListener("mute", onMute);
  };
}

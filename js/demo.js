// Talk to Ayesha, Vapi web call (public key, safe to expose) + mobile drawer.
import Vapi from "https://esm.sh/@vapi-ai/web@2";

const PUBLIC_KEY  = "3abf07c7-8a64-4701-a303-79ad43434d37";      // Vapi PUBLIC key
const ASSISTANT_ID = "63210d1b-1133-4753-9ed3-1d35ef802ddf";     // Skyline Estate Lahore (Urdu Demo)

const vapi   = new Vapi(PUBLIC_KEY);
const btn    = document.getElementById("talkBtn");
const label  = document.getElementById("talkLabel");
const status = document.getElementById("callStatus");
const orb    = document.getElementById("orb");

let active = false;

function setStatus(text, live) {
  status.textContent = text;
  status.classList.toggle("is-live", !!live);
}

btn.addEventListener("click", async () => {
  if (active) { vapi.stop(); return; }
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
  active = true;
  btn.disabled = false;
  btn.classList.add("is-live");
  orb.classList.add("is-live");
  label.textContent = "End call";
  setStatus("Ayesha is listening, speak in Urdu", true);
});

vapi.on("call-end", () => {
  active = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  orb.classList.remove("is-live", "is-speaking");
  label.textContent = "Talk to Ayesha";
  setStatus("Call ended, tap to talk again");
});

vapi.on("speech-start", () => orb.classList.add("is-speaking"));
vapi.on("speech-end",   () => orb.classList.remove("is-speaking"));

vapi.on("error", (e) => {
  console.error("vapi error", e);
  active = false;
  btn.disabled = false;
  btn.classList.remove("is-live");
  orb.classList.remove("is-live", "is-speaking");
  label.textContent = "Talk to Ayesha";
  setStatus("Something went wrong, tap to retry");
});

// ---- Mobile drawer (self-contained, no site JS needed) ----
const burger = document.getElementById("burger");
const drawer = document.getElementById("drawer");
function closeDrawer() {
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
  burger?.setAttribute("aria-expanded", "false");
}
burger?.addEventListener("click", () => {
  const open = drawer.classList.toggle("is-open");
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  burger.setAttribute("aria-expanded", open ? "true" : "false");
});
document.querySelectorAll("[data-drawer-close]").forEach((el) =>
  el.addEventListener("click", closeDrawer)
);

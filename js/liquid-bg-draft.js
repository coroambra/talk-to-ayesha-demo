// liquid-bg-draft.js — DRAFT B background for the Ayesha demo.
// The 21st.dev "Liquid Effect Animation" (minhxthanh): threejs-components
// liquid1 engine from jsDelivr (allowed by CSP), with the demo stock image
// swapped for OUR wallpapers and the component's exact material knobs.
// Local module file instead of the component's injected inline script (CSP).
// The wallpaper cycle button swaps both the liquid image and the glass overlay
// texture (window.__setGlassWallpaper from liquid-glass-overlay.js).
import LiquidBackground from "https://cdn.jsdelivr.net/npm/threejs-components@0.0.22/build/backgrounds/liquid1.min.js";

const WALLPAPERS = { 1: "assets/wallpapers/1.jpg", 2: "assets/wallpapers/2.jpg", 3: "assets/wallpapers/3.jpg" };
const STORE_KEY = "ayesha_wallpaper";

let current = (() => {
  try {
    const q = parseInt(new URLSearchParams(location.search).get("wp"), 10);
    if (WALLPAPERS[q]) return q;
    const v = parseInt(localStorage.getItem(STORE_KEY), 10);
    return WALLPAPERS[v] ? v : 1;
  } catch (e) {
    return 1;
  }
})();

const canvas = document.getElementById("liquidCanvas");
if (canvas) {
  const app = LiquidBackground(canvas);
  app.loadImage(WALLPAPERS[current]);
  // exact component knobs
  app.liquidPlane.material.metalness = 0.75;
  app.liquidPlane.material.roughness = 0.25;
  app.liquidPlane.uniforms.displacementScale.value = 5;
  app.setRain(false);
  window.__liquidApp = app;

  const wallBtn = document.getElementById("wallBtn");
  if (wallBtn) {
    wallBtn.addEventListener("click", () => {
      current = (current % 3) + 1;
      try { localStorage.setItem(STORE_KEY, String(current)); } catch (e) {}
      app.loadImage(WALLPAPERS[current]);
      if (window.__setGlassWallpaper) window.__setGlassWallpaper(current);
    });
  }
}

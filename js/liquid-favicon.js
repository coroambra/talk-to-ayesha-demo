// liquid-favicon.js — ANIMATED Platinum Frost favicon (desktop tabs).
// Runs a hidden 64px liquid-metal CA mark (the same @paper-design shader as the
// footer logo, mounted with data-preserve so its buffer is readable) and streams
// frames into the <link rel="icon"> every 200ms. Chrome/Edge/Firefox animate
// desktop tab favicons this way; mobile browsers ignore dynamic favicons and
// keep the static Platinum Frost PNG (assets/ca-platinum.png), so we skip the
// hidden shader there entirely (battery). Static PNG also covers no-JS + reduced
// motion + link previews (og:image).

(function () {
  "use strict";

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return; // mobile: static icon
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var link = document.querySelector('link[rel="icon"]');
  if (!link) return;

  function boot() {
    if (!window.LiquidLogo) return;
    var host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    // must sit INSIDE the viewport: the logo engine pauses off-screen mounts
    host.style.cssText =
      "position:fixed;right:0;bottom:0;width:64px;height:64px;opacity:0.001;pointer-events:none;z-index:-1";
    host.dataset.liquidLogo = "";
    host.dataset.logoKey = "caMark";
    host.dataset.logo = "assets/ca-mark.png";
    host.dataset.preset = "platinum";
    host.dataset.scale = "1";
    host.dataset.preserve = "1";
    document.body.appendChild(host);

    var inst = window.LiquidLogo.create(host);
    var canvas = null;
    setInterval(function () {
      if (!canvas) {
        if (!(inst && inst.mount)) return;
        canvas = host.querySelector("canvas");
        if (!canvas || !canvas.width) { canvas = null; return; }
      }
      try { link.href = canvas.toDataURL("image/png"); } catch (e) { /* keep static icon */ }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

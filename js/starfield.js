/* starfield.js — CSP-safe vanilla port of 21st.dev @designali-in/starfield-1.
   Fills the #starfield layer (a fixed inset:0 element) with a slow-drifting 3D
   starfield. Faithful to the React component's math at its default props, with
   two intentional choices: mouse/tilt/warp are all OFF (component defaults), and
   `speed` is lowered from 1 to 0.5 for a slower, calmer drift (Malik's request +
   the standing "animations slow and smooth" rule). No external deps, no imports,
   no inline script, no pointer handlers => never blocks the UI above it. */
(function () {
  "use strict";

  // ---- config (component defaults; speed lowered) ----
  var starColor = "rgba(255,255,255,1)";
  var bgColor   = "rgba(0,0,0,1)";
  var speed     = 0.5;   // component default is 1; slower per Malik. Tune here.
  var quantity  = 512;
  var easing    = 1;

  // DESKTOP ONLY: the mobile layout is tight, so the field is skipped on phones
  // (<=900px). Decided once at load, matching how nebula-glass.js picks its mode.
  if (window.matchMedia("(max-width: 900px)").matches) return;

  var host = document.getElementById("starfield");
  if (!host) return;

  var canvas = document.createElement("canvas");
  host.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  // star = [x3d, y3d, z, screenX, screenY, prevScreenX, prevScreenY, visible]
  var sd = { w: 0, h: 0, x: 0, y: 0, z: 0, cw: 0, ch: 0, colorRatio: 0, arr: [] };
  var cursor = { x: 0, y: 0 };
  var mouse  = { x: 0, y: 0 };
  var ratio  = quantity / 2;

  function measure() {
    sd.w = host.clientWidth;
    sd.h = host.clientHeight;
    sd.x = Math.round(sd.w / 2);
    sd.y = Math.round(sd.h / 2);
    sd.z = (sd.w + sd.h) / 2;
    sd.colorRatio = 1 / sd.z;
    if (cursor.x === 0 || cursor.y === 0) { cursor.x = sd.x; cursor.y = sd.y; }
    if (mouse.x === 0 || mouse.y === 0)   { mouse.x = cursor.x - sd.x; mouse.y = cursor.y - sd.y; }
  }

  function setup() {
    measure();
    canvas.width = sd.w;
    canvas.height = sd.h;
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = starColor;
  }

  function bigBang() {
    if (sd.arr.length !== quantity) {
      sd.arr = new Array(quantity);
      for (var i = 0; i < quantity; i++) {
        sd.arr[i] = [
          Math.random() * sd.w * 2 - sd.x * 2,
          Math.random() * sd.h * 2 - sd.y * 2,
          Math.round(Math.random() * sd.z),
          0, 0, 0, 0, true
        ];
      }
    }
  }

  // runs every frame; only rescales when the viewport actually changed size
  function resize() {
    measure();
    sd.cw = canvas.width;
    sd.ch = canvas.height;
    if (sd.cw !== sd.w || sd.ch !== sd.h) {
      var rw = sd.w / sd.cw;
      var rh = sd.h / sd.ch;
      canvas.width = sd.w;
      canvas.height = sd.h;
      if (!sd.arr.length) {
        bigBang();
      } else {
        for (var i = 0; i < sd.arr.length; i++) {
          var s = sd.arr[i];
          s[0] = s[0] * rw;
          s[1] = s[1] * rh;
          s[3] = sd.x + (s[0] / s[2]) * ratio;
          s[4] = sd.y + (s[1] / s[2]) * ratio;
        }
      }
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = starColor;
    }
  }

  function update() {
    mouse.x = (cursor.x - sd.x) / easing;
    mouse.y = (cursor.y - sd.y) / easing;
    var arr = sd.arr, s, i;
    for (i = 0; i < arr.length; i++) {
      s = arr[i];
      s[7] = true;
      s[5] = s[3];
      s[6] = s[4];
      s[0] += mouse.x >> 4;
      if (s[0] >  sd.x << 1) { s[0] -= sd.w << 1; s[7] = false; }
      if (s[0] < -sd.x << 1) { s[0] += sd.w << 1; s[7] = false; }
      s[1] += mouse.y >> 4;
      if (s[1] >  sd.y << 1) { s[1] -= sd.h << 1; s[7] = false; }
      if (s[1] < -sd.y << 1) { s[1] += sd.h << 1; s[7] = false; }
      s[2] -= speed;
      if (s[2] > sd.z) { s[2] -= sd.z; s[7] = false; }
      if (s[2] < 0)    { s[2] += sd.z; s[7] = false; }
      s[3] = sd.x + (s[0] / s[2]) * ratio;
      s[4] = sd.y + (s[1] / s[2]) * ratio;
    }
  }

  function draw() {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, sd.w, sd.h);
    ctx.strokeStyle = starColor;
    var arr = sd.arr, s, i;
    for (i = 0; i < arr.length; i++) {
      s = arr[i];
      if (s[5] > 0 && s[5] < sd.w && s[6] > 0 && s[6] < sd.h && s[7]) {
        ctx.lineWidth = (1 - sd.colorRatio * s[2]) * 2;
        ctx.beginPath();
        ctx.moveTo(s[5], s[6]);
        ctx.lineTo(s[3], s[4]);
        ctx.stroke();
        ctx.closePath();
      }
    }
  }

  function animate() {
    resize();
    update();
    draw();
    requestAnimationFrame(animate);
  }

  setup();
  bigBang();
  animate();
})();

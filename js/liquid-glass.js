// liquid-glass.js — CoroAmbra liquid-glass wallpaper engine.
// Faithful port of the bubbbly.com "GitHub Glass Card" WebGL shader
// (https://www.bubbbly.com/app/github-glass-badge.html): a fullscreen canvas
// draws the wallpaper (cover-fit) plus a refractive liquid-glass pane under
// the .callcard — superellipse SDF, edge lens distortion, 9×9 soft blur and
// rim lighting. Two CoroAmbra additions: per-wallpaper dimming (uDim) so the
// white text stays readable, and a 3-wallpaper switcher (nav button, persisted
// in localStorage). Classic script, CSP-safe (script-src 'self').
//
// Success => <html class="glass-on">  (CSS strips the card's own background)
// No WebGL => <html class="glass-fallback"> (CSS frosted glass + img wallpaper)

(function () {
  "use strict";

  var WALLPAPERS = {
    1: { src: "assets/wallpapers/1.jpg", dim: 0.8 },
    2: { src: "assets/wallpapers/2.jpg", dim: 0.9 },
    3: { src: "assets/wallpapers/3.jpg", dim: 0.5 },
  };
  var STORE_KEY = "ayesha_wallpaper";

  var canvas = document.getElementById("glassCanvas");
  var card = document.querySelector(".callcard");
  var wallBtn = document.getElementById("wallBtn");
  var fallbackImg = document.querySelector(".demo__bg img");

  var current = (function () {
    // ?wp=1|2|3 deep-links a wallpaper (and is handy for QA); else last choice; else 1
    try {
      var q = parseInt(new URLSearchParams(location.search).get("wp"), 10);
      if (WALLPAPERS[q]) return q;
      var v = parseInt(localStorage.getItem(STORE_KEY), 10);
      return WALLPAPERS[v] ? v : 1;
    } catch (e) {
      return 1;
    }
  })();

  function saveChoice() {
    try { localStorage.setItem(STORE_KEY, String(current)); } catch (e) {}
  }

  /* ---------- fallback path (no WebGL): swap the section img instead ---------- */
  function enterFallback() {
    document.documentElement.classList.add("glass-fallback");
    if (fallbackImg) fallbackImg.src = WALLPAPERS[current].src;
    if (wallBtn) {
      wallBtn.addEventListener("click", function () {
        current = (current % 3) + 1;
        saveChoice();
        if (fallbackImg) fallbackImg.src = WALLPAPERS[current].src;
      });
    }
  }

  var gl = canvas && canvas.getContext("webgl", { antialias: false });
  if (!gl || !card) { enterFallback(); return; }

  /* =================== shaders (bubbbly port + uDim/uPx) =================== */
  var VS = "attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }";

  var FS = [
    "precision mediump float;",
    "",
    "uniform vec3 iResolution;",
    "uniform vec2 uImgRes;",
    "uniform vec2 uCardPos;   // card centre in gl pixels (y up)",
    "uniform vec2 uCardHalf;  // half width / half height in pixels",
    "uniform float uWhite;    // 0..1 whiteness",
    "uniform float uDim;      // wallpaper dim factor (CoroAmbra: text legibility)",
    "uniform float uPx;       // device px per CSS px (keeps blur radius DPR-true)",
    "uniform sampler2D iChannel0;",
    "",
    "vec2 coverUv(vec2 uv) {",
    "  float ca = iResolution.x / iResolution.y;",
    "  float ia = uImgRes.x / uImgRes.y;",
    "  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);",
    "  return (uv - 0.5) * s + 0.5;",
    "}",
    "",
    "void main() {",
    "  const float POWER_EXPONENT = 6.0;",
    "  vec2 fragCoord = gl_FragCoord.xy;",
    "  vec2 uv = fragCoord / iResolution.xy;",
    "",
    "  vec2 d = (fragCoord - uCardPos) / uCardHalf;",
    "  float roundedBox = pow(abs(d.x), POWER_EXPONENT) + pow(abs(d.y), POWER_EXPONENT);",
    "",
    "  float rb1 = clamp((1.0 - roundedBox) * 8.0, 0.0, 1.0);",
    "  float rb2 = clamp((0.955 - roundedBox * 0.95) * 16.0, 0.0, 1.0) -",
    "              clamp((0.91  - roundedBox * 0.95) * 16.0, 0.0, 1.0);",
    "  float rb3 = clamp((1.5 - roundedBox * 1.1) * 2.0, 0.0, 1.0) -",
    "              clamp((1.0 - roundedBox * 1.1) * 2.0, 0.0, 1.0);",
    "",
    "  vec4 bg = texture2D(iChannel0, coverUv(uv));",
    "  bg.rgb *= uDim;",
    "  float transition = smoothstep(0.0, 1.0, rb1 + rb2);",
    "  vec4 color = bg;",
    "",
    "  if (transition > 0.0) {",
    "    vec2 cuv = uCardPos / iResolution.xy;",
    "    vec2 lens = cuv + (uv - cuv) * (1.0 - roundedBox * 0.22);",
    "",
    "    vec4 acc = vec4(0.0);",
    "    float total = 0.0;",
    "    for (float x = -4.0; x <= 4.0; x++) {",
    "      for (float y = -4.0; y <= 4.0; y++) {",
    "        vec2 off = vec2(x, y) * 1.2 * uPx / iResolution.xy;",
    "        acc += texture2D(iChannel0, coverUv(lens + off));",
    "        total += 1.0;",
    "      }",
    "    }",
    "    acc /= total;",
    "    acc.rgb *= uDim;",
    "",
    "    float dy = uv.y - cuv.y;",
    "    float gradient = clamp((clamp(dy, 0.0, 0.2) + 0.1) / 2.0, 0.0, 1.0) +",
    "                     clamp((clamp(-dy, -1000.0, 0.2) * rb3 + 0.1) / 2.0, 0.0, 1.0);",
    "    vec4 lighting = clamp(acc + vec4(rb1) * gradient + vec4(rb2) * 0.3, 0.0, 1.0);",
    "",
    "    lighting = mix(lighting, vec4(1.0), uWhite * 0.97);",
    "    color = mix(bg, lighting, transition);",
    "  }",
    "  gl_FragColor = vec4(color.rgb, 1.0);",
    "}",
  ].join("\n");

  function createShader(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("liquid-glass shader error:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = createShader(gl.VERTEX_SHADER, VS);
  var fs = createShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { enterFallback(); return; }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { enterFallback(); return; }
  gl.useProgram(program);

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var positionLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  var U = {
    resolution: gl.getUniformLocation(program, "iResolution"),
    imgRes: gl.getUniformLocation(program, "uImgRes"),
    cardPos: gl.getUniformLocation(program, "uCardPos"),
    cardHalf: gl.getUniformLocation(program, "uCardHalf"),
    white: gl.getUniformLocation(program, "uWhite"),
    dim: gl.getUniformLocation(program, "uDim"),
    px: gl.getUniformLocation(program, "uPx"),
    texture: gl.getUniformLocation(program, "iChannel0"),
  };

  var texture = gl.createTexture();
  var imgW = 2560, imgH = 1429;
  var dim = WALLPAPERS[current].dim;
  var textureReady = false;

  function uploadTexture(source, w, h) {
    imgW = w;
    imgH = h;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textureReady = true;
  }

  function setWallpaper(n) {
    if (!WALLPAPERS[n]) return;
    current = n;
    saveChoice();
    var im = new Image();
    im.onload = function () {
      uploadTexture(im, im.naturalWidth, im.naturalHeight);
      dim = WALLPAPERS[n].dim;
    };
    im.src = WALLPAPERS[n].src;
  }

  if (wallBtn) {
    wallBtn.addEventListener("click", function () {
      setWallpaper((current % 3) + 1);
    });
  }

  /* =================== sizing + render loop =================== */
  var DPR = 1;
  function setCanvasSize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * DPR);
    canvas.height = Math.round(window.innerHeight * DPR);
  }
  setCanvasSize();
  window.addEventListener("resize", setCanvasSize);

  function render() {
    if (textureReady) {
      var rect = card.getBoundingClientRect();
      var cx = (rect.left + rect.width / 2) * DPR;
      var cy = canvas.height - (rect.top + rect.height / 2) * DPR;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(U.resolution, canvas.width, canvas.height, 1.0);
      gl.uniform2f(U.imgRes, imgW, imgH);
      gl.uniform2f(U.cardPos, cx, cy);
      gl.uniform2f(U.cardHalf, (rect.width / 2 + 4) * DPR, (rect.height / 2 + 4) * DPR);
      gl.uniform1f(U.white, 0.0);
      gl.uniform1f(U.dim, dim);
      gl.uniform1f(U.px, DPR);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(U.texture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(render);
  }

  document.documentElement.classList.add("glass-on");
  setWallpaper(current);
  render();

  // prefetch the other wallpapers so the nav toggle swaps instantly
  window.addEventListener("load", function () {
    for (var n = 1; n <= 3; n++) {
      if (n !== current) { var im = new Image(); im.src = WALLPAPERS[n].src; }
    }
  });
})();

// liquid-glass-metal.js — glass layer for the liquid-metal DRAFT.
// Same bubbbly liquid-glass shader, rendered as a TRANSPARENT OVERLAY above the
// @paper-design LiquidMetal backdrop (js/liquid-metal-hero.js). The glass
// texture is a snapshot of the metal canvas (window.__metalCanvas, created with
// preserveDrawingBuffer) refreshed every 500ms: inside the 9x9 blur the slow
// refresh is imperceptible, and it costs 2 texture uploads/sec instead of 60.

(function () {
  "use strict";

  var SNAPSHOT_MS = 500;

  var canvas = document.getElementById("glassCanvas");
  var card = document.querySelector(".callcard");

  var gl = canvas && canvas.getContext("webgl", { antialias: false, alpha: true });
  if (!gl || !card) {
    document.documentElement.classList.add("glass-fallback");
    return;
  }

  var VS = "attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }";

  var FS = [
    "precision mediump float;",
    "",
    "uniform vec3 iResolution;",
    "uniform vec2 uImgRes;",
    "uniform vec2 uCardPos;",
    "uniform vec2 uCardHalf;",
    "uniform float uWhite;",
    "uniform float uDim;",
    "uniform float uPx;",
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
    "  float transition = smoothstep(0.0, 1.0, rb1 + rb2);",
    "  if (transition <= 0.0) { gl_FragColor = vec4(0.0); return; }",
    "",
    "  vec4 bg = texture2D(iChannel0, coverUv(uv));",
    "  bg.rgb *= uDim;",
    "",
    "  vec2 cuv = uCardPos / iResolution.xy;",
    "  vec2 lens = cuv + (uv - cuv) * (1.0 - roundedBox * 0.22);",
    "",
    "  vec4 acc = vec4(0.0);",
    "  float total = 0.0;",
    "  for (float x = -4.0; x <= 4.0; x++) {",
    "    for (float y = -4.0; y <= 4.0; y++) {",
    "      vec2 off = vec2(x, y) * 1.2 * uPx / iResolution.xy;",
    "      acc += texture2D(iChannel0, coverUv(lens + off));",
    "      total += 1.0;",
    "    }",
    "  }",
    "  acc /= total;",
    "  acc.rgb *= uDim;",
    "",
    "  float dy = uv.y - cuv.y;",
    "  float gradient = clamp((clamp(dy, 0.0, 0.2) + 0.1) / 2.0, 0.0, 1.0) +",
    "                   clamp((clamp(-dy, -1000.0, 0.2) * rb3 + 0.1) / 2.0, 0.0, 1.0);",
    "  vec4 lighting = clamp(acc + vec4(rb1) * gradient + vec4(rb2) * 0.3, 0.0, 1.0);",
    "  lighting = mix(lighting, vec4(1.0), uWhite * 0.97);",
    "",
    "  vec4 color = mix(bg, lighting, transition);",
    "  gl_FragColor = vec4(color.rgb * transition, transition);   // premultiplied alpha",
    "}",
  ].join("\n");

  function createShader(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("liquid-glass-metal shader error:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = createShader(gl.VERTEX_SHADER, VS);
  var fs = createShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { document.documentElement.classList.add("glass-fallback"); return; }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    document.documentElement.classList.add("glass-fallback");
    return;
  }
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
  var imgW = 1, imgH = 1;
  var textureReady = false;
  var lastSnapshot = 0;

  function snapshotMetal(now) {
    var src = window.__metalCanvas;
    if (!src || !src.width || !src.height) return;
    if (now - lastSnapshot < SNAPSHOT_MS) return;
    lastSnapshot = now;
    imgW = src.width;
    imgH = src.height;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textureReady = true;
  }

  var DPR = 1;
  function syncCanvasSize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth * DPR);
    var h = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  syncCanvasSize();

  function render(now) {
    requestAnimationFrame(render);
    syncCanvasSize();
    snapshotMetal(now || 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!textureReady) return;
    var rect = card.getBoundingClientRect();
    gl.uniform3f(U.resolution, canvas.width, canvas.height, 1.0);
    gl.uniform2f(U.imgRes, imgW, imgH);
    gl.uniform2f(U.cardPos,
      (rect.left + rect.width / 2) * DPR,
      canvas.height - (rect.top + rect.height / 2) * DPR);
    gl.uniform2f(U.cardHalf, (rect.width / 2 + 4) * DPR, (rect.height / 2 + 4) * DPR);
    gl.uniform1f(U.white, 0.0);
    gl.uniform1f(U.dim, 0.62);   // matches the #metalScrim dimming on the page
    gl.uniform1f(U.px, DPR);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(U.texture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  document.documentElement.classList.add("glass-on");
  requestAnimationFrame(render);
})();

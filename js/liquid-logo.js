(()=>{var ye=Object.defineProperty;var Re=(t,e,o)=>e in t?ye(t,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):t[e]=o;var I=(t,e,o)=>()=>{if(o)throw o[0];try{return t&&(e=t(t=0)),e}catch(i){throw o=[i],i}};var Be=(t,e)=>()=>{try{return e||t((e={exports:{}}).exports,e),e.exports}catch(o){throw e=0,o}};var n=(t,e,o)=>Re(t,typeof e!="symbol"?e+"":e,o);var re,se=I(()=>{re=`#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`});function ne(t,e,o){let i=t.createShader(e);return i?(t.shaderSource(i,o),t.compileShader(i),t.getShaderParameter(i,t.COMPILE_STATUS)?i:(console.error("An error occurred compiling the shaders: "+t.getShaderInfoLog(i)),t.deleteShader(i),null)):null}function Ue(t,e,o){let i=t.getShaderPrecisionFormat(t.FRAGMENT_SHADER,t.MEDIUM_FLOAT),s=i?i.precision:null;s&&s<23&&(e=e.replace(/precision\s+(lowp|mediump)\s+float;/g,"precision highp float;"),o=o.replace(/precision\s+(lowp|mediump)\s+float/g,"precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,"$1 highp $3"));let l=ne(t,t.VERTEX_SHADER,e),c=ne(t,t.FRAGMENT_SHADER,o);if(!l||!c)return null;let r=t.createProgram();return r?(t.attachShader(r,l),t.attachShader(r,c),t.linkProgram(r),t.getProgramParameter(r,t.LINK_STATUS)?(t.detachShader(r,l),t.detachShader(r,c),t.deleteShader(l),t.deleteShader(c),r):(console.error("Unable to initialize the shader program: "+t.getProgramInfoLog(r)),t.deleteProgram(r),t.deleteShader(l),t.deleteShader(c),null)):null}function Te(){let t=navigator.userAgent.toLowerCase();return t.includes("safari")&&!t.includes("chrome")&&!t.includes("android")}function Ve(t){var r,f;let e=(r=visualViewport==null?void 0:visualViewport.scale)!=null?r:1,o=(f=visualViewport==null?void 0:visualViewport.width)!=null?f:window.innerWidth,i=window.innerWidth-t.documentElement.clientWidth,s=e*o+i,l=outerWidth/s,c=Math.round(100*l);return c%5===0?c/100:c===33?1/3:c===67?2/3:c===133?4/3:l}var ae,A,Ee,le=I(()=>{se();ae=1920*1080*4,A=class{constructor(e,o,i,s,l=0,c=0,r=2,f=ae,u=[]){n(this,"parentElement");n(this,"canvasElement");n(this,"gl");n(this,"program",null);n(this,"uniformLocations",{});n(this,"fragmentShader");n(this,"rafId",null);n(this,"lastRenderTime",0);n(this,"currentFrame",0);n(this,"speed",0);n(this,"currentSpeed",0);n(this,"providedUniforms");n(this,"mipmaps",[]);n(this,"hasBeenDisposed",!1);n(this,"resolutionChanged",!0);n(this,"textures",new Map);n(this,"minPixelRatio");n(this,"maxPixelCount");n(this,"isSafari",Te());n(this,"uniformCache",{});n(this,"textureUnitMap",new Map);n(this,"ownerDocument");n(this,"initProgram",()=>{let e=Ue(this.gl,re,this.fragmentShader);e&&(this.program=e)});n(this,"setupPositionAttribute",()=>{let e=this.gl.getAttribLocation(this.program,"a_position"),o=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,o);let i=[-1,-1,1,-1,-1,1,-1,1,1,-1,1,1];this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(i),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(e),this.gl.vertexAttribPointer(e,2,this.gl.FLOAT,!1,0,0)});n(this,"setupUniforms",()=>{let e={u_time:this.gl.getUniformLocation(this.program,"u_time"),u_pixelRatio:this.gl.getUniformLocation(this.program,"u_pixelRatio"),u_resolution:this.gl.getUniformLocation(this.program,"u_resolution")};Object.entries(this.providedUniforms).forEach(([o,i])=>{if(e[o]=this.gl.getUniformLocation(this.program,o),i instanceof HTMLImageElement){let s=`${o}AspectRatio`;e[s]=this.gl.getUniformLocation(this.program,s)}}),this.uniformLocations=e});n(this,"renderScale",1);n(this,"parentWidth",0);n(this,"parentHeight",0);n(this,"parentDevicePixelWidth",0);n(this,"parentDevicePixelHeight",0);n(this,"devicePixelsSupported",!1);n(this,"resizeObserver",null);n(this,"setupResizeObserver",()=>{this.resizeObserver=new ResizeObserver(([e])=>{var o;if(e!=null&&e.borderBoxSize[0]){let i=(o=e.devicePixelContentBoxSize)==null?void 0:o[0];i!==void 0&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=i.inlineSize,this.parentDevicePixelHeight=i.blockSize),this.parentWidth=e.borderBoxSize[0].inlineSize,this.parentHeight=e.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)});n(this,"handleVisualViewportChange",()=>{var e;(e=this.resizeObserver)==null||e.disconnect(),this.setupResizeObserver()});n(this,"handleResize",()=>{var _;let e=0,o=0,i=Math.max(1,window.devicePixelRatio),s=(_=visualViewport==null?void 0:visualViewport.scale)!=null?_:1;if(this.devicePixelsSupported){let d=Math.max(1,this.minPixelRatio/i);e=this.parentDevicePixelWidth*d*s,o=this.parentDevicePixelHeight*d*s}else{let d=Math.max(i,this.minPixelRatio)*s;if(this.isSafari){let m=Ve(this.ownerDocument);d*=Math.max(1,m)}e=Math.round(this.parentWidth)*d,o=Math.round(this.parentHeight)*d}let l=Math.sqrt(this.maxPixelCount)/Math.sqrt(e*o),c=Math.min(1,l),r=Math.round(e*c),f=Math.round(o*c),u=r/Math.round(this.parentWidth);(this.canvasElement.width!==r||this.canvasElement.height!==f||this.renderScale!==u)&&(this.renderScale=u,this.canvasElement.width=r,this.canvasElement.height=f,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))});n(this,"render",e=>{if(this.hasBeenDisposed)return;if(this.program===null){console.warn("Tried to render before program or gl was initialized");return}let o=e-this.lastRenderTime;this.lastRenderTime=e,this.currentSpeed!==0&&(this.currentFrame+=o*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,this.currentFrame*.001),this.resolutionChanged&&(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),this.resolutionChanged=!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.currentSpeed!==0?this.requestRender():this.rafId=null});n(this,"requestRender",()=>{this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)});n(this,"setTextureUniform",(e,o)=>{if(!o.complete||o.naturalWidth===0)throw new Error(`Paper Shaders: image for uniform ${e} must be fully loaded`);let i=this.textures.get(e);i&&this.gl.deleteTexture(i),this.textureUnitMap.has(e)||this.textureUnitMap.set(e,this.textureUnitMap.size);let s=this.textureUnitMap.get(e);this.gl.activeTexture(this.gl.TEXTURE0+s);let l=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,l),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,o),this.mipmaps.includes(e)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let c=this.gl.getError();if(c!==this.gl.NO_ERROR||l===null){console.error("Paper Shaders: WebGL error when uploading texture:",c);return}this.textures.set(e,l);let r=this.uniformLocations[e];if(r){this.gl.uniform1i(r,s);let f=`${e}AspectRatio`,u=this.uniformLocations[f];if(u){let _=o.naturalWidth/o.naturalHeight;this.gl.uniform1f(u,_)}}});n(this,"areUniformValuesEqual",(e,o)=>e===o?!0:Array.isArray(e)&&Array.isArray(o)&&e.length===o.length?e.every((i,s)=>this.areUniformValuesEqual(i,o[s])):!1);n(this,"setUniformValues",e=>{this.gl.useProgram(this.program),Object.entries(e).forEach(([o,i])=>{let s=i;if(i instanceof HTMLImageElement&&(s=`${i.src.slice(0,200)}|${i.naturalWidth}x${i.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[o],s))return;this.uniformCache[o]=s;let l=this.uniformLocations[o];if(!l){console.warn(`Uniform location for ${o} not found`);return}if(i instanceof HTMLImageElement)this.setTextureUniform(o,i);else if(Array.isArray(i)){let c=null,r=null;if(i[0]!==void 0&&Array.isArray(i[0])){let f=i[0].length;if(i.every(u=>u.length===f))c=i.flat(),r=f;else{console.warn(`All child arrays must be the same length for ${o}`);return}}else c=i,r=c.length;switch(r){case 2:this.gl.uniform2fv(l,c);break;case 3:this.gl.uniform3fv(l,c);break;case 4:this.gl.uniform4fv(l,c);break;case 9:this.gl.uniformMatrix3fv(l,!1,c);break;case 16:this.gl.uniformMatrix4fv(l,!1,c);break;default:console.warn(`Unsupported uniform array length: ${r}`)}}else typeof i=="number"?this.gl.uniform1f(l,i):typeof i=="boolean"?this.gl.uniform1i(l,i?1:0):console.warn(`Unsupported uniform type for ${o}: ${typeof i}`)})});n(this,"getCurrentFrame",()=>this.currentFrame);n(this,"setFrame",e=>{this.currentFrame=e,this.lastRenderTime=performance.now(),this.render(performance.now())});n(this,"setSpeed",(e=1)=>{this.speed=e,this.setCurrentSpeed(this.ownerDocument.hidden?0:e)});n(this,"setCurrentSpeed",e=>{this.currentSpeed=e,this.rafId===null&&e!==0&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),this.rafId!==null&&e===0&&(cancelAnimationFrame(this.rafId),this.rafId=null)});n(this,"setMaxPixelCount",(e=ae)=>{this.maxPixelCount=e,this.handleResize()});n(this,"setMinPixelRatio",(e=2)=>{this.minPixelRatio=e,this.handleResize()});n(this,"setUniforms",e=>{this.setUniformValues(e),this.providedUniforms={...this.providedUniforms,...e},this.render(performance.now())});n(this,"handleDocumentVisibilityChange",()=>{this.setCurrentSpeed(this.ownerDocument.hidden?0:this.speed)});n(this,"dispose",()=>{this.hasBeenDisposed=!0,this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(e=>{this.gl.deleteTexture(e)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=null),visualViewport==null||visualViewport.removeEventListener("resize",this.handleVisualViewportChange),this.ownerDocument.removeEventListener("visibilitychange",this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount});if((e==null?void 0:e.nodeType)===1)this.parentElement=e;else throw new Error("Paper Shaders: parent element must be an HTMLElement");if(this.ownerDocument=e.ownerDocument,!this.ownerDocument.querySelector("style[data-paper-shader]")){let m=this.ownerDocument.createElement("style");m.innerHTML=Ee,m.setAttribute("data-paper-shader",""),this.ownerDocument.head.prepend(m)}let _=this.ownerDocument.createElement("canvas");this.canvasElement=_,this.parentElement.prepend(_),this.fragmentShader=o,this.providedUniforms=i,this.mipmaps=u,this.currentFrame=c,this.minPixelRatio=r,this.maxPixelCount=f;let d=_.getContext("webgl2",s);if(!d)throw new Error("Paper Shaders: WebGL is not supported in this browser");this.gl=d,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport==null||visualViewport.addEventListener("resize",this.handleVisualViewportChange),this.setSpeed(l),this.parentElement.setAttribute("data-paper-shader",""),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener("visibilitychange",this.handleDocumentVisibilityChange)}};Ee=`@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      corner-shape: inherit;
    }
  }
}`});var C,ce=I(()=>{C={none:0,contain:1,cover:2}});var ue,de,he,me,fe=I(()=>{ue=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,de=`
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`,he=`
  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);
`,me=`
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`});function j(t){let e=document.createElement("canvas"),o=e.getContext("2d"),i=typeof t=="string"&&t.startsWith("blob:");return new Promise((s,l)=>{if(!t||!o){l(new Error("Invalid file or canvas context"));return}let c=i&&fetch(t).then(u=>u.headers.get("Content-Type")),r=new Image;r.crossOrigin="anonymous";let f=performance.now();r.onload=async()=>{let u,_=await c;_?u=_==="image/svg+xml":typeof t=="string"?u=t.endsWith(".svg")||t.startsWith("data:image/svg+xml"):u=t.type==="image/svg+xml";let d=r.width||r.naturalWidth,m=r.height||r.naturalHeight;if(u){let p=d/m;d>m?(d=4096,m=4096/p):(m=4096,d=4096*p),r.width=d,r.height=m}let T=Math.min(d,m),v=z.workingSize/T,a=Math.round(d*v),g=Math.round(m*v);z.measurePerformance&&(console.log("[Processing Mode]"),console.log(`  Original: ${d}\xD7${m}`),console.log(`  Working: ${a}\xD7${g} (${(v*100).toFixed(1)}% scale)`),v<1&&console.log(`  Speedup: ~${Math.round(1/(v*v))}\xD7`)),e.width=d,e.height=m;let y=document.createElement("canvas");y.width=a,y.height=g;let V=y.getContext("2d");V.drawImage(r,0,0,a,g);let F=performance.now(),w=V.getImageData(0,0,a,g).data,b=new Uint8Array(a*g),G=new Uint8Array(a*g),W=0;for(let h=0,p=0;h<w.length;h+=4,p++){let S=w[h+3]===0?0:1;b[p]=S,W+=S}let N=[],M=[];for(let h=0;h<g;h++)for(let p=0;p<a;p++){let x=h*a+p;if(!b[x])continue;let S=!1;p===0||p===a-1||h===0||h===g-1?S=!0:S=!b[x-1]||!b[x+1]||!b[x-a]||!b[x+a]||!b[x-a-1]||!b[x-a+1]||!b[x+a-1]||!b[x+a+1],S?(G[x]=1,N.push(x)):M.push(x)}z.measurePerformance&&(console.log(`[Mask Building] Time: ${(performance.now()-F).toFixed(2)}ms`),console.log(`  Shape pixels: ${W} / ${a*g} (${(W/(a*g)*100).toFixed(1)}%)`),console.log(`  Interior pixels: ${M.length}`),console.log(`  Boundary pixels: ${N.length}`));let be=Fe(b,G,new Uint32Array(M),new Uint32Array(N),a,g),Se=performance.now(),$=Ie(be,b,G,a,g);z.measurePerformance&&console.log(`[Poisson Solve] Time: ${(performance.now()-Se).toFixed(2)}ms`);let H=0,te;for(let h=0;h<M.length;h++){let p=M[h];$[p]>H&&(H=$[p])}let L=document.createElement("canvas");L.width=a,L.height=g;let oe=L.getContext("2d"),U=oe.createImageData(a,g);for(let h=0;h<g;h++)for(let p=0;p<a;p++){let x=h*a+p,S=x*4;if(!b[x])U.data[S]=255,U.data[S+1]=255,U.data[S+2]=255,U.data[S+3]=0;else{let q=255*(1-$[x]/H);U.data[S]=q,U.data[S+1]=q,U.data[S+2]=q,U.data[S+3]=255}}oe.putImageData(U,0,0),o.imageSmoothingEnabled=!0,o.imageSmoothingQuality="high",o.drawImage(L,0,0,a,g,0,0,d,m);let R=o.getImageData(0,0,d,m),X=document.createElement("canvas");X.width=d,X.height=m;let ie=X.getContext("2d");ie.drawImage(r,0,0,d,m);let we=ie.getImageData(0,0,d,m);for(let h=0;h<R.data.length;h+=4){let p=we.data[h+3],x=R.data[h+3];p===0?(R.data[h]=255,R.data[h+1]=0):(R.data[h]=x===0?0:R.data[h],R.data[h+1]=p),R.data[h+2]=255,R.data[h+3]=255}o.putImageData(R,0,0),te=R,e.toBlob(h=>{if(!h){l(new Error("Failed to create PNG blob"));return}if(z.measurePerformance){let p=performance.now()-f;if(console.log(`[Total Processing Time] ${p.toFixed(2)}ms`),v<1){let x=p*Math.pow(d*m/(a*g),1.5);console.log(`[Estimated time at full resolution] ~${x.toFixed(0)}ms`),console.log(`[Time saved] ~${(x-p).toFixed(0)}ms (${Math.round(x/p)}\xD7 faster)`)}}s({imageData:te,pngBlob:h})},"image/png")},r.onerror=()=>l(new Error("Failed to load image")),r.src=typeof t=="string"?t:URL.createObjectURL(t)})}function Fe(t,e,o,i,s,l){let c=o.length,r=new Int32Array(c*4);for(let f=0;f<c;f++){let u=o[f],_=u%s,d=Math.floor(u/s);r[f*4+0]=_<s-1&&t[u+1]?u+1:-1,r[f*4+1]=_>0&&t[u-1]?u-1:-1,r[f*4+2]=d>0&&t[u-s]?u-s:-1,r[f*4+3]=d<l-1&&t[u+s]?u+s:-1}return{interiorPixels:o,boundaryPixels:i,pixelCount:c,neighborIndices:r}}function Ie(t,e,o,i,s){let l=z.iterations,c=.01,r=new Float32Array(i*s),{interiorPixels:f,neighborIndices:u,pixelCount:_}=t,d=performance.now(),m=1.9,T=[],B=[];for(let v=0;v<_;v++){let a=f[v],g=a%i,y=Math.floor(a/i);(g+y)%2===0?T.push(v):B.push(v)}for(let v=0;v<l;v++){for(let a of T){let g=f[a],y=u[a*4+0],V=u[a*4+1],F=u[a*4+2],P=u[a*4+3],w=0;y>=0&&(w+=r[y]),V>=0&&(w+=r[V]),F>=0&&(w+=r[F]),P>=0&&(w+=r[P]);let b=(c+w)/4;r[g]=m*b+(1-m)*r[g]}for(let a of B){let g=f[a],y=u[a*4+0],V=u[a*4+1],F=u[a*4+2],P=u[a*4+3],w=0;y>=0&&(w+=r[y]),V>=0&&(w+=r[V]),F>=0&&(w+=r[F]),P>=0&&(w+=r[P]);let b=(c+w)/4;r[g]=m*b+(1-m)*r[g]}}if(z.measurePerformance){let v=performance.now()-d;console.log(`[Optimized Poisson Solver (SOR \u03C9=${m})]`),console.log(`  Working size: ${i}\xD7${s}`),console.log(`  Iterations: ${l}`),console.log(`  Time: ${v.toFixed(2)}ms`),console.log(`  Interior pixels processed: ${_}`),console.log(`  Speed: ${(l*_/(v*1e3)).toFixed(2)} Mpixels/sec`)}return r}var Y,z,K,pe=I(()=>{fe();Y=`#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform vec2 u_resolution;
uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colorTint;

uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_angle;

uniform float u_shape;
uniform bool u_isImage;

in vec2 v_objectUV;
in vec2 v_responsiveUV;
in vec2 v_responsiveBoxGivenSize;
in vec2 v_imageUV;

out vec4 fragColor;

${ue}
${de}
${me}

float getColorChanges(float c1, float c2, float stripe_p, vec3 w, float blur, float bump, float tint) {

  float ch = mix(c2, c1, smoothstep(.0, 2. * blur, stripe_p));

  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  if (u_isImage == true) {
    bump = smoothstep(.2, .8, bump);
  }
  border = w[0] + .4 * (1. - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + .5 * (1. - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
  ch = mix(ch, gradient, smoothstep(border, border + .5 * blur, stripe_p));

  // Tint color is applied with color burn blending
  ch = mix(ch, 1. - min(1., (1. - ch) / max(tint, 0.0001)), u_colorTint.a);
  return ch;
}

float getImgFrame(vec2 uv, float th) {
  float frame = 1.;
  frame *= smoothstep(0., th, uv.y);
  frame *= 1.0 - smoothstep(1. - th, 1., uv.y);
  frame *= smoothstep(0., th, uv.x);
  frame *= 1.0 - smoothstep(1. - th, 1., uv.x);
  return frame;
}

float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / vec2(textureSize(tex, 0));
  vec2 r = radius * texel;

  float w1 = 1.0, w2 = 2.0, w4 = 4.0;
  float norm = 16.0;
  float sum = w4 * centerSample;

  sum += w2 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).r;

  sum += w1 * textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).r;

  return sum / norm;
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {

  const float firstFrameOffset = 2.8;
  float t = .3 * (u_time + firstFrameOffset);

  vec2 uv = v_imageUV;
  vec2 dudx = dFdx(v_imageUV);
  vec2 dudy = dFdy(v_imageUV);
  vec4 img = textureGrad(u_image, uv, dudx, dudy);

  if (u_isImage == false) {
    uv = v_objectUV + .5;
    uv.y = 1. - uv.y;
  }

  float cycleWidth = u_repetition;
  float edge = 0.;
  float contOffset = 1.;

  vec2 rotatedUV = uv - vec2(.5);
  float angle = (-u_angle + 70.) * PI / 180.;
  float cosA = cos(angle);
  float sinA = sin(angle);
  rotatedUV = vec2(
  rotatedUV.x * cosA - rotatedUV.y * sinA,
  rotatedUV.x * sinA + rotatedUV.y * cosA
  ) + vec2(.5);

  if (u_isImage == true) {
    float edgeRaw = img.r;
    edge = blurEdge3x3(u_image, uv, dudx, dudy, 6., edgeRaw);
    edge = pow(edge, 1.6);
    edge *= mix(0.0, 1.0, smoothstep(0.0, 0.4, u_contour));
  } else {
    if (u_shape < 1.) {
      // full-fill on canvas
      vec2 borderUV = v_responsiveUV + .5;
      float ratio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
      vec2 mask = min(borderUV, 1. - borderUV);
      vec2 pixel_thickness = min(250. / v_responsiveBoxGivenSize, vec2(.5));
      float maskX = smoothstep(0.0, pixel_thickness.x, mask.x);
      float maskY = smoothstep(0.0, pixel_thickness.y, mask.y);
      maskX = pow(maskX, .25);
      maskY = pow(maskY, .25);
      edge = clamp(1. - maskX * maskY, 0., 1.);

      uv = v_responsiveUV;
      if (ratio > 1.) {
        uv.y /= ratio;
      } else {
        uv.x *= ratio;
      }
      uv += .5;
      uv.y = 1. - uv.y;

      cycleWidth *= 2.;
      contOffset = 1.5;

    } else if (u_shape < 2.) {
      // circle
      vec2 shapeUV = uv - .5;
      shapeUV *= .67;
      edge = pow(clamp(3. * length(shapeUV), 0., 1.), 18.);
    } else if (u_shape < 3.) {
      // daisy
      vec2 shapeUV = uv - .5;
      shapeUV *= 1.68;

      float r = length(shapeUV) * 2.;
      float a = atan(shapeUV.y, shapeUV.x) + .2;
      r *= (1. + .05 * sin(3. * a + 2. * t));
      float f = abs(cos(a * 3.));
      edge = smoothstep(f, f + .7, r);
      edge *= edge;

      uv *= .8;
      cycleWidth *= 1.6;

    } else if (u_shape < 4.) {
      // diamond
      vec2 shapeUV = uv - .5;
      shapeUV = rotate(shapeUV, .25 * PI);
      shapeUV *= 1.42;
      shapeUV += .5;
      vec2 mask = min(shapeUV, 1. - shapeUV);
      vec2 pixel_thickness = vec2(.15);
      float maskX = smoothstep(0.0, pixel_thickness.x, mask.x);
      float maskY = smoothstep(0.0, pixel_thickness.y, mask.y);
      maskX = pow(maskX, .25);
      maskY = pow(maskY, .25);
      edge = clamp(1. - maskX * maskY, 0., 1.);
    } else if (u_shape < 5.) {
      // metaballs
      vec2 shapeUV = uv - .5;
      shapeUV *= 1.3;
      edge = 0.;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float speed = 1.5 + 2./3. * sin(fi * 12.345);
        float angle = -fi * 1.5;
        vec2 dir1 = vec2(cos(angle), sin(angle));
        vec2 dir2 = vec2(cos(angle + 1.57), sin(angle + 1.));
        vec2 traj = .4 * (dir1 * sin(t * speed + fi * 1.23) + dir2 * cos(t * (speed * 0.7) + fi * 2.17));
        float d = length(shapeUV + traj);
        edge += pow(1.0 - clamp(d, 0.0, 1.0), 4.0);
      }
      edge = 1. - smoothstep(.65, .9, edge);
      edge = pow(edge, 4.);
    }

    edge = mix(smoothstep(.9 - 2. * fwidth(edge), .9, edge), edge, smoothstep(0.0, 0.4, u_contour));

  }

  float opacity = 0.;
  if (u_isImage == true) {
    opacity = img.g;
    float frame = getImgFrame(v_imageUV, 0.);
    opacity *= frame;
  } else {
    opacity = 1. - smoothstep(.9 - 2. * fwidth(edge), .9, edge);
    if (u_shape < 2.) {
      edge = 1.2 * edge;
    } else if (u_shape < 5.) {
      edge = 1.8 * pow(edge, 1.5);
    }
  }

  float diagBLtoTR = rotatedUV.x - rotatedUV.y;
  float diagTLtoBR = rotatedUV.x + rotatedUV.y;

  vec3 color = vec3(0.);
  vec3 color1 = vec3(.98, 0.98, 1.);
  vec3 color2 = vec3(.1, .1, .1 + .1 * smoothstep(.7, 1.3, diagTLtoBR));

  vec2 grad_uv = uv - .5;

  float dist = length(grad_uv + vec2(0., .2 * diagBLtoTR));
  grad_uv = rotate(grad_uv, (.25 - .2 * diagBLtoTR) * PI);
  float direction = grad_uv.x;

  float bump = pow(1.8 * dist, 1.2);
  bump = 1. - bump;
  bump *= pow(uv.y, .3);


  float thin_strip_1_ratio = .12 / cycleWidth * (1. - .4 * bump);
  float thin_strip_2_ratio = .07 / cycleWidth * (1. + .4 * bump);
  float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

  float thin_strip_1_width = cycleWidth * thin_strip_1_ratio;
  float thin_strip_2_width = cycleWidth * thin_strip_2_ratio;

  float noise = snoise(uv - t);

  edge += (1. - edge) * u_distortion * noise;

  direction += diagBLtoTR;
  float contour = 0.;
  direction -= 2. * noise * diagBLtoTR * (smoothstep(0., 1., edge) * (1.0 - smoothstep(0., 1., edge)));
  direction *= mix(1., 1. - edge, smoothstep(.5, 1., u_contour));
  direction -= 1.7 * edge * smoothstep(.5, 1., u_contour);
  direction += .2 * pow(u_contour, 4.) * (1.0 - smoothstep(0., 1., edge));

  bump *= clamp(pow(uv.y, .1), .3, 1.);
  direction *= (.1 + (1.1 - edge) * bump);

  direction *= (.4 + .6 * (1.0 - smoothstep(.5, 1., edge)));
  direction += .18 * (smoothstep(.1, .2, uv.y) * (1.0 - smoothstep(.2, .4, uv.y)));
  direction += .03 * (smoothstep(.1, .2, 1. - uv.y) * (1.0 - smoothstep(.2, .4, 1. - uv.y)));

  direction *= (.5 + .5 * pow(uv.y, 2.));
  direction *= cycleWidth;
  direction -= t;


  float colorDispersion = (1. - bump);
  colorDispersion = clamp(colorDispersion, 0., 1.);
  float dispersionRed = colorDispersion;
  dispersionRed += .03 * bump * noise;
  dispersionRed += 5. * (smoothstep(-.1, .2, uv.y) * (1.0 - smoothstep(.1, .5, uv.y))) * (smoothstep(.4, .6, bump) * (1.0 - smoothstep(.4, 1., bump)));
  dispersionRed -= diagBLtoTR;

  float dispersionBlue = colorDispersion;
  dispersionBlue *= 1.3;
  dispersionBlue += (smoothstep(0., .4, uv.y) * (1.0 - smoothstep(.1, .8, uv.y))) * (smoothstep(.4, .6, bump) * (1.0 - smoothstep(.4, .8, bump)));
  dispersionBlue -= .2 * edge;

  dispersionRed *= (u_shiftRed / 20.);
  dispersionBlue *= (u_shiftBlue / 20.);

  float blur = 0.;
  float rExtraBlur = 0.;
  float gExtraBlur = 0.;
  if (u_isImage == true) {
    float softness = 0.05 * u_softness;
    blur = softness + .5 * smoothstep(1., 10., u_repetition) * smoothstep(.0, 1., edge);
    float smallCanvasT = 1.0 - smoothstep(100., 500., min(u_resolution.x, u_resolution.y));
    blur += smallCanvasT * smoothstep(.0, 1., edge);
    rExtraBlur = softness * (0.05 + .1 * (u_shiftRed / 20.) * bump);
    gExtraBlur = softness * 0.05 / max(0.001, abs(1. - diagBLtoTR));
  } else {
    blur = u_softness / 15. + .3 * contour;
  }

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., edge + bump);
  float stripe_r = fract(direction + dispersionRed);
  float r = getColorChanges(color1.r, color2.r, stripe_r, w, blur + fwidth(stripe_r) + rExtraBlur, bump, u_colorTint.r);
  float stripe_g = fract(direction);
  float g = getColorChanges(color1.g, color2.g, stripe_g, w, blur + fwidth(stripe_g) + gExtraBlur, bump, u_colorTint.g);
  float stripe_b = fract(direction - dispersionBlue);
  float b = getColorChanges(color1.b, color2.b, stripe_b, w, blur + fwidth(stripe_b), bump, u_colorTint.b);

  color = vec3(r, g, b);
  color *= opacity;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  ${he}

  fragColor = vec4(color, opacity);
}
`,z={measurePerformance:!1,workingSize:512,iterations:40};K={none:0,circle:1,daisy:2,diamond:3,metaballs:4}});function k(t){if(Array.isArray(t))return t.length===4?t:t.length===3?[...t,1]:Q;if(typeof t!="string")return Q;let e,o,i,s=1;if(t.startsWith("#"))[e,o,i,s]=ze(t);else if(t.startsWith("rgb"))[e,o,i,s]=Pe(t);else if(t.startsWith("hsl"))[e,o,i,s]=Ae(Me(t));else return console.error("Unsupported color format",t),Q;return[O(e,0,1),O(o,0,1),O(i,0,1),O(s,0,1)]}function ze(t){t=t.replace(/^#/,""),t.length===3&&(t=t.split("").map(l=>l+l).join("")),t.length===6&&(t=t+"ff");let e=parseInt(t.slice(0,2),16)/255,o=parseInt(t.slice(2,4),16)/255,i=parseInt(t.slice(4,6),16)/255,s=parseInt(t.slice(6,8),16)/255;return[e,o,i,s]}function Pe(t){var o,i,s;let e=t.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);return e?[parseInt((o=e[1])!=null?o:"0")/255,parseInt((i=e[2])!=null?i:"0")/255,parseInt((s=e[3])!=null?s:"0")/255,e[4]===void 0?1:parseFloat(e[4])]:[0,0,0,1]}function Me(t){var o,i,s;let e=t.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);return e?[parseInt((o=e[1])!=null?o:"0"),parseInt((i=e[2])!=null?i:"0"),parseInt((s=e[3])!=null?s:"0"),e[4]===void 0?1:parseFloat(e[4])]:[0,0,0,1]}function Ae(t){let[e,o,i,s]=t,l=e/360,c=o/100,r=i/100,f,u,_;if(o===0)f=u=_=r;else{let d=(B,v,a)=>(a<0&&(a+=1),a>1&&(a-=1),a<.16666666666666666?B+(v-B)*6*a:a<.5?v:a<.6666666666666666?B+(v-B)*(.6666666666666666-a)*6:B),m=r<.5?r*(1+c):r+c-r*c,T=2*r-m;f=d(T,m,l+1/3),u=d(T,m,l),_=d(T,m,l-1/3)}return[f,u,_,s]}var O,Q,ge=I(()=>{O=(t,e,o)=>Math.min(Math.max(t,e),o),Q=[0,0,0,1]});var ve=I(()=>{le();ce();pe();ge()});var Oe=Be(()=>{ve();var Z={chrome:{label:"Liquid Chrome",colorBack:"#aaaaac00",colorTint:"#ffffff00",repetition:2.6,softness:.1,shiftRed:.3,shiftBlue:.3,distortion:.07,contour:.4,angle:94,speed:1},obsidian:{label:"Obsidian",colorBack:"#00000400",colorTint:"#8a8a96b3",repetition:1.9,softness:.32,shiftRed:.12,shiftBlue:.12,distortion:.05,contour:.34,angle:90,speed:.85},platinum:{label:"Platinum Frost",colorBack:"#aaaaac00",colorTint:"#eaf0ff3a",repetition:2.4,softness:.12,shiftRed:.24,shiftBlue:.36,distortion:.06,contour:.46,angle:94,speed:1},amber:{label:"Molten Amber",colorBack:"#1a0e0000",colorTint:"#e0a23ad9",repetition:2.6,softness:.12,shiftRed:.35,shiftBlue:.2,distortion:.07,contour:.4,angle:94,speed:1}},D={fit:"contain",scale:.86,rotation:0,originX:.5,originY:.5},xe=typeof window!="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;function E(t,e){let o=parseFloat(t);return Number.isNaN(o)?e:o}function De(t){return new Promise((e,o)=>{let i=new FileReader;i.onload=()=>e(i.result),i.onerror=o,i.readAsDataURL(t)})}function Le(t){let e=t;return t.tagName==="CANVAS"&&(e=document.createElement("div"),e.className=t.className,t.getAttribute("aria-label")&&e.setAttribute("aria-label",t.getAttribute("aria-label")),Object.keys(t.dataset).forEach(o=>{e.dataset[o]=t.dataset[o]}),t.parentNode&&t.parentNode.replaceChild(e,t)),e.style.position=e.style.position||"relative",e.style.overflow="hidden",e}function Ce(t){let e=t.dataset||{},o=e.preset&&Z[e.preset]?e.preset:"chrome",i=Z[o],s=null;return e.logoKey&&window.LIQUID_LOGOS&&window.LIQUID_LOGOS[e.logoKey]&&(s=window.LIQUID_LOGOS[e.logoKey]),{preset:o,logo:e.logo||null,logoData:s,colorBack:e.colorBack||i.colorBack,colorTint:e.colorTint||i.colorTint,repetition:E(e.repetition,i.repetition),softness:E(e.softness,i.softness),shiftRed:E(e.shiftRed,i.shiftRed),shiftBlue:E(e.shiftBlue,i.shiftBlue),distortion:E(e.distortion,i.distortion),contour:E(e.contour,i.contour),angle:E(e.angle,i.angle),speed:E(e.speed,i.speed),fit:e.fit||D.fit,scale:E(e.scale,D.scale)}}var J=class{constructor(e){this.el=Le(e),this.opts=Ce(this.el),this.mount=null,this.started=!1,this._observe()}_observe(){if(!("IntersectionObserver"in window)){this.start();return}this.io=new IntersectionObserver(e=>{e.forEach(o=>{o.isIntersecting?(this.start(),this.mount&&this.mount.setSpeed(xe?0:this.opts.speed)):this.mount&&this.mount.setSpeed(0)})},{rootMargin:"300px"}),this.io.observe(this.el)}async start(){if(this.started)return;this.started=!0;let e=this.opts.logoData||this.opts.logo;if(e)try{let o=await j(e),i=await De(o.pngBlob),s=new Image;if(s.src=i,s.decode)try{await s.decode()}catch{}else await new Promise(l=>{s.onload=l,s.onerror=l});this._mount(s)}catch(o){console.warn("[LiquidLogo] processing/WebGL failed, using static fallback:",o),this._fallback()}}_mount(e){var s,l;let o=this.opts,i={u_colorBack:k(o.colorBack),u_colorTint:k(o.colorTint),u_image:e,u_contour:o.contour,u_distortion:o.distortion,u_softness:o.softness,u_repetition:o.repetition,u_shiftRed:o.shiftRed,u_shiftBlue:o.shiftBlue,u_angle:o.angle,u_isImage:!0,u_shape:(s=K.none)!=null?s:0,u_fit:(l=C[o.fit])!=null?l:C.contain,u_scale:o.scale,u_rotation:D.rotation,u_offsetX:0,u_offsetY:0,u_originX:D.originX,u_originY:D.originY,u_worldWidth:0,u_worldHeight:0};try{let c=this.el.dataset.preserve?{preserveDrawingBuffer:!0}:void 0;this.mount=new A(this.el,Y,i,c,xe?0:o.speed,0,void 0,void 0,["u_image"])}catch(c){console.warn("[LiquidLogo] ShaderMount failed, using static fallback:",c),this._fallback()}}_fallback(){if(this._fellBack)return;this._fellBack=!0;let e=this.opts.logo||this.opts.logoData;if(!e)return;let o=document.createElement("img");o.src=e,o.alt=this.el.getAttribute("aria-label")||"",o.style.cssText="width:100%;height:100%;object-fit:contain;display:block",this.el.appendChild(o)}};function _e(t){if(!t||t.__liquidLogo)return t&&t.__liquidLogo;let e=new J(t);return t.__liquidLogo=e,e}function ee(t){(t||document).querySelectorAll("[data-liquid-logo]").forEach(_e)}window.LiquidLogo={create:_e,initAll:ee,PRESETS:Z};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>ee()):ee()});Oe();})();

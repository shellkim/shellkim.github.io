// Local adaptation of the supplied Ribbon Glow — Originkit shader.
(() => {
const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uSize;
uniform float uAngle;
uniform vec2 uMouse;
uniform float uOn;
uniform float uReach;
uniform vec2 uVel;
out vec4 o;

const float TAU = 6.28318530718;
const float LAYERS = 84.0;
const float TWIST = 1.35;
const float DRAG = 0.22;
const float GAIN = 0.62;
const vec2 CENTRE = vec2(-0.62, 0.24);
const float TILT = 0.6;
const float ZOOM = 1.05;
const float THETA = 2.13;
const float SHEAR = 0.963;
const float SHRINK = 0.953;
const vec2 WARP_FREQ = vec2(0.42, 2.4);
const vec2 WARP_AMP = vec2(0.13, 0.027);
const vec2 ASPECT = vec2(1.65, 0.14);
const float OFFSET = 0.36;
const float GLOW = 0.0042;
const float SOFT = 0.0065;
const float FALLOFF = 0.37;
const float PHASE = 12.0;
const float CYCLE = 0.16;
const float HUE_TRAVEL = 2.0;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  vec2 R = uRes;
  vec2 pos = (gl_FragCoord.xy - 0.5 * R) / R.y;

  vec2 d = pos - uMouse;
  float w = uOn * exp(-dot(d, d) / (uReach * uReach));
  if (w > 1e-4) pos = uMouse + rot(w * TWIST) * d * (1.0 - 0.3 * min(w, 1.0)) - uVel * min(w, 1.0) * DRAG;

  pos = rot(uAngle) * pos / uSize;
  float t = uTime * 0.49 + PHASE;
  float breath = (-sin(uTime * 0.735) + sin(uTime * 0.49 + 1.0)) * 0.25 + 0.5;
  vec2 u = rot(TILT) * ((pos - CENTRE) * (ZOOM - breath * 0.085));
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));

  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= LAYERS; i += 1.0) {
    u.x -= sin(u.y * WARP_FREQ.x + t + i * 0.007) * WARP_AMP.x;
    u.y -= sin(u.x * WARP_FREQ.y - t + i * 0.02) * WARP_AMP.y;
    u = fold * u * SHRINK;
    vec2 q = (u - vec2(OFFSET + breath * 0.1, 0.0)) * ASPECT;
    float g = GLOW / (dot(q, q) + SOFT) * (0.25 + breath * 0.4);
    float r = length(u);
    float k = sin(i * CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    col += g * mix(uC1, uC2, k) * (0.62 + 0.5 * k) * exp2(-r * FALLOFF);
  }
  vec3 x = max(col * GAIN, 0.0);
  col = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98));
  col *= 1.0 - smoothstep(0.5, 1.6, length(pos)) * 0.07;
  float intensity = smoothstep(0.16, 0.95, max(col.r, max(col.g, col.b)));
  vec3 coastal = mix(uC1, uC2, smoothstep(0.55, 1.0, intensity));
  o = vec4(coastal, intensity * 0.88);
}
`;
const hero = document.querySelector('.hero');
const canvas = document.querySelector('.ribbon-glow');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
const gl = canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:false, antialias:false, depth:false});
if (!gl) { canvas.dataset.status='unsupported'; return; }
function shader(type, source) {
 const value = gl.createShader(type); gl.shaderSource(value,source); gl.compileShader(value);
 if (!gl.getShaderParameter(value,gl.COMPILE_STATUS)) { canvas.dataset.status='shader-error'; console.error(gl.getShaderInfoLog(value)); gl.deleteShader(value); return null; }
 return value;
}
const vs=shader(gl.VERTEX_SHADER,VERT), fs=shader(gl.FRAGMENT_SHADER,FRAG);
if (!vs || !fs) return;
const program=gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
gl.deleteShader(vs); gl.deleteShader(fs);
if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {canvas.dataset.status='link-error';return;}
gl.useProgram(program);
const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
const uniforms=Object.fromEntries(['uRes','uTime','uC1','uC2','uSize','uAngle','uMouse','uOn','uReach','uVel'].map(k=>[k,gl.getUniformLocation(program,k)]));
let frame=0, visible=false, lost=false, previous=0, time=0, lastPaint=0;
let pointer={x:0,y:0,on:0}, smooth={x:0,y:0,on:0}, velocity={x:0,y:0};
function resize(){
 const r=canvas.getBoundingClientRect(); const scale=Math.min(devicePixelRatio||1,1.25)*0.7;
 canvas.width=Math.max(1,Math.round(r.width*scale)); canvas.height=Math.max(1,Math.round(r.height*scale));
}
function draw(dt){
 const k=1-Math.exp(-dt*12), oldX=smooth.x, oldY=smooth.y;
 smooth.x+=(pointer.x-smooth.x)*k; smooth.y+=(pointer.y-smooth.y)*k;
 smooth.on+=(pointer.on-smooth.on)*(1-Math.exp(-dt*6));
 const vk=1-Math.exp(-dt*9);
 if(dt>0){velocity.x+=((smooth.x-oldX)/dt-velocity.x)*vk;velocity.y+=((smooth.y-oldY)/dt-velocity.y)*vk;}
 const cap=Math.min(1,2.5/(Math.hypot(velocity.x,velocity.y)||1));
 gl.viewport(0,0,canvas.width,canvas.height); gl.useProgram(program);
 gl.uniform2f(uniforms.uRes,canvas.width,canvas.height); gl.uniform1f(uniforms.uTime,time);
 gl.uniform3f(uniforms.uC1,159/255,199/255,206/255); // Coastal Blue #9FC7CE
 gl.uniform3f(uniforms.uC2,238/255,245/255,243/255); // Highlight #EEF5F3
 gl.uniform1f(uniforms.uSize,1.35); gl.uniform1f(uniforms.uAngle,-0.15);
 gl.uniform2f(uniforms.uMouse,smooth.x,smooth.y); gl.uniform1f(uniforms.uOn,coarse.matches?0:smooth.on*1.15);
 gl.uniform1f(uniforms.uReach,0.48); gl.uniform2f(uniforms.uVel,velocity.x*cap,velocity.y*cap);
 gl.drawArrays(gl.TRIANGLES,0,3); canvas.dataset.status='running'; canvas.dataset.time=time.toFixed(2); canvas.dataset.pointer=smooth.on.toFixed(2); canvas.dataset.velocity=Math.hypot(velocity.x,velocity.y).toFixed(2);
}
function tick(now){
 frame=0; if(!visible||document.hidden||reduced.matches||lost)return;
 if(now-lastPaint>=33){const dt=Math.min((now-previous)/1000||0,.05); previous=now;lastPaint=now;time+=dt*.65;draw(dt);}
 frame=requestAnimationFrame(tick);
}
function sync(){
 cancelAnimationFrame(frame); frame=0;
 canvas.hidden=reduced.matches||lost;
 if(visible&&!document.hidden&&!reduced.matches&&!lost){previous=performance.now();frame=requestAnimationFrame(tick);}
}
hero.addEventListener('pointermove',e=>{if(coarse.matches)return;const r=canvas.getBoundingClientRect();pointer={x:(e.clientX-r.left-r.width/2)/r.height,y:(r.height/2-e.clientY+r.top)/r.height,on:1};},{passive:true});
hero.addEventListener('pointerleave',()=>pointer.on=0);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(hero);
new ResizeObserver(()=>{resize();}).observe(canvas);
document.addEventListener('visibilitychange',sync); reduced.addEventListener('change',sync);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;sync();});
resize(); sync();
})();

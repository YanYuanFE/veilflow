import { useEffect, useRef, useSyncExternalStore } from "react"

/* Hero background: an animated WebGL2 noise mesh-gradient — gold blooms drifting
 * over ivory — the same approach Zama uses on its confidential-token page. A
 * custom fragment shader, no 3D library. Reduced-motion (or no WebGL2, or a
 * shader failure) renders nothing and the CSS fallback gradient on .vl-hero
 * shows instead. */

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 fragColor;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.8;
  float t = u_time * 0.045;
  float n1 = fbm(p + vec2(t, t * 0.6));
  float n2 = fbm(p + vec2(-t * 0.7, t * 0.4) + n1);
  float m = 0.5 + 0.5 * n2;

  vec3 ivory = vec3(0.984, 0.969, 0.925);
  vec3 cream = vec3(0.965, 0.906, 0.690);
  vec3 gold = vec3(0.910, 0.761, 0.290);
  vec3 cool = vec3(0.925, 0.933, 0.949);

  // gold biases toward the left (where the copy sits), cool toward bottom-right
  vec3 col = mix(ivory, cream, smoothstep(0.20, 0.72, m));
  col = mix(col, gold, smoothstep(0.55, 0.98, m) * (1.0 - uv.x * 0.45));
  col = mix(col, cool, smoothstep(0.18, 0.0, m) * (0.35 + uv.x * 0.4));
  fragColor = vec4(col, 1.0);
}`

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("hero-gradient shader:", gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function HeroGradient() {
  const reduce = usePrefersReducedMotion()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (reduce) return
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false })
    if (!gl) return // no WebGL2 -> CSS fallback gradient shows

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("hero-gradient link:", gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    // one full-screen triangle (covers clip space)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "position")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, "u_resolution")
    const uTime = gl.getUniformLocation(prog, "u_time")

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [reduce])

  if (reduce) return null
  return <canvas ref={ref} className="vl-hero-canvas" aria-hidden />
}

"use client";

import { useEffect, useRef } from "react";
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Fragment shader Aurora bernuansa gelap-emas-teal khas Bakafrawi (berjalan mulus di GPU via OGL)
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(
    0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  vec3 rampColor;
  if (uv.x < 0.5) {
    rampColor = mix(uColorStops[0], uColorStops[1], uv.x * 2.0);
  } else {
    rampColor = mix(uColorStops[1], uColorStops[2], (uv.x - 0.5) * 2.0);
  }

  float height = snoise(vec2(uv.x * 1.8 + uTime * 0.12, uTime * 0.22)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.25);
  float intensity = 0.55 * height;

  float midPoint = 0.22;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

/**
 * Latar belakang WebGL Aurora Shader (ala React Bits) menggunakan OGL.
 * Mengalir halus di GPU dengan palet Teal → Emas → Biru-Gelap khas Bakafrawi.
 */
export function AuroraBg({
  warna = ["#18b4a8", "#c9a24b", "#142634"],
  amplitudo = 1.05,
  blend = 0.6,
  kecepatan = 0.65,
}: {
  warna?: [string, string, string];
  amplitudo?: number;
  blend?: number;
  kecepatan?: number;
}) {
  const wadahRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wadah = wadahRef.current;
    if (!wadah) return;

    // Hormati preferensi aksesibilitas jika pengguna menonaktifkan gerak
    const kurangiGerak = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer: Renderer | null = null;
    let rafId = 0;

    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";

    const stops = warna.map((hex) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitudo },
        uColorStops: { value: stops },
        uResolution: { value: [wadah.offsetWidth, wadah.offsetHeight] },
        uBlend: { value: blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    wadah.appendChild(gl.canvas);

    const resize = () => {
      if (!wadah || !renderer) return;
      const w = wadah.offsetWidth || window.innerWidth;
      const h = wadah.offsetHeight || 600;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    };
    resize();
    window.addEventListener("resize", resize);

    let mulai = performance.now();
    const renderFrame = (now: number) => {
      const detik = (now - mulai) * 0.001 * kecepatan;
      program.uniforms.uTime.value = detik;
      renderer?.render({ scene: mesh });
      if (!kurangiGerak) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };
    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (gl.canvas.parentNode === wadah) {
        wadah.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [warna, amplitudo, blend, kecepatan]);

  return (
    <div
      ref={wadahRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-75 [mask-image:linear-gradient(to_bottom,black_30%,transparent_96%)]"
    />
  );
}

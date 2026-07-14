/* ═══════════════════════════════════════════════════════════════
   LA REJILLA
   ───────────────────────────────────────────────────────────────
   4.160 celdas. Una vida entera: 80 años × 52 semanas.

   No es un fondo. Es el objeto protagonista de la web.
   La cámara la recorre con tu scroll y las celdas reaccionan a tu
   cursor. Cuando mandas un NEXA, una celda se enciende de verdad.

   Estados de una celda:
     0  gastada   — ya la viviste. Apagada. No vuelve.
     1  vacía     — te queda, pero no hay nada dentro. Gris.
     2  encendida — pasó algo. Azul, con luz propia.
     3  ahora     — la semana en la que estás. Late.

   Si no hay WebGL, este módulo no arranca y la web funciona igual:
   todo el contenido está en el HTML.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from "three";

const COLS = 80;          // años
const FILAS = 52;         // semanas
const TOTAL = COLS * FILAS;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const lienzo = document.getElementById("rejilla");
if (!lienzo) throw new Error("sin canvas");

// ── Guardarraíl: si el aparato no puede, ni lo intentamos ──
function puede() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 2) return false;
    return true;
  } catch { return false; }
}

if (!puede() || reduce) {
  document.body.classList.add("sin-3d");
  // El fallback 2D lo pinta script.js. Aquí no hacemos nada más.
} else {
  arrancar();
}

function arrancar() {
  document.body.classList.add("con-3d");

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 400);

  const render = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.setSize(innerWidth, innerHeight);

  /* ─── La geometría: un cuadrado diminuto, 4.160 veces ─── */
  const celda = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = celda.index;
  geo.attributes.position = celda.attributes.position;
  geo.attributes.uv = celda.attributes.uv;

  const offsets = new Float32Array(TOTAL * 3);
  const estados = new Float32Array(TOTAL);
  const semillas = new Float32Array(TOTAL);

  const PASO = 1.35;
  const ANCHO = (COLS - 1) * PASO;
  const ALTO = (FILAS - 1) * PASO;

  for (let i = 0; i < TOTAL; i++) {
    const col = i % COLS;
    const fila = Math.floor(i / COLS);
    offsets[i * 3 + 0] = col * PASO - ANCHO / 2;
    offsets[i * 3 + 1] = -(fila * PASO) + ALTO / 2;
    offsets[i * 3 + 2] = 0;
    estados[i] = 1;
    semillas[i] = Math.random();
  }

  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute("aEstado", new THREE.InstancedBufferAttribute(estados, 1));
  geo.setAttribute("aSemilla", new THREE.InstancedBufferAttribute(semillas, 1));

  /* ─── El shader ───
     El cursor empuja las celdas hacia atrás y las hace crecer.
     Las encendidas flotan hacia delante y laten. */
  const uni = {
    uTiempo: { value: 0 },
    uCursor: { value: new THREE.Vector3(9999, 9999, 0) },
    uRadio: { value: 9.0 },
    uAz: { value: new THREE.Color("#0A5CFF") },
    uGris: { value: new THREE.Color("#C6CBD6") },
    uApagado: { value: new THREE.Color("#EDEFF3") },
    uOpacidad: { value: 1 },
  };

  const mat = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: uni,
    vertexShader: /* glsl */ `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec3 aOffset;
      attribute float aEstado;
      attribute float aSemilla;

      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      uniform float uTiempo;
      uniform vec3 uCursor;
      uniform float uRadio;

      varying float vEstado;
      varying vec2 vUv;
      varying float vCerca;

      void main() {
        vEstado = aEstado;
        vUv = uv;

        vec3 pos = aOffset;

        // Respiración: la rejilla nunca está quieta. Está viva.
        float onda = sin(uTiempo * 0.6 + aOffset.x * 0.08 + aOffset.y * 0.05) * 0.22;
        pos.z += onda * (0.35 + aSemilla * 0.4);

        // El cursor empuja. Cuanto más cerca, más hondo.
        float d = distance(pos.xy, uCursor.xy);
        float f = 1.0 - smoothstep(0.0, uRadio, d);
        vCerca = f;
        pos.z -= f * 3.4;

        // Las encendidas flotan hacia delante y laten.
        float enc = step(1.5, aEstado);
        pos.z += enc * (1.6 + sin(uTiempo * 1.6 + aSemilla * 6.283) * 0.35);

        // Tamaño de la celda
        float escala = 0.62;
        escala += f * 0.5;                                  // crece bajo el cursor
        escala += enc * 0.55;                               // las vividas son mayores
        escala *= 1.0 - step(aEstado, 0.5) * 0.35;          // las gastadas encogen

        vec3 v = position * escala;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + v, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uAz;
      uniform vec3 uGris;
      uniform vec3 uApagado;
      uniform float uOpacidad;
      uniform float uTiempo;

      varying float vEstado;
      varying vec2 vUv;
      varying float vCerca;

      void main() {
        // Celda redonda, con borde suave
        vec2 c = vUv - 0.5;
        float r = length(c);
        float a = 1.0 - smoothstep(0.30, 0.48, r);
        if (a < 0.01) discard;

        vec3 col = uGris;
        float op = 0.55;

        if (vEstado < 0.5) {            // gastada
          col = uApagado;
          op = 0.5;
        } else if (vEstado > 2.5) {     // ahora
          col = uAz;
          op = 0.9 + sin(uTiempo * 3.0) * 0.1;
        } else if (vEstado > 1.5) {     // encendida
          col = uAz;
          op = 1.0;
          // halo
          a += (1.0 - smoothstep(0.30, 0.5, r)) * 0.5;
        }

        // Bajo el cursor todo se tiñe de azul: la rejilla te ve.
        col = mix(col, uAz, vCerca * 0.55);
        op = mix(op, 1.0, vCerca * 0.5);

        gl_FragColor = vec4(col, a * op * uOpacidad);
      }
    `,
  });

  const malla = new THREE.Mesh(geo, mat);
  malla.frustumCulled = false;
  escena.add(malla);

  /* ─── La cámara: una sola toma, de principio a fin ───
     Cada escena es un punto de la trayectoria. El scroll es el
     tiempo de la película. No hay cortes: hay un travelling. */
  const TOMAS = [
    { p: 0.00, pos: [0, 0, 74], mira: [0, 0, 0], fov: 38 },   // 1 · la vida entera
    { p: 0.18, pos: [-8, 4, 40], mira: [-6, 2, 0], fov: 36 }, // 2 · nos acercamos
    { p: 0.34, pos: [-14, 6, 15], mira: [-13, 5, 0], fov: 42 },// 2b · dentro. Semanas idénticas.
    { p: 0.55, pos: [10, -6, 22], mira: [8, -5, 0], fov: 40 },// 3 · el NEXA
    { p: 0.76, pos: [4, 2, 46], mira: [2, 1, 0], fov: 38 },   // 4 · retrocedemos: tu rejilla
    { p: 1.00, pos: [0, 0, 88], mira: [0, 0, 0], fov: 34 },   // 5 · la vida entera, otra vez
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => t * t * (3 - 2 * t);

  const posCam = new THREE.Vector3(0, 0, 74);
  const mirada = new THREE.Vector3(0, 0, 0);
  const objPos = new THREE.Vector3(0, 0, 74);
  const objMira = new THREE.Vector3(0, 0, 0);
  let objFov = 38;

  function toma(p) {
    let a = TOMAS[0], b = TOMAS[TOMAS.length - 1];
    for (let i = 0; i < TOMAS.length - 1; i++) {
      if (p >= TOMAS[i].p && p <= TOMAS[i + 1].p) { a = TOMAS[i]; b = TOMAS[i + 1]; break; }
    }
    const t = suave(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p || 1))));
    objPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    objMira.set(lerp(a.mira[0], b.mira[0], t), lerp(a.mira[1], b.mira[1], t), lerp(a.mira[2], b.mira[2], t));
    objFov = lerp(a.fov, b.fov, t);
  }

  /* ─── Cursor ─── */
  const raton = new THREE.Vector2(0, 0);       // NDC
  const parallax = new THREE.Vector2(0, 0);
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const rayo = new THREE.Raycaster();
  const golpe = new THREE.Vector3();
  let hayRaton = false;

  addEventListener("pointermove", (e) => {
    raton.x = (e.clientX / innerWidth) * 2 - 1;
    raton.y = -(e.clientY / innerHeight) * 2 + 1;
    hayRaton = true;
  }, { passive: true });

  addEventListener("pointerleave", () => (hayRaton = false));

  /* ─── Scroll ─── */
  let progreso = 0, objProg = 0;
  const alScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    objProg = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };
  addEventListener("scroll", alScroll, { passive: true });
  alScroll();

  /* ─── API pública: encender celdas desde el resto de la web ─── */
  const at = geo.attributes.aEstado;

  function apagarPasadas(edad) {
    const gastadas = Math.round(edad * FILAS);
    for (let i = 0; i < TOTAL; i++) {
      const col = i % COLS;
      const fila = Math.floor(i / COLS);
      const orden = col * FILAS + fila;   // recorremos por años
      let e = at.array[i];
      if (e > 1.5) continue;              // no tocamos las encendidas
      if (orden < gastadas - 1) e = 0;
      else if (orden === gastadas - 1) e = 3;
      else e = 1;
      at.array[i] = e;
    }
    at.needsUpdate = true;
  }

  function encender(n = 1) {
    // Encendemos semanas futuras al azar, cerca del presente.
    const libres = [];
    for (let i = 0; i < TOTAL; i++) if (at.array[i] === 1) libres.push(i);
    for (let k = 0; k < n && libres.length; k++) {
      const j = Math.floor(Math.random() * Math.min(libres.length, 260));
      at.array[libres[j]] = 2;
      libres.splice(j, 1);
    }
    at.needsUpdate = true;
  }

  window.REJILLA = {
    apagarPasadas,
    encender,
    quedan: (edad) => TOTAL - Math.round(edad * FILAS),
    total: TOTAL,
  };
  document.dispatchEvent(new Event("rejilla:lista"));

  /* ─── El bucle ─── */
  const reloj = new THREE.Clock();

  function bucle() {
    const t = reloj.getElapsedTime();
    uni.uTiempo.value = t;

    // Scroll suavizado: la cámara nunca da tirones.
    progreso += (objProg - progreso) * 0.075;
    toma(progreso);

    // Parallax del ratón: profundidad de verdad, no un truco 2D.
    parallax.x += (raton.x - parallax.x) * 0.05;
    parallax.y += (raton.y - parallax.y) * 0.05;

    posCam.lerp(objPos, 0.09);
    mirada.lerp(objMira, 0.09);

    camara.position.set(
      posCam.x + parallax.x * 5.5,
      posCam.y + parallax.y * 3.5,
      posCam.z
    );
    camara.lookAt(mirada);
    camara.fov += (objFov - camara.fov) * 0.08;
    camara.updateProjectionMatrix();

    // Dónde está el cursor sobre el plano de la rejilla
    if (hayRaton) {
      rayo.setFromCamera(raton, camara);
      if (rayo.ray.intersectPlane(plano, golpe)) {
        uni.uCursor.value.lerp(golpe, 0.25);
      }
    } else {
      uni.uCursor.value.lerp(new THREE.Vector3(9999, 9999, 0), 0.1);
    }

    render.render(escena, camara);
    requestAnimationFrame(bucle);
  }
  bucle();

  addEventListener("resize", () => {
    camara.aspect = innerWidth / innerHeight;
    camara.updateProjectionMatrix();
    render.setSize(innerWidth, innerHeight);
    render.setPixelRatio(Math.min(devicePixelRatio, 2));
  }, { passive: true });
}

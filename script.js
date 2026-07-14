/* ═══════════════════════════════════════════════════════════════
   NEXA — la capa que toca el usuario

   La Rejilla (rejilla.js) es el objeto. Esto es todo lo demás:
   el cursor, las entradas, el chat, la demo del NEXA, el
   formulario — y el fallback 2D para cuando no hay WebGL.

   Progressive enhancement de verdad: si nada de esto se ejecuta,
   el contenido sigue ahí y se lee.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fino = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const SEMANAS = 52;
const VIDA = 80 * SEMANAS;               // 4.160
const fmt = (n) => n.toLocaleString("es-ES");

/* ─────────────────────────────────────────────
   1. Entradas
   ───────────────────────────────────────────── */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("on");
    io.unobserve(e.target);
  }),
  { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
);
$$(".rise, .titan").forEach((el) => io.observe(el));
$$(".ln").forEach((ln, i) => ln.style.setProperty("--l", i % 5));

requestAnimationFrame(() => {
  $(".esc--1 .titan")?.classList.add("on");
  $$(".esc--1 .rise").forEach((el) => el.classList.add("on"));
  $("#hud")?.classList.add("on");
});

/* ─────────────────────────────────────────────
   2. Cursor
   El puntero deja de ser del sistema y pasa a ser tuyo.
   ───────────────────────────────────────────── */
const cur = $("#cursor");
if (fino && !reduce && cur) {
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;

  addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY;
    cur.classList.add("on");
  }, { passive: true });

  (function seguir() {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    cur.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
    requestAnimationFrame(seguir);
  })();

  // Magnetismo: los elementos tocables tiran del cursor.
  $$(".mag, a, button, input, summary").forEach((el) => {
    el.addEventListener("pointerenter", () => cur.classList.add("tocable"));
    el.addEventListener("pointerleave", () => cur.classList.remove("tocable"));
  });

  $$(".mag").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.16;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
      b.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    b.addEventListener("pointerleave", () => (b.style.transform = ""));
  });
}

/* ─────────────────────────────────────────────
   3. Nav + HUD de semanas
   ───────────────────────────────────────────── */
const nav = $("#nav");
const hudN = $("#hudN");
let last = 0, tick = false;

function frame() {
  const y = scrollY;
  nav.classList.toggle("solido", y > 30);
  nav.classList.toggle("arriba", y > last && y > 700);
  last = y;
  tick = false;
}
addEventListener("scroll", () => { if (!tick) { requestAnimationFrame(frame); tick = true; } }, { passive: true });
frame();

/* ─────────────────────────────────────────────
   4. LA EDAD → apagar semanas
   Es la primera interacción de la web, y ocurre
   en los primeros tres segundos. Es el gancho.
   ───────────────────────────────────────────── */
const edadIn = $("#edad");
const finN = $("#finN");
let encendidasDemo = 0;

function pintarCuenta() {
  const edad = Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));
  const quedan = Math.max(0, VIDA - Math.round(edad * SEMANAS));
  if (hudN) hudN.textContent = fmt(quedan);
  if (finN) finN.textContent = fmt(quedan);
  return edad;
}

function aplicarEdad() {
  const edad = pintarCuenta();
  if (window.REJILLA) window.REJILLA.apagarPasadas(edad);
  if (plano2d) pintar2D(edad);
}

edadIn?.addEventListener("input", aplicarEdad);
document.addEventListener("rejilla:lista", aplicarEdad);

/* ─────────────────────────────────────────────
   5. FALLBACK 2D
   Sin WebGL (o con «reducir movimiento»), la Rejilla
   se dibuja plana. Mismo mensaje, cero coste.
   ───────────────────────────────────────────── */
let plano2d = null;
if (document.body.classList.contains("sin-3d") || !document.getElementById("rejilla")) {
  crear2D();
}
// rejilla.js decide en cuanto carga; puede llegar después.
setTimeout(() => {
  if (document.body.classList.contains("sin-3d") && !plano2d) crear2D();
}, 300);

function crear2D() {
  if (plano2d) return;
  const c = document.createElement("canvas");
  c.id = "plano2d";
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", "Cuadrícula con las 4.160 semanas de una vida. Las ya vividas aparecen apagadas.");
  $(".esc--1 .wrap")?.appendChild(c);
  plano2d = c;
  addEventListener("resize", () => pintar2D(parseInt(edadIn.value, 10) || 20), { passive: true });
  pintar2D(parseInt(edadIn.value, 10) || 20);
}

function pintar2D(edad) {
  if (!plano2d) return;
  const ctx = plano2d.getContext("2d");
  const w = plano2d.parentElement.clientWidth;
  const cols = 80, filas = 52;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const paso = w / cols;
  const h = paso * filas;

  plano2d.width = w * dpr;
  plano2d.height = h * dpr;
  plano2d.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const gastadas = Math.round(edad * filas);
  const r = Math.max(1, paso * 0.2);

  for (let i = 0; i < cols * filas; i++) {
    const col = Math.floor(i / filas);
    const fila = i % filas;
    ctx.beginPath();
    ctx.arc(col * paso + paso / 2, fila * paso + paso / 2, i < gastadas ? r * 0.7 : r, 0, 6.2832);
    ctx.fillStyle = i < gastadas ? "#E9EBEF" : "#C6CBD6";
    if (i === gastadas - 1) ctx.fillStyle = "#0A5CFF";
    ctx.fill();
  }
}

/* ─────────────────────────────────────────────
   6. EL MENSAJE QUE NO ENVÍAS
   Escribes. Le das a enviar. Y se deshace.
   ───────────────────────────────────────────── */
const chatForm = $("#chatForm");
const chatIn = $("#chatIn");
const chatBody = $("#chatBody");
const salida = $("#salida");

const RESPUESTAS = [
  "Se ha ido. Como se van casi todos.",
  "Otra vez. Y no ha pasado nada malo: simplemente, no lo has mandado.",
  "Tres. <strong>No eres tú.</strong> Es que proponer expone, y todo el mundo prefiere que empiece otro. Esa semana se quedará apagada.",
];
let intentos = 0;

chatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = chatIn.value.trim() || chatIn.placeholder;

  const b = document.createElement("div");
  b.className = "burb burb--mio";
  b.textContent = txt;
  chatBody.appendChild(b);
  chatIn.value = "";
  chatIn.blur();

  setTimeout(() => {
    b.classList.add("burb--fuga");
    setTimeout(() => b.remove(), reduce ? 0 : 1500);
  }, reduce ? 150 : 650);

  intentos = Math.min(intentos + 1, RESPUESTAS.length);
  setTimeout(() => {
    salida.innerHTML = RESPUESTAS[intentos - 1];
    salida.classList.add("on");
  }, reduce ? 250 : 1150);
});

/* ─────────────────────────────────────────────
   7. LA DEMO — y aquí se enciende una semana de verdad
   ───────────────────────────────────────────── */
const caja = $("#caja");
if (caja) {
  const pasos = $$(".paso", caja);
  const est = { exp: null, img: null, per: null, por: null };

  const ir = (n) => {
    pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));
    if (n > 1 && !reduce) caja.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  $$(".exp", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".exp", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.exp = b.dataset.exp;
      est.img = b.dataset.img;
      setTimeout(() => ir(2), reduce ? 0 : 240);
    });
  });

  $$(".per", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.per = b.dataset.per;
      est.por = b.dataset.por;
      $("#rPer").textContent = est.per;
      $("#rExp").textContent = est.exp;
      $("#rPor").textContent = est.por;
      setTimeout(() => ir(3), reduce ? 0 : 240);
    });
  });

  $("#enviar")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $("#btnT").textContent = "Enviado";

    setTimeout(() => {
      $("#rPer2").textContent = est.per;
      $("#rPer3").textContent = est.per;
      $("#rExp2").textContent = est.exp;
      const img = $("#rImg");
      img.src = est.img;
      img.alt = est.exp;

      // ── El momento ──
      // Una celda de la Rejilla se enciende. De verdad, en el 3D.
      if (window.REJILLA) window.REJILLA.encender(1);
      encendidasDemo++;

      ir(4);
      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
    }, reduce ? 80 : 850);
  });

  $$("[data-volver]", caja).forEach((b) =>
    b.addEventListener("click", () => ir(+b.dataset.volver))
  );

  $("#otra")?.addEventListener("click", () => {
    $$(".exp, .per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    ir(1);
  });
}

/* ─────────────────────────────────────────────
   8. ESCENA 4: tu rejilla se llena
   Al llegar aquí, encendemos 30 semanas: es la vida
   que tendrías dentro de un año usando NEXA.
   ───────────────────────────────────────────── */
const esc4 = $(".esc--4");
if (esc4) {
  new IntersectionObserver((es, obs) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      if (window.REJILLA) {
        let n = 0;
        const t = setInterval(() => {
          window.REJILLA.encender(1);
          if (++n >= 30) clearInterval(t);
        }, 70);
      }
      obs.disconnect();
    });
  }, { threshold: 0.25 }).observe(esc4);
}

/* ─────────────────────────────────────────────
   9. El tiempo que llevas mirando una pantalla
   ───────────────────────────────────────────── */
const tiempoEl = $("#tiempo");
if (tiempoEl) {
  const t0 = Date.now();
  const pinta = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const txt = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
    let cola = "";
    if (s > 150) cola = " Es lo que tardas en mandar un NEXA.";
    if (s > 400) cola = " Y esta semana sigue apagada.";
    tiempoEl.innerHTML = `Llevas <strong>${txt}</strong> mirando esta pantalla.${cola}`;
  };
  pinta();
  setInterval(pinta, 1000);
}

/* Fotos rotas: nunca se ven rotas. */
$$("img").forEach((img) =>
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const c = img.closest(".exp__f, .recuerdo");
    if (c) c.style.background = "linear-gradient(200deg,#D9DDE4,#8E97A6)";
  })
);

/* ─────────────────────────────────────────────
   10. Lista de espera
   ───────────────────────────────────────────── */
const form = $("#waitlist");
const email = $("#email");
const uni = $("#uni");
const btn = $("#submit");
const err = $("#err");
const ok = $("#ok");
const valido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function fallar(msg) {
  err.textContent = msg;
  err.hidden = false;
  email.setAttribute("aria-invalid", "true");
  email.focus();
}

async function enviar(datos) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar:", datos);
    return true;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLA}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(datos),
  });
  if (res.status === 409) return true;
  if (!res.ok) throw new Error(await res.text());
  return true;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  email.removeAttribute("aria-invalid");
  if (!valido(email.value)) return fallar("Ese email no parece un email.");

  btn.disabled = true;
  btn.textContent = "Un segundo…";
  try {
    await enviar({
      email: email.value.trim().toLowerCase(),
      universidad: uni.value.trim() || null,
      ciudad: "valencia",
    });
    form.hidden = true;
    ok.hidden = false;
    ok.setAttribute("tabindex", "-1");
    ok.focus();
    if (window.REJILLA) window.REJILLA.encender(12);
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = "Enciende la primera";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();
pintarCuenta();

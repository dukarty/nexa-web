/* ═══════════════════════════════════════════════════════════════
   NEXA

   Sin librerías. 60 fps. Progressive enhancement:
   si esto no se ejecuta, el contenido sigue ahí y se lee entero.

     1. LA VIDA DENTRO DEL TITULAR — las fotos incrustadas rotan solas.
     2. La cinta de deseos, rodando sin parar.
     3. Las 4.160 semanas que se apagan con tu edad.
     4. El mensaje que no envías: se deshace en el aire.
     5. Mandas un NEXA → la foto se abre a pantalla completa.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const COLS = 80, FILAS = 52, TOTAL = COLS * FILAS;   // 4.160
const fmt = (n) => n.toLocaleString("es-ES");

/* ═════════════════════════════════════════════
   1 · LA VIDA DENTRO DEL TITULAR
   Dos huecos en la frase. Dentro, la vida, rotando.
   No es un adorno: es literalmente de lo que va NEXA.
   ═════════════════════════════════════════════ */
const VIDA = [
  ["https://images.pexels.com/photos/7148674/pexels-photo-7148674.jpeg?auto=compress&cs=tinysrgb&w=400", "Hoguera en la playa"],
  ["https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400", "Concierto"],
  ["https://images.pexels.com/photos/32876381/pexels-photo-32876381.jpeg?auto=compress&cs=tinysrgb&w=400", "Amanecer en la playa"],
  ["https://images.pexels.com/photos/8482195/pexels-photo-8482195.jpeg?auto=compress&cs=tinysrgb&w=400", "Cima de una montaña"],
  ["https://images.pexels.com/photos/17444987/pexels-photo-17444987.jpeg?auto=compress&cs=tinysrgb&w=400", "Furgoneta frente al mar"],
  ["https://images.pexels.com/photos/5738245/pexels-photo-5738245.jpeg?auto=compress&cs=tinysrgb&w=400", "Cena con amigos"],
  ["https://images.pexels.com/photos/8050356/pexels-photo-8050356.jpeg?auto=compress&cs=tinysrgb&w=400", "Surf al amanecer"],
];

function hueco(el, arranque) {
  // Dos capas: una entra mientras la otra sale. Nunca hay hueco vacío.
  const a = document.createElement("img");
  const b = document.createElement("img");
  a.loading = "eager"; b.loading = "eager";
  a.decoding = "async"; b.decoding = "async";
  el.append(a, b);

  let i = arranque, frente = a, fondo = b;
  const poner = (img, n) => { img.src = VIDA[n][0]; img.alt = VIDA[n][1]; };

  poner(frente, i);
  frente.classList.add("on");

  if (reduce) return;

  setInterval(() => {
    i = (i + 2) % VIDA.length;
    poner(fondo, i);
    fondo.onload = () => {
      fondo.classList.add("on");
      frente.classList.remove("on");
      [frente, fondo] = [fondo, frente];
    };
  }, 2600);
}

const fA = $(".foto--a");
const fB = $(".foto--b");
if (fA) hueco(fA, 0);
if (fB) hueco(fB, 1);

// Cada palabra del titular sale con su propio retardo. Una detrás de otra.
$$(".h1").forEach((h) => $$(".w", h).forEach((w, i) => w.style.setProperty("--d", i)));

/* ═════════════════════════════════════════════
   2 · LA CINTA
   ═════════════════════════════════════════════ */
const cinta = $("#cinta1");
if (cinta && !reduce) {
  cinta.innerHTML += cinta.innerHTML;   // sin costura
  let x = 0;
  (function rueda() {
    const mitad = cinta.scrollWidth / 2;
    x -= 0.55;
    if (x <= -mitad) x += mitad;
    cinta.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    requestAnimationFrame(rueda);
  })();
}

/* ═════════════════════════════════════════════
   Entradas + nav + barra de progreso
   ═════════════════════════════════════════════ */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("on");
    io.unobserve(e.target);
  }),
  { rootMargin: "0px 0px -12% 0px", threshold: 0.2 }
);
$$(".fila, .reveal, .h2").forEach((el) => io.observe(el));

const nav = $("#nav");
const prog = $("#prog");
let last = 0, tick = false;
function frame() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle("oculto", y > last && y > 600);
  last = y;
  tick = false;
}
addEventListener("scroll", () => { if (!tick) { requestAnimationFrame(frame); tick = true; } }, { passive: true });
frame();

/* ═════════════════════════════════════════════
   3 · LAS SEMANAS
   ═════════════════════════════════════════════ */
const lienzo = $("#rejilla");
const edadIn = $("#edad");
const quedanEl = $("#quedan");
const finN = $("#finN");

const estados = new Uint8Array(TOTAL);   // 0 apagada · 1 te queda · 2 encendida · 3 ahora
let gastadas = 0, objetivo = 0, m = null, raf = null;
let raton = { x: -999, y: -999 };
const pos = (i) => ({ col: Math.floor(i / FILAS), fila: i % FILAS });

function medir() {
  const w = lienzo.parentElement.clientWidth;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const paso = w / COLS;
  const h = paso * FILAS;
  lienzo.width = Math.round(w * dpr);
  lienzo.height = Math.round(h * dpr);
  lienzo.style.height = h + "px";
  lienzo.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  return { paso, w, h };
}

function pintar() {
  if (!m) return;
  const ctx = lienzo.getContext("2d");
  ctx.clearRect(0, 0, m.w, m.h);
  const base = Math.max(1, m.paso * 0.21);

  for (let i = 0; i < TOTAL; i++) {
    const { col, fila } = pos(i);
    const x = col * m.paso + m.paso / 2;
    const y = fila * m.paso + m.paso / 2;
    const e = estados[i];

    let r = base;
    if (raton.x > -900) {
      const d = Math.hypot(x - raton.x, y - raton.y);
      r += Math.max(0, 1 - d / (m.paso * 7)) * base * 1.1;
    }

    let color = "#0A0A0A";                      // te queda
    if (e === 0) { color = "#DEDEDE"; r *= 0.72; }  // ya no vuelve
    if (e === 2) { color = "#0A5CFF"; r *= 1.45; }  // encendida
    if (e === 3) { color = "#0A5CFF"; r *= 1.6; }   // esta semana

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

const edad = () => Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));

function cuenta() {
  const q = Math.max(0, TOTAL - Math.round(edad() * FILAS));
  quedanEl.textContent = fmt(q);
  if (finN) finN.textContent = fmt(q);
}

const aplicar = (g) => {
  for (let i = 0; i < TOTAL; i++) {
    if (estados[i] === 2) continue;
    estados[i] = i < g - 1 ? 0 : i === g - 1 ? 3 : 1;
  }
};

function animar() {
  const d = objetivo - gastadas;
  if (Math.abs(d) < 1) { gastadas = objetivo; raf = null; }
  else { gastadas += d * 0.08 + Math.sign(d) * 0.5; raf = requestAnimationFrame(animar); }
  aplicar(Math.round(gastadas));
  pintar();
}

function apagar(animado = true) {
  objetivo = Math.round(edad() * FILAS);
  cuenta();
  if (!animado || reduce) { gastadas = objetivo; aplicar(Math.round(gastadas)); pintar(); return; }
  if (!raf) raf = requestAnimationFrame(animar);
}

function encender(n = 1) {
  const libres = [];
  for (let i = 0; i < TOTAL; i++) if (estados[i] === 1) libres.push(i);
  for (let k = 0; k < n && libres.length; k++) {
    const j = Math.floor(Math.random() * Math.min(libres.length, 120));
    estados[libres[j]] = 2;
    libres.splice(j, 1);
  }
  pintar();
}

if (lienzo && edadIn) {
  m = medir();
  estados.fill(1);
  apagar(false);
  edadIn.addEventListener("input", () => apagar(true));

  if (!reduce) {
    lienzo.addEventListener("pointermove", (e) => {
      const r = lienzo.getBoundingClientRect();
      raton = { x: e.clientX - r.left, y: e.clientY - r.top };
      pintar();
    }, { passive: true });
    lienzo.addEventListener("pointerleave", () => { raton = { x: -999, y: -999 }; pintar(); });
  }
  addEventListener("resize", () => { m = medir(); pintar(); }, { passive: true });

  new IntersectionObserver((es, obs) => {
    es.forEach((e) => { if (e.isIntersecting) { apagar(true); obs.disconnect(); } });
  }, { threshold: 0.2 }).observe($("#semanas"));
}

/* ═════════════════════════════════════════════
   4 · EL MENSAJE QUE NO ENVÍAS
   ═════════════════════════════════════════════ */
const chatForm = $("#chatForm");
const chatIn = $("#chatIn");
const chatBody = $("#chatBody");
const salida = $("#salida");

const RESPUESTAS = [
  "Se ha ido. Como se van casi todos.",
  "Otra vez. Y no ha pasado nada: simplemente, no lo has mandado.",
  "Tres. <strong>No eres tú.</strong> Es que proponer expone, y todo el mundo prefiere que empiece otro.",
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
    setTimeout(() => b.remove(), reduce ? 0 : 1400);
  }, reduce ? 150 : 600);

  intentos = Math.min(intentos + 1, RESPUESTAS.length);
  setTimeout(() => (salida.innerHTML = RESPUESTAS[intentos - 1]), reduce ? 250 : 1100);
});

/* ═════════════════════════════════════════════
   5 · UN NEXA  ·  EL MOMENTO
   ═════════════════════════════════════════════ */
const caja = $("#caja");
const momento = $("#momento");

if (caja) {
  const pasos = $$(".paso", caja);
  const est = { exp: null, img: null, per: null, por: null };
  const ir = (n) => pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));

  $$(".exp", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".exp", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.exp = b.dataset.exp;
      est.img = b.dataset.img;
      setTimeout(() => ir(2), reduce ? 0 : 220);
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
      setTimeout(() => ir(3), reduce ? 0 : 220);
    });
  });

  $("#enviar")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $("#btnT").textContent = "Enviado";
    setTimeout(() => {
      $("#momImg").src = est.img;
      $("#momImg").alt = est.exp;
      $("#momT").textContent = est.exp;
      $("#momS").textContent = `con ${est.per} · el sábado que viene`;
      momento.hidden = false;
      document.body.classList.add("bloq");
      $("#cerrarMom").focus();
      encender(1);
      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
      ir(1);
      $$(".exp, .per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    }, reduce ? 80 : 650);
  });

  $$("[data-volver]", caja).forEach((b) => b.addEventListener("click", () => ir(+b.dataset.volver)));
}

function cerrarMomento() {
  momento.hidden = true;
  document.body.classList.remove("bloq");
  $("#nexa")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}
$("#cerrarMom")?.addEventListener("click", cerrarMomento);
addEventListener("keydown", (e) => { if (e.key === "Escape" && momento && !momento.hidden) cerrarMomento(); });

/* Las fotos nunca se ven rotas. */
$$("img").forEach((img) =>
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const c = img.closest(".exp, .mz, .foto");
    if (c) c.style.background = "#DEDEDE";
  })
);

/* ═════════════════════════════════════════════
   Lista de espera
   ═════════════════════════════════════════════ */
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

async function enviarLista(datos) {
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
  btn.querySelector("span").textContent = "Un segundo…";
  try {
    await enviarLista({
      email: email.value.trim().toLowerCase(),
      universidad: uni.value.trim() || null,
      ciudad: "valencia",
    });
    form.hidden = true;
    ok.hidden = false;
    ok.setAttribute("tabindex", "-1");
    ok.focus();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.querySelector("span").textContent = "Enciende la primera";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();

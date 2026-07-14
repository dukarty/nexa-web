/* ═══════════════════════════════════════════════════════════════
   NEXA

   Cero librerías.

   Regla única: nada se mueve solo. Solo el tiempo.
   Todo lo demás se mueve porque tú scrolleas o porque tú tocas.

   Y ninguna imagen aparece antes de que actúes.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const fmt = (n) => n.toLocaleString("es-ES");

/* Cuánto has recorrido de una escena alta con el contenido pegado. */
function prog(sec) {
  const r = sec.getBoundingClientRect();
  const rec = r.height - innerHeight;
  return rec <= 0 ? 0 : clamp(-r.top / rec);
}

/* ═════════════════════════════════════════════
   01 · EL BUCLE
   Domingo 23:47. Bajas: la semana entera se va.
   Y al final del scroll son las 23:47 de otro domingo.
   ═════════════════════════════════════════════ */
const secBucle = $("#bucle");
const elDia = $("#dia"), elHora = $("#hora");
const frA = $("#frA"), frB = $("#frB"), baja = $("#baja");

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const T0 = 23 * 60 + 47;
const SEMANA = 7 * 1440;

function bucle(p) {
  const t = T0 + p * SEMANA;
  const min = Math.floor(t) % 1440;
  elDia.textContent = DIAS[Math.floor(t / 1440) % 7];
  elHora.textContent =
    String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

  // Frase al principio. Silencio en medio. La misma frase al final.
  frA.style.opacity = clamp(p < 0.14 ? 1 : p > 0.78 ? (p - 0.78) / 0.12 : 0);
  frB.style.opacity = clamp(p > 0.9 ? (p - 0.9) / 0.07 : 0);
  baja.style.opacity = clamp(1 - p * 7);
}

/* ═════════════════════════════════════════════
   02 · LOS SEIS
   ═════════════════════════════════════════════ */
const SEIS = ["Marta", "Iván", "Nuria", "Dani", "Clara", "Hugo"];

const NOMBRES = ("Lucía Pablo Alba Sergio Carla Jorge Paula Álvaro Andrea Marc "
  + "Elena Rubén Sara Adrián Laura Víctor Irene Diego Cristina Javier Nerea Raúl Ana Guillermo "
  + "Julia Óscar Rocío Manuel Silvia Aitor Patricia Fernando Miriam Gonzalo Eva Ignacio Noelia "
  + "Alejandro Marina Rodrigo Lidia Samuel Beatriz Emilio Celia Tomás Ainhoa Bruno Alicia Martín "
  + "Vega Nacho Berta Íker Olivia Gabriel Ángela Mario Teresa Enzo Amaia Luis Inés Aarón Daniela "
  + "Héctor Naia Borja Rebeca Unai Sofía Cristian Blanca Joel Valeria Xavi Lorena Arnau Claudia "
  + "Aurora Pau Vera Kevin Jimena Roberto Ariadna Sandra Emma Álex Nadia Simón Leire Gerard Nora "
  + "Ismael Candela Rafa Lola Erik Miguel Alma Fran Greta Toni Chloe Bea Aleix Zoe Nil Ruth Yaiza "
  + "Denis Carmen Pol Ada Israel Mireia Saúl Lara Cayetana Nico Ainara Ariel Elsa Omar Abril Salva "
  + "Nayara Roger Aitana Cesc Alana Iago Ona Bosco Jana Enrique").split(" ");

// Los seis van sueltos por el medio. Juntos al principio se vería venir el golpe.
[13, 36, 57, 78, 100, 123].forEach((i, k) => NOMBRES.splice(i, 0, SEIS[k]));

const secSeis = $("#seis");
const cajaN = $("#nombres");
const agT1 = $("#agT1"), agT2 = $("#agT2"), agP = $("#agP");
let spans = [];

if (cajaN) {
  const frag = document.createDocumentFragment();
  const usados = new Set();
  NOMBRES.forEach((n) => {
    const s = document.createElement("span");
    s.textContent = n;
    if (SEIS.includes(n) && !usados.has(n)) { s.classList.add("vivo"); usados.add(n); }
    frag.appendChild(s);
  });
  cajaN.appendChild(frag);
  spans = $$("span", cajaN);
  // Orden de apagado aleatorio pero fijo: si cambiara, parpadearía al scrollear.
  spans.forEach((s) => (s.dataset.o = Math.random().toFixed(4)));
}

function seis(p) {
  const q = clamp((p - 0.14) / 0.62);
  spans.forEach((s) => {
    if (s.classList.contains("vivo")) {
      s.classList.toggle("destaca", q > 0.5);
      return;
    }
    s.style.opacity = +s.dataset.o < q ? 0 : 1;
  });
  const t = clamp((p - 0.7) / 0.14);
  agT1.style.opacity = 1 - t;
  agT2.style.opacity = t;
  agP.style.opacity = clamp((p - 0.86) / 0.1);
}

/* ═════════════════════════════════════════════
   05 · LA VUELTA A CASA
   Cerrada hasta que mandas un NEXA. Entonces se abre,
   y las fotos van pasando con el scroll: tú eres el que rebobina.
   ═════════════════════════════════════════════ */
const secVuelta = $("#vuelta");
const fotos = $$(".fot");
const vueltaPie = $("#vueltaPie");
let abierta = false;

function abrirVuelta() {
  if (abierta) return;
  abierta = true;
  secVuelta.classList.add("abierta");
  vueltaPie.hidden = false;
  if (fotos[0]) fotos[0].style.opacity = 1;
}

function vuelta(p) {
  if (!abierta || !fotos.length) return;
  // Fundido cruzado atado al scroll. Nada avanza por su cuenta.
  const n = fotos.length;
  const x = clamp(p) * (n - 1);
  fotos.forEach((f, i) => {
    f.style.opacity = clamp(1 - Math.abs(x - i));
  });
}

$("#irGesto")?.addEventListener("click", () => {
  $("#gesto").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
});

/* ═════════════════════════════════════════════
   Bucle de scroll — el único motor de la página
   ═════════════════════════════════════════════ */
const nav = $("#nav");
const barra = $("#prog");
let ultimo = 0, pendiente = false;

function marco() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  barra.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle("oculto", y > ultimo && y > 700);
  ultimo = y;

  if (secBucle) bucle(prog(secBucle));
  if (secSeis && spans.length) seis(prog(secSeis));
  if (secVuelta) vuelta(prog(secVuelta));

  // El negro dura lo que dura el domingo. Y vuelve en la vuelta a casa.
  const b = secBucle.getBoundingClientRect();
  const v = secVuelta.getBoundingClientRect();
  const enNegro = b.bottom > innerHeight * 0.5 ||
                  (v.top < innerHeight * 0.5 && v.bottom > innerHeight * 0.5);
  document.body.classList.toggle("oscuro", enNegro);

  pendiente = false;
}

if (!reduce) {
  addEventListener("scroll", () => { if (!pendiente) { requestAnimationFrame(marco); pendiente = true; } }, { passive: true });
  addEventListener("resize", marco, { passive: true });
  marco();
} else {
  document.body.classList.remove("oscuro");
}

/* ═════════════════════════════════════════════
   03 · LO QUE NO HAS PEDIDO
   Lo que escribes aquí te acompaña hasta el final.
   ═════════════════════════════════════════════ */
const dForm = $("#deseoForm");
const dIn = $("#deseoIn");
const tuyo = $("#tuyo"), tuyoT = $("#tuyoT"), pista = $("#pista");
const formK = $("#formK"), formDeseo = $("#formDeseo");
let DESEO = "";

dForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  DESEO = (dIn.value.trim() || dIn.placeholder).slice(0, 52);
  tuyoT.textContent = DESEO;
  tuyo.hidden = false;
  pista.style.opacity = "0";
  formDeseo.textContent = DESEO;
  formK.hidden = false;
  dIn.blur();
  if (!reduce) tuyo.scrollIntoView({ behavior: "smooth", block: "center" });
});

/* ═════════════════════════════════════════════
   06 · LAS SEMANAS
   80 años × 52 semanas = 4.160 puntos.
   ═════════════════════════════════════════════ */
const COLS = 80, FILAS = 52, TOTAL = COLS * FILAS;
const lienzo = $("#rejilla");
const edadIn = $("#edad");
const quedanEl = $("#quedan");

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

    let color = "#0A0A0A";
    if (e === 0) { color = "#DEDEDE"; r *= 0.72; }
    if (e === 2) { color = "#0A5CFF"; r *= 1.45; }
    if (e === 3) { color = "#0A5CFF"; r *= 1.6; }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

const edad = () => Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));
const cuenta = () => (quedanEl.textContent = fmt(Math.max(0, TOTAL - Math.round(edad() * FILAS))));

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
  }, { threshold: 0.15 }).observe($("#semanas"));
}

/* ═════════════════════════════════════════════
   04 · EL GESTO  ·  EL MOMENTO
   ═════════════════════════════════════════════ */
const caja = $("#caja");
const momento = $("#momento");

if (caja) {
  const pasos = $$(".paso", caja);
  const est = {};
  const ir = (n) => pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));
  const marcar = (grupo, b) => {
    $$(".op", grupo).forEach((o) => o.setAttribute("aria-checked", "false"));
    b.setAttribute("aria-checked", "true");
  };

  $$('.paso[data-paso="1"] .op', caja).forEach((b) => b.addEventListener("click", () => {
    marcar(b.parentElement, b);
    est.exp = b.dataset.exp;
    est.img = b.dataset.img;
    new Image().src = est.img;                 // la foto se precarga, pero no se enseña
    setTimeout(() => ir(2), reduce ? 0 : 200);
  }));

  $$('.paso[data-paso="2"] .op', caja).forEach((b) => b.addEventListener("click", () => {
    marcar(b.parentElement, b);
    est.per = b.dataset.per;
    est.por = b.dataset.por;
    $("#rPer").textContent = est.per;
    $("#rExp").textContent = est.exp;
    $("#rPor").textContent = est.por;
    setTimeout(() => ir(3), reduce ? 0 : 200);
  }));

  $$("[data-volver]", caja).forEach((b) =>
    b.addEventListener("click", () => ir(+b.dataset.volver)));

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

      encender(1);      // una semana tuya deja de estar apagada
      abrirVuelta();    // y la vuelta a casa se enciende

      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
      ir(1);
      $$(".op", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    }, reduce ? 80 : 620);
  });
}

function cerrarMomento() {
  momento.hidden = true;
  document.body.classList.remove("bloq");
  secVuelta.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
$("#cerrarMom")?.addEventListener("click", cerrarMomento);
addEventListener("keydown", (e) => { if (e.key === "Escape" && momento && !momento.hidden) cerrarMomento(); });

/* Una foto rota no se ve nunca. */
$$("img").forEach((img) => img.addEventListener("error", () => (img.style.visibility = "hidden")));

/* ═════════════════════════════════════════════
   07 · ENTRAR
   ═════════════════════════════════════════════ */
const form = $("#waitlist");
const email = $("#email");
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

const post = (datos) => fetch(`${SUPABASE_URL}/rest/v1/${TABLA}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: "return=minimal",
  },
  body: JSON.stringify(datos),
});

async function enviarLista(base) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar:", base);
    return true;
  }
  // Guardamos también el deseo. Si la columna todavía no existe en la tabla,
  // no perdemos el email por eso: reintentamos sin ella.
  let res = await post(DESEO ? { ...base, deseo: DESEO } : base);
  if (res.status === 400 && DESEO) res = await post(base);
  if (res.status === 409) return true;             // ya estaba dentro
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
    await enviarLista({ email: email.value.trim().toLowerCase(), ciudad: "valencia" });
    form.hidden = true;
    ok.hidden = false;
    ok.setAttribute("tabindex", "-1");
    ok.focus();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.querySelector("span").textContent = "Entrar";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();

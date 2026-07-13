/* ═══════════════════════════════════════════════════
   NEXA — movimiento y lista de espera
   Sin dependencias. Sin tracking.
   ═══════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   1. Configuración → está en config.js
   ───────────────────────────────────────────── */
const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────────────────────────────────────────
   2. Titulares que suben palabra a palabra
   ───────────────────────────────────────────── */
document.querySelectorAll("[data-split]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  words.forEach((w, i) => {
    const outer = document.createElement("span");
    outer.className = "w";
    outer.style.setProperty("--w", i);
    const inner = document.createElement("span");
    inner.textContent = w;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
  });
});

/* ─────────────────────────────────────────────
   3. Entradas al hacer scroll
   ───────────────────────────────────────────── */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  },
  { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
);

document.querySelectorAll(".rise, .reveal, [data-split], .nexa__viz").forEach((el) => io.observe(el));

// El hero entra solo, sin esperar al scroll.
requestAnimationFrame(() => {
  document.querySelector(".hero [data-split]")?.classList.add("in");
  document.querySelectorAll(".hero .rise").forEach((el) => el.classList.add("in"));
});

/* ─────────────────────────────────────────────
   4. Parallax + barra de progreso
   ───────────────────────────────────────────── */
const layers = [...document.querySelectorAll("[data-parallax]")];
const bar = document.getElementById("progress");
const nav = document.getElementById("nav");
let last = 0;
let ticking = false;

function frame() {
  const y = scrollY;
  const vh = innerHeight;

  // progreso
  const max = document.body.scrollHeight - vh;
  bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  // nav
  nav.classList.toggle("is-solid", y > 40);
  nav.classList.toggle("is-up", y > last && y > 500);
  last = y;

  // parallax
  if (!reduce) {
    layers.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const centre = r.top + r.height / 2 - vh / 2;
      const speed = parseFloat(el.dataset.parallax) || 0;
      el.style.transform = `translate3d(0, ${(-centre * speed).toFixed(2)}px, 0)`;
    });
  }
  ticking = false;
}

addEventListener("scroll", () => {
  if (!ticking) { requestAnimationFrame(frame); ticking = true; }
}, { passive: true });
addEventListener("resize", frame, { passive: true });
frame();

/* ─────────────────────────────────────────────
   5. Tira de fotos: movimiento continuo
   ───────────────────────────────────────────── */
if (!reduce) {
  document.querySelectorAll(".tira__row").forEach((row) => {
    const track = row.querySelector(".tira__track");
    // Duplicamos el contenido para que el bucle no tenga costura.
    track.innerHTML += track.innerHTML;

    const dir = parseFloat(row.dataset.dir) || 1;
    const speed = 0.35 * dir;
    let x = dir > 0 ? 0 : -track.scrollWidth / 2;
    let paused = false;

    row.addEventListener("pointerenter", () => (paused = true));
    row.addEventListener("pointerleave", () => (paused = false));

    (function tick() {
      if (!paused) {
        const half = track.scrollWidth / 2;
        x -= speed;
        if (dir > 0 && x <= -half) x += half;
        if (dir < 0 && x >= 0) x -= half;
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      }
      requestAnimationFrame(tick);
    })();
  });
}

/* ─────────────────────────────────────────────
   6. Botones magnéticos
   ───────────────────────────────────────────── */
if (!reduce && matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".btn--mag").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      b.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    b.addEventListener("pointerleave", () => (b.style.transform = ""));
  });
}

/* ─────────────────────────────────────────────
   7. Si una foto no carga, no se ve rota
   ───────────────────────────────────────────── */
document.querySelectorAll("img").forEach((img) => {
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const box = img.closest(".strip, .card__f, .g9__c, .hist, .hero__media, .cierre__media");
    if (box) box.style.background = "linear-gradient(200deg,#D9DDE4,#8E97A6)";
  });
});

/* ─────────────────────────────────────────────
   8. Lista de espera
   ───────────────────────────────────────────── */
const form = document.getElementById("waitlist");
const email = document.getElementById("email");
const uni = document.getElementById("uni");
const btn = document.getElementById("submit");
const err = document.getElementById("err");
const ok = document.getElementById("ok");

const valido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function fallar(msg) {
  err.textContent = msg;
  err.hidden = false;
  email.setAttribute("aria-invalid", "true");
  email.focus();
}

async function enviar(datos) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar. Datos capturados:", datos);
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
  if (res.status === 409) return true; // ya estaba dentro
  if (!res.ok) throw new Error(await res.text());
  return true;
}

form.addEventListener("submit", async (e) => {
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
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = "Entrar en la lista";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

document.getElementById("y").textContent = new Date().getFullYear();

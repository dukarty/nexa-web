/* NEXA · Empresas — configuración del modo REAL (Supabase).
 * Solo lleva claves PÚBLICAS (URL + publishable key). Nada secreto aquí.
 * Con este archivo cargado, panel.html y empresas.html usan Supabase de verdad.
 * Proyecto: nexa-produccion — la MISMA base que la app (unificación). Las empresas
 * viven en la tabla `businesses` de la app, junto a los usuarios reales. */
window.NEXA_EMPRESAS_CONFIG = {
  supabaseUrl: "https://vjpgyxwhobshwaotmwzf.supabase.co",
  supabaseAnonKey: "sb_publishable_rmJ7LK0fhSZTJsOUUzOZ3A_bnY-bQ9-",
};

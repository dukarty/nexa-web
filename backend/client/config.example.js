/* Copia a config.js e inclúyelo ANTES de nexa-empresas.js en panel.html y
 * empresas.html para activar el MODO REAL. Sin este archivo, todo sigue en
 * modo mock (localStorage) y el panel funciona igual que la demo.
 * Solo va la clave ANÓNIMA (pública). La service_role NUNCA aquí. */
window.NEXA_EMPRESAS_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabaseAnonKey: "eyJ...", // anon key (pública)
};

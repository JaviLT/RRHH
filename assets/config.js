/* ============================================================
   Portal RRHH — Configuración de conexión
   ------------------------------------------------------------
   `supabaseKey` es la llave PÚBLICA (publishable/anon). Está diseñada
   para ir en el navegador — no es un secreto. La seguridad real la da
   RLS (Row Level Security) en cada tabla, no ocultar esta llave.
   La llave `service_role` NUNCA debe aparecer en ningún archivo de
   este proyecto — esa sí ignora todas las protecciones de la base.

   ============================================================ */
(function (global) {
  'use strict';
  global.ZX_CONFIG = {
    supabaseUrl: 'https://wqecddqbijyiqwsvlubl.supabase.co',
    supabaseKey: 'sb_publishable_kT0laGTlS_NZRnIEpV3DwA_zoDqUG22'
  };
})(window);

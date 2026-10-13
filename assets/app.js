/* ============================================================
   Portal RRHH — Shell común (sesión, permisos, UI)
   Se carga en TODAS las páginas del portal.
   ============================================================ */
(function (global) {
  'use strict';

  const API = global.ZX_API;
  const VERSION = '2.9.0';

  /* ---------------- Tipografía de marca ----------------
     El manual de marca pide Poppins con fallback a Segoe UI. Cargarla con un
     <link> en el <head> BLOQUEA el renderizado: si la red de planta filtra o
     ralentiza fonts.googleapis.com, la pantalla se queda en blanco esperando.
     Por eso se inyecta después de pintar y con tiempo límite: si no llega,
     la app se ve con Segoe UI y nadie se queda esperando. */
  (function cargarTipografia() {
    try {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap';
      l.media = 'print';                       // no bloquea el primer render
      const corte = setTimeout(() => { l.remove(); }, 2500);
      l.onload = () => { clearTimeout(corte); l.media = 'all'; };
      l.onerror = () => { clearTimeout(corte); l.remove(); };
      (document.head || document.documentElement).appendChild(l);
    } catch (e) { /* sin tipografía de marca: se usa el fallback del CSS */ }
  })();

  /* ---------------- Módulos y permisos ----------------
     Espejo de la configuración del servidor. Sirve para no mostrar
     lo que el usuario no puede usar; el servidor debe volver a
     validarlo en cada petición. */
  const MODULOS = [
    { id: 'inicio',     nombre: 'Inicio',            ico: '⌂', url: 'index.html',       roles: '*' },

    /* Reactivado. Llevaba meses desactivado (activo: false); si algo se ve
       raro aquí, es lo primero a revisar — no se volvió a probar hasta ahora.
       Universal: todos tienen esto, sin importar nivel ni perfil. */
    { id: 'vacaciones', activo: false, nombre: 'Vacaciones y horas', ico: '🌴', url: 'vacaciones.html', roles: '*',
      desc: 'Solicita vacaciones y banco de horas, consulta tu saldo y tus solicitudes.' },

    /* El calendario no es una sección del menú: se abre desde la barra superior.
       `oculto` lo deja fuera del menú lateral, de "Tus secciones" y de la matriz de permisos. */
    { id: 'calendario', activo: false, nombre: 'Calendario',        ico: '📆', url: 'calendario.html', roles: '*', oculto: true },

    { id: 'medico', grupo: 'clinico',     nombre: 'Servicio médico',   ico: '🩺', url: 'medico.html',     roles: '*',
      desc: 'Tu historia clínica, tu expediente ocupacional y tus citas con el médico de empresa.' },
    { id: 'cuenta', nombre: 'Mi cuenta', ico: '👤', url: 'cuenta.html', roles: '*', oculto: true, desc: 'Contraseña y verificación en dos pasos.' },
    /* Doctor: el espacio de trabajo del médico (pacientes, agenda y consultas). Sin roles fijos: lo da
       el perfil que lo traiga entre sus módulos (Salud Ocupacional). Servicio médico queda para los empleados. */
    { id: 'doctor', grupo: 'clinico',     nombre: 'Doctor',            ico: '👨‍⚕️', url: 'doctor.html',
      desc: 'Tus pacientes, la agenda del médico y el registro de consultas.' },
    /* Perfil-gated: sólo quien tenga un perfil con 'analisis' entre sus
       módulos (tabla perfiles de la base de datos). Sin roles fijos aquí — se
       resuelve en vivo contra el store, por eso Administración puede
       crear perfiles nuevos y dárselo sin tocar este archivo. */
    { id: 'analisis', grupo: 'clinico',   nombre: 'Análisis clínicos', ico: '🧪', url: 'analisis.html',
      desc: 'Etapa 1 · SQF: resultados de los análisis anuales, desviaciones y seguimiento médico hasta el alta.' },
    /* Aptitud es el único módulo con DOS caminos de acceso: por perfil
       (medico/vigilancia → planta completa) o por nivel (nivelExtra:
       'jefe' → sólo el equipo propio). Ver puede() y soloEquipo en
       page-aptitud.js. */
    { id: 'aptitud', grupo: 'clinico',    nombre: 'Aptitud y restricciones', ico: '🦺', url: 'aptitud.html', nivelExtra: 'jefe',
      desc: 'Aptitud laboral, restricciones y recomendaciones por puesto. Sin información clínica.' },
    { id: 'indicadores', activo: false, nombre: 'Indicadores',      ico: '📈', url: 'indicadores.html',
      desc: 'Tablero de salud ocupacional con datos agregados, sin datos clínicos individuales.' },
    { id: 'rrhh', activo: false,       nombre: 'Recursos Humanos',  ico: '🗂️', url: 'rrhh.html',
      desc: 'Movimientos RHF-34, maestro de colaboradores y expediente documental.' },
    { id: 'admin',      nombre: 'Administración',    ico: '⚙️', url: 'admin.html',
      desc: 'Usuarios, perfiles y permisos de acceso, y bitácora de auditoría del sistema.' },

    /* Nuevo (aprendido en Medico ZX): aviso de privacidad con consentimiento
       versionado y solicitudes ARCO. roles:'*' porque todos deben poder
       leerlo, otorgar/revocar su consentimiento y ejercer sus derechos;
       el panel de "quién consintió" dentro de la misma página se muestra
       sólo a medico/admin (ver page-privacidad.js). */
    { id: 'privacidad', nombre: 'Aviso de privacidad', ico: '🔒', url: 'privacidad.html', roles: '*',
      desc: 'Consulta el aviso de privacidad, otorga o revoca tu consentimiento y ejerce tus derechos ARCO.' }
  ];

  /* Módulos agrupados en el menú: el grupo aparece si la persona tiene al menos uno de sus sub-módulos
     (con uno solo, ese sub-módulo se muestra directo). Cada sub-módulo conserva su página y su permiso. */
  const GRUPOS = {
    clinico: { nombre: 'Expediente Clínico y Salud Ocupacional', ico: '🩺',
               desc: 'Historia clínica, expediente, citas, análisis clínicos y aptitud de salud ocupacional.' }
  };

  const moduloActivo = (m) => m && m.activo !== false;

  /* `persona` es cualquier objeto con .nivel y .perfil — la sesión, o un
     empleado tomado de la lista. Antes recibía sólo un string de rol;
     ahora resuelve el perfil en vivo contra el store (perfilesSync), por
     eso un perfil creado desde Administración funciona sin tocar código. */
  function puede(persona, moduloId) {
    const m = MODULOS.find(x => x.id === moduloId);
    if (!m || !moduloActivo(m) || !persona) return false;
    if (m.roles === '*') return true;
    if (m.nivelExtra && persona.nivel === m.nivelExtra) return true;
    const perfiles = (global.ZX_API && global.ZX_API.perfilesSync) ? global.ZX_API.perfilesSync() : [];
    const p = perfiles.find(x => x.id === persona.perfil);
    return !!(p && p.modulos.indexOf(moduloId) >= 0);
  }
  /* Módulos visibles en menús y matrices */
  const modulosVisibles = () => MODULOS.filter(m => moduloActivo(m) && !m.oculto);

  const NIVEL_NOMBRE = (nivel) => (global.ZX_CAT && ZX_CAT.NIVELES[nivel] ? ZX_CAT.NIVELES[nivel].nombre : nivel);
  const PERFIL_NOMBRE = (perfilId) => {
    const perfiles = (global.ZX_API && global.ZX_API.perfilesSync) ? global.ZX_API.perfilesSync() : [];
    const p = perfiles.find(x => x.id === perfilId);
    return p ? p.nombre : perfilId;
  };
  const ACCESO_TEXTO = (persona) => {
    const n = NIVEL_NOMBRE(persona.nivel);
    return (persona.perfil && persona.perfil !== 'ninguno') ? n + ' · ' + PERFIL_NOMBRE(persona.perfil) : n;
  };
  const esAprobador = (persona) => (persona || {}).nivel === 'jefe';
  const esClinico = (persona) => (persona || {}).perfil === 'medico';
  const esRRHH = (persona) => (persona || {}).perfil === 'rrhh';
  const esVigilancia = (persona) => (persona || {}).perfil === 'vigilancia';
  const esAdmin = (persona) => (persona || {}).perfil === 'admin';

  /* La sesión que usa la interfaz. (Antes admitía una «vista previa por tipo de usuario»; se retiró.) */
  function sesionEfectiva() { return API.sesionActual(); }

  /* Nota de conservación documental — se muestra donde hay documentos o bajas.
     Las dos normas conviven con plazos distintos; la política definitiva la
     fijan Salud Ocupacional y Jurídico. */
  function notaConservacion() {
    const c = (global.ZX_CAT && ZX_CAT.conservacion) || {};
    return '<div class="priv" style="align-items:flex-start">📚 <div>' +
      '<b>Conservación del expediente — dos normas que conviven.</b><br>' +
      '<b>1) Expediente clínico:</b> ' + esc(c.clinico || '') + '<br>' +
      '<b>2) Documentación laboral:</b> ' + esc(c.laboral || '') + '<br>' +
      esc(c.nota || '') + '</div></div>';
  }

  /* ---------------- Utilidades ---------------- */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const hoyISO = () => iso(new Date());   // fecha local; toISOString() daba la de UTC
  /* Acepta fecha ('2026-05-22') o fecha-hora con zona ('2026-05-22T19:43:00+00:00',
     como devuelve la base en columnas timestamptz); esta última se muestra en hora local. */
  function parse(iso) {
    if (!iso) return null;
    return iso.length > 10 ? new Date(iso) : new Date(iso + 'T12:00:00');
  }
  /* Formato único de fecha en todo el portal: 02-OCT-2026 */
  const MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const dos = n => String(n).padStart(2, '0');
  function fmt(iso) {
    const d = parse(iso); if (!d || isNaN(d)) return '—';
    return dos(d.getDate()) + '-' + MES3[d.getMonth()] + '-' + d.getFullYear();
  }
  /* Fecha y hora (en hora local): 02-OCT-2026 13:43 */
  function fmtDT(ts) {
    const d = ts ? new Date(ts) : null; if (!d || isNaN(d)) return '—';
    return fmt(ts) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
  }
  function fmtLargo(iso) {
    const d = parse(iso); if (!d || isNaN(d)) return '—';
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sumaDias(isoStr, n) { const d = parse(isoStr); d.setDate(d.getDate() + n); return iso(d); }
  function diffDias(a, b) { return Math.round((parse(b) - parse(a)) / 86400000) + 1; }
  function antiguedad(ingreso) {
    const d = parse(ingreso); if (!d) return 0;
    const h = new Date();
    let a = h.getFullYear() - d.getFullYear();
    if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) a--;
    return Math.max(0, a);
  }
  function edad(nac) { return antiguedad(nac); }
  function iniciales(nombre) {
    return String(nombre || '').replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  }
  function imc(pesoKg, estaturaCm) {
    if (!pesoKg || !estaturaCm) return null;
    return +(pesoKg / Math.pow(estaturaCm / 100, 2)).toFixed(1);
  }

  /* ---------------- Enlaces directos (#algo) ----------------
     La barra superior y las tarjetas del inicio abren formularios con enlaces como
     vacaciones.html#solicitar-vacaciones. `alHash(manejador)` devuelve una función que la
     pantalla llama cuando ya pintó su vista inicial; después sigue escuchando los cambios de
     hash (estando ya en la pantalla). El hash se borra al atenderlo, para que recargar la
     página no vuelva a abrir el formulario. */
  function alHash(manejador) {
    const atender = () => {
      const h = (location.hash || '').replace(/^#/, '');
      if (!h) return;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      manejador(h);
    };
    global.addEventListener('hashchange', atender);
    return atender;
  }

  /* ---------------- Tema ---------------- */
  function temaInicial() {
    let t = null;
    try { t = localStorage.getItem('zx_tema'); } catch (e) {}
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  function alternarTema() {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('zx_tema', t); } catch (e) {}
  }
  temaInicial();

  /* ---------------- Toasts ---------------- */
  function toast(msg, tipo) {
    let cont = $('.toasts');
    if (!cont) { cont = document.createElement('div'); cont.className = 'toasts'; document.body.appendChild(cont); }
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 3600);
  }

  /* ---------------- Modal ---------------- */
  /* Ventanas abiertas, la última es la de arriba. Por defecto abrir una cierra las demás; con
     opts.encima se apila (la de abajo conserva lo capturado). opts.alCerrar se llama al cerrarla. */
  const pilaModales = [];
  function modal(opts) {
    if (!opts.encima) cerrarTodasLasModales();
    const ovl = document.createElement('div');
    ovl.className = 'ovl';
    ovl.innerHTML =
      '<div class="modal ' + (opts.ancho === 'lg' ? 'lg' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="mo-head"><b>' + esc(opts.titulo) + '</b><button class="mo-x" aria-label="Cerrar">✕</button></div>' +
        '<div class="mo-body"></div>' +
        '<div class="mo-foot"></div>' +
      '</div>';
    const body = $('.mo-body', ovl);
    if (typeof opts.cuerpo === 'string') body.innerHTML = opts.cuerpo;
    else if (opts.cuerpo) body.appendChild(opts.cuerpo);

    const foot = $('.mo-foot', ovl);
    (opts.botones || [{ txt: 'Cerrar', clase: 'gh' }]).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.clase || '');
      btn.textContent = b.txt;
      btn.addEventListener('click', () => {
        if (!b.accion) return cerrarModal();
        const r = b.accion(body, btn);
        if (r && typeof r.then === 'function') { btn.disabled = true; r.finally(() => { btn.disabled = false; }); }
      });
      foot.appendChild(btn);
    });

    $('.mo-x', ovl).addEventListener('click', cerrarModal);
    ovl.addEventListener('mousedown', e => { if (e.target === ovl) cerrarModal(); });
    if (pilaModales.length) ovl.style.zIndex = String(100 + pilaModales.length * 10);
    ovl._alCerrar = opts.alCerrar || null;
    document.body.appendChild(ovl);
    pilaModales.push(ovl);
    const primero = body.querySelector('input,select,textarea,button');
    if (primero) primero.focus();
    return body;
  }
  function cerrarModal() {                       // cierra sólo la de arriba
    const o = pilaModales.pop();
    if (o) { o.remove(); if (typeof o._alCerrar === 'function') { try { o._alCerrar(); } catch (e) { console.error(e); } } }
  }
  function cerrarTodasLasModales() { while (pilaModales.length) cerrarModal(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

  function confirmar(titulo, texto, onOk) {
    modal({
      titulo,
      cuerpo: '<p style="font-size:13.5px;color:var(--tx2)">' + esc(texto) + '</p>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Confirmar', clase: '', accion: () => { cerrarModal(); onOk(); } }
      ]
    });
  }

  /* ---------------- Widget de calendario ---------------- */
  /* opciones: { valor, min, max, rango:bool, deshabilitado:fn(iso), onPick(iso|{inicio,fin}) } */
  function calendario(cont, opts) {
    const o = Object.assign({ rango: false }, opts || {});
    let ver = parse(o.valor || hoyISO()) || new Date();
    let ini = o.rango ? (o.inicio || null) : (o.valor || null);
    let fin = o.rango ? (o.fin || null) : null;

    function render() {
      const y = ver.getFullYear(), m = ver.getMonth();
      const primero = new Date(y, m, 1);
      const desplaz = primero.getDay();
      const totalDias = new Date(y, m + 1, 0).getDate();
      let html = '<div class="cal"><div class="cal-h">' +
        '<button type="button" class="cal-nav" data-nav="-1" aria-label="Mes anterior">‹</button>' +
        '<b>' + esc(MESES[m] + ' ' + y) + '</b>' +
        '<button type="button" class="cal-nav" data-nav="1" aria-label="Mes siguiente">›</button>' +
        '</div><div class="cal-g">';
      ['D', 'L', 'M', 'M', 'J', 'V', 'S'].forEach(x => { html += '<div class="cal-dow">' + x + '</div>'; });
      for (let i = 0; i < desplaz; i++) html += '<div class="cal-d out"></div>';
      for (let dia = 1; dia <= totalDias; dia++) {
        const f = iso(new Date(y, m, dia));
        const clases = ['cal-d'];
        if (f === hoyISO()) clases.push('hoy');
        if (f === ini || f === fin) clases.push('sel');
        else if (ini && fin && f > ini && f < fin) clases.push('rng');
        const off = (o.min && f < o.min) || (o.max && f > o.max) || (o.deshabilitado && o.deshabilitado(f));
        if (off) clases.push('off');
        html += '<button type="button" class="' + clases.join(' ') + '"' + (off ? ' disabled' : '') +
                ' data-f="' + esc(f) + '">' + dia + '</button>';
      }
      html += '</div></div>';
      cont.innerHTML = html;

      $$('.cal-nav', cont).forEach(b => b.addEventListener('click', () => {
        ver = new Date(ver.getFullYear(), ver.getMonth() + (+b.dataset.nav), 1);
        render();
      }));
      $$('.cal-d[data-f]', cont).forEach(b => b.addEventListener('click', () => {
        const f = b.dataset.f;
        if (!o.rango) { ini = f; render(); o.onPick && o.onPick(f); return; }
        if (!ini || (ini && fin) || f < ini) { ini = f; fin = null; }
        else { fin = f; }
        render();
        o.onPick && o.onPick({ inicio: ini, fin: fin });
      }));
    }
    render();
    return { get: () => (o.rango ? { inicio: ini, fin: fin } : ini) };
  }

  /* ---------------- Shell (topbar + sidebar) ---------------- */
  function chip(estado) {
    const map = {
      pendiente: ['wa', 'Pendiente'], aprobada: ['ok', 'Aprobada'], rechazada: ['no', 'Rechazada'],
      confirmada: ['in', 'Confirmada'], cancelada: ['no', 'Cancelada'], atendida: ['ok', 'Atendida'],
      borrador: ['nt', 'Borrador'], en_firma: ['wa', 'En firma'], completado: ['ok', 'Completado'],
      rechazado: ['no', 'Rechazado'], firmado: ['ok', 'Firmado']
    };
    const v = map[estado] || ['nt', estado];
    return '<span class="chip ' + v[0] + '">' + esc(v[1]) + '</span>';
  }

  function requiereSesion(moduloId) {
    const s = sesionEfectiva();
    if (!s) { location.replace('index.html'); return null; }
    /* Contraseña temporal con el cambio obligatorio activado (interruptor exigir_cambio_clave): hasta que la persona la cambie sólo puede entrar a «Mi cuenta». */
    if (s.cambioObligatorio === true && !/cuenta\.html$/.test(location.pathname)) { location.replace('cuenta.html?cambio=1'); return null; }
    if (moduloId && !puede(s, moduloId)) {
      const mod = MODULOS.find(m => m.id === moduloId) || {};
      const desactivado = mod.id && !moduloActivo(mod);
      document.body.innerHTML =
        '<div style="max-width:480px;margin:14vh auto;text-align:center;font-family:Poppins,Segoe UI,sans-serif">' +
        '<div style="font-size:40px">' + (desactivado ? '🚧' : '🔒') + '</div>' +
        '<h1 style="font-size:20px;margin:10px 0">' +
          (desactivado ? 'Módulo no habilitado' : 'Sin acceso a esta sección') + '</h1>' +
        '<p style="font-size:13.5px;color:#516079">' +
          (desactivado
            ? 'El módulo <b>' + esc(mod.nombre || moduloId) + '</b> está desactivado en esta versión del portal.'
            : 'Tu acceso (' + esc(ACCESO_TEXTO(s)) + ') no tiene permiso para <b>' + esc(mod.nombre || moduloId) + '</b>.') +
        '</p><p style="margin-top:18px"><a href="index.html">Volver al inicio</a></p></div>';
      return null;
    }
    return s;
  }

  /* Opciones de la barra superior, en este orden. Vacaciones, Banco de horas y Cita médica abren su
     FORMULARIO en el lugar (sin cambiar de página; lo trae formularios.js); Calendario abre su página.
     En pantallas angostas se agrupan en un menú desplegable. */
  const NAV_SUPERIOR = [
    { id: 'vacaciones', modulo: 'vacaciones', txt: 'Vacaciones',     ico: '🌴', form: 'vacaciones', url: 'vacaciones.html#solicitar-vacaciones' },
    { id: 'banco',      modulo: 'vacaciones', txt: 'Banco de horas', ico: '⏱️', form: 'banco',      url: 'vacaciones.html#solicitar-banco' },
    { id: 'cita',       modulo: 'medico',     txt: 'Cita médica',    ico: '🩺', form: 'cita',       url: 'medico.html#cita' },
    { id: 'calendario', modulo: 'calendario', txt: 'Calendario',     ico: '📆', url: 'calendario.html' }
  ];
  /* Sólo aparecen los accesos cuyo módulo está activo y permitido. Con uno solo, se muestra como botón suelto
     (sin el menú desplegable «＋ Solicitar»). */
  function navSuperior(activo, persona) {
    const items = NAV_SUPERIOR.filter(n => puede(persona, n.modulo));
    if (!items.length) return '';
    const interior = n => '<span class="tb-ico">' + n.ico + '</span><span>' + esc(n.txt) + '</span>';
    const liga = (n, clase) => n.form
      ? '<button type="button" class="' + clase + '" data-form="' + n.form + '">' + interior(n) + '</button>'
      : '<a class="' + clase + (n.id === activo ? ' on' : '') + '" href="' + esc(n.url) + '">' + interior(n) + '</a>';
    const botones = items.map(n => liga(n, 'tb-op')).join('');
    if (items.length === 1) return '<nav class="tb-nav tb-solo" aria-label="Accesos rápidos">' + botones + '</nav>';
    return '<nav class="tb-nav" aria-label="Accesos rápidos">' + botones + '</nav>' +
      '<details class="tb-more"><summary aria-label="Accesos rápidos">＋ Solicitar</summary><div class="tb-menu">' + botones + '</div></details>';
  }

  /* ---- Cierre de sesión por inactividad (datos de salud: no se deja una sesión abierta sin uso) ---- */
  const INACTIVIDAD_MIN = 20;
  function iniciarInactividad() {
    const limite = (+sessionStorage.getItem('zx_inactividad_prueba_seg') / 60) || INACTIVIDAD_MIN;     // la clave de prueba sólo existe en las pruebas del equipo
    let ultimo = Date.now(), avisado = false;
    const mover = () => { ultimo = Date.now(); avisado = false; };
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, mover, { passive: true }));
    setInterval(() => {
      const min = (Date.now() - ultimo) / 60000;
      if (min >= limite) { API.cerrarSesion(); location.replace('index.html?expirada=1'); }
      else if (min >= limite - Math.min(1, limite / 4) && !avisado) { avisado = true; toast('Tu sesión se cerrará en breve por inactividad. Mueve el ratón o toca la pantalla para continuar.', 'wa'); }
    }, 5000);
  }

  /* ---- Búsqueda: sin acentos ni mayúsculas, y todas las palabras deben coincidir ---- */
  const normBus = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const coincide = (texto, consulta) => { const t = normBus(texto); return normBus(consulta).split(/\s+/).filter(Boolean).every(w => t.indexOf(w) >= 0); };

  /* Cuadro de búsqueda automático para toda tabla que liste personas (encabezado Nombre/Colaborador/Usuario…) y tenga varias filas. */
  const COL_PERSONA = /^(nombre|nombre completo|colaborador|empleado|paciente|persona|usuario|afectado|jefe)$/i;
  const COL_BUSCABLE = /nombre|colaborador|empleado|paciente|persona|n[úu]mero|^n[º°o]\.?$|n[óo]mina|folio|departamento|puesto|[áa]rea|direcci[óo]n|an[áa]lisis|programa|motivo|acci[óo]n|usuario|afectado|jefe|turno/i;
  const COL_ROTULO = /nombre|colaborador|empleado|paciente|persona|n[úu]mero|^n[º°o]\.?$|n[óo]mina|folio|departamento|puesto|[áa]rea|direcci[óo]n|an[áa]lisis|programa|motivo|acci[óo]n|usuario|jefe/i;
  function activarBuscador(tb, heads) {
    const wrap = tb.closest('.tbl-wrap');
    const cols = heads.map((h, i) => COL_BUSCABLE.test(h) ? i : -1).filter(i => i >= 0);
    const filas = Array.prototype.slice.call(tb.tBodies[0].rows);
    const cache = filas.map(r => normBus(cols.map(i => r.cells[i] ? r.cells[i].textContent : '').join(' ')));
    const clave = 'zx_buscar:' + location.pathname + ':' + heads.join('|');
    const rotulos = heads.filter(h => COL_ROTULO.test(h)).map(h => h.toLowerCase()).filter((h, i, a) => a.indexOf(h) === i).slice(0, 4);
    const caja = document.createElement('div'); caja.className = 'buscador';
    caja.innerHTML = '<span class="bus-ico" aria-hidden="true">🔎</span><input type="search" autocomplete="off" aria-label="Buscar en la tabla" placeholder="Buscar por ' +
      esc(rotulos.length > 1 ? rotulos.slice(0, -1).join(', ') + ' o ' + rotulos[rotulos.length - 1] : (rotulos[0] || 'nombre')) + '">' +
      '<button type="button" class="bus-x" aria-label="Limpiar búsqueda" hidden>✕</button><span class="bus-n"></span>';
    wrap.parentNode.insertBefore(caja, wrap);
    const inp = caja.querySelector('input'), x = caja.querySelector('.bus-x'), n = caja.querySelector('.bus-n');
    let vacio = null;
    const aplicar = () => {
      const q = normBus(inp.value).split(/\s+/).filter(Boolean); let vis = 0;
      filas.forEach((r, i) => { const ok = q.every(w => cache[i].indexOf(w) >= 0); r.hidden = !ok; if (ok) vis++; });
      x.hidden = !q.length;
      n.textContent = q.length ? 'Mostrando ' + vis + ' de ' + filas.length : filas.length + ' registros';
      if (vacio) { vacio.remove(); vacio = null; }
      if (q.length && !vis) { vacio = document.createElement('tr'); vacio.className = 'bus-vacio'; vacio.innerHTML = '<td colspan="' + heads.length + '">Sin coincidencias para «' + esc(inp.value.trim()) + '».</td>'; tb.tBodies[0].appendChild(vacio); }
      try { sessionStorage.setItem(clave, inp.value); } catch (e) {}
    };
    inp.addEventListener('input', aplicar);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Escape' && inp.value) { inp.value = ''; aplicar(); } });
    x.addEventListener('click', () => { inp.value = ''; aplicar(); inp.focus(); });
    try { inp.value = sessionStorage.getItem(clave) || ''; } catch (e) {}
    tb.dataset.buscable = '1'; aplicar();
  }
  function activarBuscadores() {
    const main = document.getElementById('zx-main'); if (!main) return;
    let t = null;
    const pasar = () => {
      if (main.querySelector('#q')) return;                              // la vista ya trae su propio buscador
      Array.prototype.forEach.call(main.querySelectorAll('.tbl-wrap table'), tb => {
        if (tb.dataset.buscable || tb.closest('[data-nobuscar]') || tb.closest('#tabc') || !tb.tHead || !tb.tBodies[0] || !tb.tHead.rows[0]) return;
        const heads = Array.prototype.map.call(tb.tHead.rows[0].cells, c => c.textContent.trim());
        if (!heads.some(h => COL_PERSONA.test(h))) return;
        if (tb.tBodies[0].rows.length < 8 && !tb.hasAttribute('data-buscar')) return;
        activarBuscador(tb, heads);
      });
    };
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(pasar, 60); }).observe(main, { childList: true, subtree: true });
    pasar();
  }

  /* Nombre legible de lo que registra la bitácora */
  const ENT_BIT = { historias_clinicas: 'Historia clínica', consultas: 'Consulta', evaluaciones: 'Evaluación', riesgos_trabajo: 'Riesgo de trabajo', incapacidades: 'Incapacidad',
    vacunas: 'Vacuna', documentos_medicos: 'Documento médico', casos_analisis: 'Caso de seguimiento', resultados_analisis: 'Resultado de análisis', programacion_analisis: 'Programación de análisis',
    programa_evaluaciones: 'Programa de exámenes', vigilancia_epidemiologica: 'Atención y Control de Salud', expedientes_medicos_estado: 'Estado del expediente' };
  const FIJAS_BIT = { 'expediente.consultar': 'Consulta del expediente', 'documento.consultar': 'Apertura de documento', 'expediente.imprimir': 'Impresión del expediente' };
  function etiquetaAccion(a) {
    a = String(a || ''); if (FIJAS_BIT[a]) return FIJAS_BIT[a];
    const p = a.split('.'); return ENT_BIT[p[0]] && p[1] ? ENT_BIT[p[0]] + ' ' + p[1] : a;
  }

  /* Botón «Volver arriba»: aparece al bajar y sube el área de contenido (es la que se desplaza). */
  function montarVolverArriba() {
    const area = document.getElementById('zx-main');
    if (!area) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'zx-top'; b.title = 'Volver arriba'; b.setAttribute('aria-label', 'Volver arriba');
    b.innerHTML = '<span aria-hidden="true">▲</span>';
    document.body.appendChild(b);
    const ver = () => b.classList.toggle('on', area.scrollTop > 300);
    area.addEventListener('scroll', ver, { passive: true });
    b.addEventListener('click', () => area.scrollTo({ top: 0, behavior: 'smooth' }));
    ver();
  }

  function montarShell(activo, subtitulo, navItems) {
    const s = sesionEfectiva();
    if (!s) return null;
    const app = document.createElement('div');
    app.className = 'app';

    /* Barra lateral tipo acordeón: las vistas del módulo actual ("Mi saldo",
       "Mis solicitudes"...) se despliegan JUSTO DEBAJO de ese módulo, no en
       un bloque aparte al final. Los demás módulos quedan como enlaces. */
    const vistasHtml = (m) => {
      if (m.id !== activo || !navItems || !navItems.length) return '';
      return '<div class="sb-sub">' + navItems.map((n, i) =>
        '<button class="sb-item sb-subitem' + (i === 0 ? ' on' : '') + '" data-vista="' + esc(n.id) + '">' +
        '<span class="sb-ico">' + n.ico + '</span><span>' + esc(n.nombre) + '</span></button>').join('') + '</div>';
    };
    const modHtml = (m) => '<a class="sb-item' + (m.id === activo ? ' on' : '') + '" href="' + esc(m.url) + '"><span class="sb-ico">' + m.ico +
      '</span><span>' + esc(m.nombre) + '</span></a>' + vistasHtml(m);
    let nav = '';
    const permitidos = modulosVisibles().filter(m => puede(s, m.id)), hechos = {};
    permitidos.forEach(m => {
      if (!m.grupo) { nav += modHtml(m); return; }
      if (hechos[m.grupo]) return;
      hechos[m.grupo] = true;
      const miembros = permitidos.filter(x => x.grupo === m.grupo);
      if (miembros.length === 1) { nav += modHtml(miembros[0]); return; }          // un solo sub-módulo: se muestra directo
      const g = GRUPOS[m.grupo], abierto = miembros.some(x => x.id === activo);
      nav += '<div class="sb-grupo' + (abierto ? ' abierto' : '') + '"><button type="button" class="sb-item sb-grupo-t" aria-expanded="' + abierto + '">' +
        '<span class="sb-ico">' + g.ico + '</span><span>' + esc(g.nombre) + '</span><span class="sb-caret">▾</span></button>' +
        '<div class="sb-grupo-c">' + miembros.map(modHtml).join('') + '</div></div>';
    });

    app.innerHTML =
      '<header class="topbar">' +
        '<button type="button" class="tb-menu-btn" id="zx-menu" aria-label="Abrir menú">☰</button>' +
        '<div class="zx-logo"><span class="zx-mark">ZX</span><span>Portal RRHH</span></div>' +
        navSuperior(activo, s) +
        '<div class="tb-right">' +
          '<button class="theme-btn" id="zx-tema" aria-label="Cambiar tema"></button>' +
          '<div class="tb-user"><b>' + esc(s.nombre) + '</b><span title="' + esc([s.puesto, s.departamento].filter(Boolean).join(' · ')) + '">' +
            esc([s.puesto, s.departamento].filter(Boolean).join(' · ')) + '</span></div>' +
          '<a class="tb-avatar" href="cuenta.html" title="Mi cuenta" aria-label="Mi cuenta">' + esc(iniciales(s.nombre)) + '</a>' +
          '<button class="btn-logout" id="zx-salir">Salir</button>' +
        '</div>' +
      '</header>' +
      '<div class="layout">' +
        '<div class="sb-fondo" id="zx-sbf"></div>' +
        '<aside class="sidebar" id="zx-sb">' +
          '<div class="sb-top"><button class="sb-toggle" id="zx-tg" aria-label="Colapsar menú">☰</button></div>' +
          '<nav class="sb-nav"><div class="sb-sec">Portal</div>' + nav + '</nav>' +
          '<div class="sb-foot">Zubex Industrial · v' + VERSION + '</div>' +
        '</aside>' +
        '<main class="main" id="zx-main"></main>' +
      '</div>';

    document.body.innerHTML = '';
    document.body.appendChild(app);
    $('#zx-tema').addEventListener('click', alternarTema);
    montarVolverArriba();
    iniciarInactividad();
    activarBuscadores();
    document.querySelectorAll('[data-form]').forEach(b => b.addEventListener('click', () => {      // formularios de la barra superior
      const menu = b.closest('details'); if (menu) menu.removeAttribute('open');
      const abrir = global.ZX && global.ZX.formularios && global.ZX.formularios[b.dataset.form];
      if (abrir) abrir(); else location.href = (NAV_SUPERIOR.find(n => n.form === b.dataset.form) || {}).url;
    }));
    /* Menú en el celular: cajón que se abre con ☰ y se cierra al elegir algo o al tocar fuera */
    const cajon = (abrir) => { $('#zx-sb').classList.toggle('abierto', abrir); $('#zx-sbf').classList.toggle('abierto', abrir); };
    $('#zx-menu').addEventListener('click', () => cajon(!$('#zx-sb').classList.contains('abierto')));
    $('#zx-sbf').addEventListener('click', () => cajon(false));
    document.querySelectorAll('#zx-sb .sb-item[data-vista], #zx-sb a.sb-item').forEach(x => x.addEventListener('click', () => cajon(false)));
    document.querySelectorAll('.sb-grupo-t').forEach(b => b.addEventListener('click', () => {
      const g = b.parentElement; g.classList.toggle('abierto'); b.setAttribute('aria-expanded', g.classList.contains('abierto'));
    }));
    $('#zx-salir').addEventListener('click', () => { API.cerrarSesion(); location.replace('index.html'); });
    $('#zx-tg').addEventListener('click', () => $('#zx-sb').classList.toggle('col'));
    return { main: $('#zx-main'), sesion: s };
  }

  function bindVistas(onCambio) {
    const ir = (id) => {
      $$('.sb-item[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === id));
      /* Si una vista falla, se muestra el error en lugar de dejar la
         pantalla en blanco o en "Cargando…" indefinidamente. */
      try {
        const r = onCambio(id);
        if (r && typeof r.catch === 'function') r.catch(e => { console.error('[Portal RRHH]', e); fallo(e); });
      } catch (e) { console.error('[Portal RRHH]', e); fallo(e); }
    };
    $$('.sb-item[data-vista]').forEach(b => b.addEventListener('click', () => ir(b.dataset.vista)));
    return { ir };      // permite cambiar de vista por código (enlaces directos)
  }

  function pie(main, nota) {
    const div = document.createElement('div');
    let html = '';
    if (nota) html += '<div class="nota"><b>Nota metodológica.</b> ' + esc(nota) + '</div>';
    html += '<div class="pie">Portal RRHH · Zubex Industrial S.A. de C.V. · Generado: ' + esc(fmtLargo(hoyISO())) + '</div>';
    div.innerHTML = html;
    main.appendChild(div);
  }

  function cargando(main) {
    main.innerHTML = '<div class="empty">Cargando…</div>';
  }

  /* Ninguna pantalla debe quedarse en "Cargando…" para siempre: si la carga
     falla, se muestra el error y cómo recuperarse. */
  function fallo(err) {
    const main = $('#zx-main') || document.body;
    main.innerHTML =
      '<div class="card" style="max-width:620px;margin:8vh auto;text-align:center">' +
        '<div style="font-size:34px;margin-bottom:8px">⚠️</div>' +
        '<h1 class="page-t" style="margin-bottom:6px">No se pudo cargar esta sección</h1>' +
        '<p class="page-sub" style="margin-bottom:14px">' + esc((err && err.message) || String(err || 'Error desconocido')) + '</p>' +
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:16px">Revisa tu conexión y vuelve a intentarlo. ' +
          'Si el problema continúa, cierra sesión y entra de nuevo.</p>' +
        '<div class="btn-row" style="justify-content:center">' +
          '<button class="btn" id="zx-recargar">Recargar página</button>' +
          '<button class="btn gh" id="zx-cerrar">Cerrar sesión</button>' +
        '</div></div>';
    const rc = $('#zx-recargar'), cs = $('#zx-cerrar');
    if (rc) rc.addEventListener('click', () => location.reload());
    if (cs) cs.addEventListener('click', () => { API.cerrarSesion(); location.replace('index.html'); });
  }

  /* Envuelve el arranque de cada página.
     Además del try/catch, impone un tiempo límite: ninguna pantalla debe
     quedarse en "Cargando…" indefinidamente, ni siquiera si una promesa
     nunca se resuelve. */
  function arranque(fn, ms) {
    let listo = false;
    const limite = setTimeout(() => {
      if (listo) return;
      const main = $('#zx-main');
      if (main && main.textContent.indexOf('Cargando') >= 0) {
        fallo(new Error('La carga tardó más de ' + Math.round((ms || 12000) / 1000) +
          ' segundos y se interrumpió. Puede ser un bloqueo de red o un problema de conexión.'));
      }
    }, ms || 12000);
    Promise.resolve().then(fn)
      .then(() => { listo = true; clearTimeout(limite); })
      .catch(e => { listo = true; clearTimeout(limite); console.error('[Portal RRHH]', e); fallo(e); });
  }
  global.addEventListener('unhandledrejection', ev => {
    console.error('[Portal RRHH]', ev.reason);
    const main = $('#zx-main');
    if (main && main.textContent.indexOf('Cargando') >= 0) fallo(ev.reason);
  });

  function tabla(cols, filas, opts) {
    const o = opts || {};
    if (!filas.length) return '<div class="tbl-wrap"><div class="empty">' + esc(o.vacio || 'Sin registros.') + '</div></div>';
    let h = '<div class="tbl-wrap"><table><thead><tr>';
    cols.forEach(c => { h += '<th>' + esc(c.t) + '</th>'; });
    h += '</tr></thead><tbody>';
    filas.forEach((f, i) => {
      h += '<tr' + (o.filaAttr ? ' ' + o.filaAttr(f, i) : '') + '>';
      cols.forEach(c => { h += '<td>' + (c.html ? c.html(f, i) : esc(c.v ? c.v(f) : f[c.k])) + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function descargarCSV(nombre, cols, filas) {
    const esc2 = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lineas = [cols.map(c => esc2(c.t)).join(',')];
    filas.forEach(f => lineas.push(cols.map(c => esc2(c.v ? c.v(f) : f[c.k])).join(',')));
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /* Lector de CSV genérico (RFC4180: comillas, comas y saltos de línea
     dentro de campos entrecomillados). Devuelve { headers, filas } donde
     cada fila es un objeto con las columnas originales (sin normalizar) —
     quien llame decide cómo mapear encabezados a campos, porque cada
     fuente (IBIX, un Excel a mano) nombra sus columnas distinto. */
  function leerCSV(texto) {
    const s = String(texto || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const filas = [];
    let fila = [], campo = '', enComillas = false, i = 0;
    while (i < s.length) {
      const c = s[i];
      if (enComillas) {
        if (c === '"') {
          if (s[i + 1] === '"') { campo += '"'; i += 2; continue; }
          enComillas = false; i++; continue;
        }
        campo += c; i++; continue;
      }
      if (c === '"') { enComillas = true; i++; continue; }
      if (c === ',') { fila.push(campo); campo = ''; i++; continue; }
      if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; i++; continue; }
      campo += c; i++;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    const limpio = filas.filter(f => f.some(v => String(v).trim() !== ''));
    if (!limpio.length) return { headers: [], filas: [] };
    const headers = limpio[0].map(h => h.trim());
    const objetos = limpio.slice(1).map(f => {
      const o = {};
      headers.forEach((h, idx) => { o[h] = (f[idx] || '').trim(); });
      return o;
    });
    return { headers, filas: objetos };
  }

  global.ZX = {
    VERSION, MODULOS, modulosVisibles, puede, NIVEL_NOMBRE, PERFIL_NOMBRE, ACCESO_TEXTO,
    esAprobador, esClinico, esRRHH, esVigilancia, esAdmin, notaConservacion,
    esc, $, $$, MESES, DIAS,
    hoyISO, parse, fmt, fmtDT, fmtLargo, MES3, iso, sumaDias, diffDias, antiguedad, edad, iniciales, imc, alHash,
    alternarTema, toast, modal, cerrarModal, confirmar, calendario,
    chip, requiereSesion, sesionEfectiva, GRUPOS, coincide, etiquetaAccion, montarShell, bindVistas, pie, cargando, fallo, arranque, tabla, descargarCSV, leerCSV
  };
})(window);

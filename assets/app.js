/* ============================================================
   Portal Zubex — Shell común (sesión, permisos, UI)
   Se carga en TODAS las páginas del portal.
   ============================================================ */
(function (global) {
  'use strict';

  const API = global.ZX_API;
  const VERSION = '2.2.1';

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
    { id: 'vacaciones', nombre: 'Vacaciones y horas', ico: '🌴', url: 'vacaciones.html', roles: '*',
      desc: 'Solicita vacaciones y banco de horas, consulta tu saldo y tus solicitudes.' },

    /* El calendario no es una sección del menú: se abre desde la barra superior.
       `oculto` lo deja fuera del menú lateral, de "Tus secciones" y de la matriz de permisos. */
    { id: 'calendario', nombre: 'Calendario',        ico: '📆', url: 'calendario.html', roles: '*', oculto: true },

    { id: 'medico',     nombre: 'Servicio médico',   ico: '🩺', url: 'medico.html',     roles: '*',
      desc: 'Tu historia clínica, tu expediente ocupacional y tus citas con el médico de empresa.' },
    /* Perfil-gated: sólo quien tenga un perfil con 'analisis' entre sus
       módulos (tabla perfiles de la base de datos). Sin roles fijos aquí — se
       resuelve en vivo contra el store, por eso Administración puede
       crear perfiles nuevos y dárselo sin tocar este archivo. */
    { id: 'analisis',   nombre: 'Análisis clínicos', ico: '🧪', url: 'analisis.html',
      desc: 'Etapa 1 · SQF: resultados de los análisis anuales, desviaciones y seguimiento médico hasta el alta.' },
    /* Aptitud es el único módulo con DOS caminos de acceso: por perfil
       (medico/vigilancia → planta completa) o por nivel (nivelExtra:
       'supervisor' → sólo el equipo propio). Ver puede() y soloEquipo en
       page-aptitud.js. */
    { id: 'aptitud',    nombre: 'Aptitud y restricciones', ico: '🦺', url: 'aptitud.html', nivelExtra: 'supervisor',
      desc: 'Aptitud laboral, restricciones y recomendaciones por puesto. Sin información clínica.' },
    { id: 'indicadores', nombre: 'Indicadores',      ico: '📈', url: 'indicadores.html',
      desc: 'Tablero de salud ocupacional con datos agregados, sin datos clínicos individuales.' },
    { id: 'rrhh',       nombre: 'Recursos Humanos',  ico: '🗂️', url: 'rrhh.html',
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
  const esAprobador = (persona) => ['coordinador', 'supervisor'].indexOf((persona || {}).nivel) >= 0;
  const esClinico = (persona) => (persona || {}).perfil === 'medico';
  const esRRHH = (persona) => (persona || {}).perfil === 'rrhh';
  const esVigilancia = (persona) => (persona || {}).perfil === 'vigilancia';
  const esAdmin = (persona) => (persona || {}).perfil === 'admin';

  /* ---------------- Vista previa por tipo de usuario (sólo Administración) ----------------
     Una persona con perfil Administrador puede "ver el portal como" otro nivel (Empleado, Coordinador,
     Jefe/Gerente) o perfil (Salud Ocupacional, RRHH...) para comprobar qué menús, secciones y opciones
     le aparecen a cada tipo, sin entrar y salir de cuentas.
     ALCANCE: cambia únicamente lo que la pantalla MUESTRA (menús, módulos, pestañas, botones). La
     identidad real no cambia: las peticiones a la base siguen yendo con la sesión y los permisos reales
     del administrador, así que los datos que llegan NO son los de ese tipo de usuario. Tampoco se entra
     a ninguna cuenta ajena: hacerlo daría acceso a datos de otras personas (en el caso del médico, a
     datos clínicos). Sólo se aplica si la sesión real es de Administrador. */
  const VISTA_KEY = 'zx_vista_como';
  function leerVista() { try { return JSON.parse(sessionStorage.getItem(VISTA_KEY) || 'null'); } catch (e) { return null; } }
  function setVista(clave) {
    if (!clave || clave === 'real') { sessionStorage.removeItem(VISTA_KEY); return; }
    const tipo = clave.slice(0, 1), id = clave.slice(2);
    const nivel = tipo === 'n' ? id : 'empleado', perfil = tipo === 'p' ? id : 'ninguno';
    const etiqueta = tipo === 'n' ? NIVEL_NOMBRE(id) : PERFIL_NOMBRE(id);
    sessionStorage.setItem(VISTA_KEY, JSON.stringify({ clave, nivel, perfil, etiqueta }));
  }
  /* La sesión que usa la interfaz para decidir qué mostrar: la real, o la de la vista previa. */
  function sesionEfectiva() {
    const s = API.sesionActual();
    if (!s) return s;
    const v = leerVista();
    if (!v) return s;
    if (!esAdmin(s)) { sessionStorage.removeItem(VISTA_KEY); return s; }
    return Object.assign({}, s, { nivel: v.nivel, perfil: v.perfil, vistaComo: v.etiqueta });
  }
  function selectorVista(real) {
    if (!esAdmin(real)) return '';
    const v = leerVista(), actual = v ? v.clave : 'real';
    const niveles = Object.keys((global.ZX_CAT && ZX_CAT.NIVELES) || {}).map(n => ['n:' + n, NIVEL_NOMBRE(n)]);
    const perfiles = (API.perfilesSync ? API.perfilesSync() : []).filter(p => p.id !== 'ninguno' && p.id !== 'admin').map(p => ['p:' + p.id, p.nombre]);
    const op = (par) => '<option value="' + esc(par[0]) + '"' + (par[0] === actual ? ' selected' : '') + '>' + esc(par[1]) + '</option>';
    return '<label class="tb-ver" title="Ver el portal como otro tipo de usuario (sólo cambia lo que se muestra)"><span>👁 Ver como</span>' +
      '<select id="zx-vista" aria-label="Ver como">' +
        '<option value="real"' + (actual === 'real' ? ' selected' : '') + '>Administrador (mi vista)</option>' +
        '<optgroup label="Por nivel">' + niveles.map(op).join('') + '</optgroup>' +
        '<optgroup label="Por perfil">' + perfiles.map(op).join('') + '</optgroup>' +
      '</select></label>';
  }
  function bannerVista(s, real) {
    return '<div class="vista-banner" role="status">👁 <div><b>Vista previa como «' + esc(s.vistaComo) + '».</b> ' +
      'Ves los menús, secciones y botones que le aparecen a ese tipo de usuario. Los <b>datos</b> que se cargan siguen siendo los de tu cuenta (' +
      esc(real.id) + ') y tus permisos reales, así que sirve para validar qué opciones ve, no qué información le devuelve la base.</div>' +
      '<button class="btn sm" id="zx-vista-fin">Volver a mi vista</button></div>';
  }

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
  let modalAbierto = null;
  function modal(opts) {
    cerrarModal();
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
    document.body.appendChild(ovl);
    modalAbierto = ovl;
    const primero = body.querySelector('input,select,textarea,button');
    if (primero) primero.focus();
    return body;
  }
  function cerrarModal() { if (modalAbierto) { modalAbierto.remove(); modalAbierto = null; } }
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
        '</p><p style="margin-top:18px"><a href="index.html">Volver al inicio</a>' +
        (s.vistaComo ? ' · <a href="#" id="zx-fin-vista">Volver a mi vista de Administración</a>' : '') + '</p></div>';
      const fin = document.getElementById('zx-fin-vista');
      if (fin) fin.addEventListener('click', ev => { ev.preventDefault(); setVista('real'); location.reload(); });
      return null;
    }
    return s;
  }

  /* Opciones de la barra superior, en este orden. Las tres primeras abren directamente el
     formulario (o el calendario). En pantallas angostas se agrupan en un menú desplegable. */
  const NAV_SUPERIOR = [
    { id: 'vacaciones', txt: 'Vacaciones',     ico: '🌴', url: 'vacaciones.html#solicitar-vacaciones' },
    { id: 'banco',      txt: 'Banco de horas', ico: '⏱️', url: 'vacaciones.html#solicitar-banco' },
    { id: 'cita',       txt: 'Cita médica',    ico: '🩺', url: 'medico.html#cita' },
    { id: 'calendario', txt: 'Calendario',     ico: '📆', url: 'calendario.html' }
  ];
  function navSuperior(activo) {
    const liga = (n, clase) => '<a class="' + clase + (n.id === activo ? ' on' : '') + '" href="' + esc(n.url) + '">' +
      '<span class="tb-ico">' + n.ico + '</span><span>' + esc(n.txt) + '</span></a>';
    return '<nav class="tb-nav" aria-label="Accesos rápidos">' + NAV_SUPERIOR.map(n => liga(n, 'tb-op')).join('') + '</nav>' +
      '<details class="tb-more"><summary aria-label="Accesos rápidos">☰ Solicitar</summary>' +
        '<div class="tb-menu">' + NAV_SUPERIOR.map(n => liga(n, 'tb-op')).join('') + '</div></details>';
  }

  function montarShell(activo, subtitulo, navItems) {
    const s = sesionEfectiva();
    if (!s) return null;
    const real = API.sesionActual();
    const app = document.createElement('div');
    app.className = 'app';

    /* Barra lateral tipo acordeón: las vistas del módulo actual ("Mi saldo",
       "Mis solicitudes"...) se despliegan JUSTO DEBAJO de ese módulo, no en
       un bloque aparte al final. Los demás módulos quedan como enlaces. */
    let nav = '';
    modulosVisibles().filter(m => puede(s, m.id)).forEach(m => {
      const on = m.id === activo ? ' on' : '';
      nav += '<a class="sb-item' + on + '" href="' + esc(m.url) + '"><span class="sb-ico">' + m.ico + '</span><span>' + esc(m.nombre) + '</span></a>';
      if (m.id === activo && navItems && navItems.length) {
        nav += '<div class="sb-sub">';
        navItems.forEach((n, i) => {
          nav += '<button class="sb-item sb-subitem' + (i === 0 ? ' on' : '') + '" data-vista="' + esc(n.id) + '">' +
                 '<span class="sb-ico">' + n.ico + '</span><span>' + esc(n.nombre) + '</span></button>';
        });
        nav += '</div>';
      }
    });

    app.innerHTML =
      '<header class="topbar">' +
        '<div class="zx-logo"><span class="zx-mark">ZX</span><span>Portal Zubex' +
          (subtitulo ? '<span class="tb-title" style="display:block">' + esc(subtitulo) + '</span>' : '') +
        '</span></div>' +
        navSuperior(activo) +
        '<div class="tb-right">' +
          selectorVista(real) +
          '<button class="theme-btn" id="zx-tema" aria-label="Cambiar tema"></button>' +
          '<div class="tb-user"><b>' + esc(s.nombre) + '</b><span title="' + esc([s.puesto, s.departamento].filter(Boolean).join(' · ')) + '">' +
            esc([s.puesto, s.departamento].filter(Boolean).join(' · ')) + '</span></div>' +
          '<div class="tb-avatar">' + esc(iniciales(s.nombre)) + '</div>' +
          '<button class="btn-logout" id="zx-salir">Salir</button>' +
        '</div>' +
      '</header>' +
      (s.vistaComo ? bannerVista(s, real) : '') +
      '<div class="layout">' +
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
    const sv = $('#zx-vista'); if (sv) sv.addEventListener('change', () => { setVista(sv.value); location.reload(); });
    const fv = $('#zx-vista-fin'); if (fv) fv.addEventListener('click', () => { setVista('real'); location.reload(); });
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
        if (r && typeof r.catch === 'function') r.catch(e => { console.error('[Portal Zubex]', e); fallo(e); });
      } catch (e) { console.error('[Portal Zubex]', e); fallo(e); }
    };
    $$('.sb-item[data-vista]').forEach(b => b.addEventListener('click', () => ir(b.dataset.vista)));
    return { ir };      // permite cambiar de vista por código (enlaces directos)
  }

  function pie(main, nota) {
    const div = document.createElement('div');
    let html = '';
    if (nota) html += '<div class="nota"><b>Nota metodológica.</b> ' + esc(nota) + '</div>';
    html += '<div class="pie">Portal Zubex · Zubex Industrial S.A. de C.V. · Generado: ' + esc(fmtLargo(hoyISO())) + '</div>';
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
      .catch(e => { listo = true; clearTimeout(limite); console.error('[Portal Zubex]', e); fallo(e); });
  }
  global.addEventListener('unhandledrejection', ev => {
    console.error('[Portal Zubex]', ev.reason);
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
    chip, requiereSesion, montarShell, bindVistas, pie, cargando, fallo, arranque, tabla, descargarCSV, leerCSV
  };
})(window);

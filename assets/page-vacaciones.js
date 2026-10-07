/* ============================================================
   Portal RRHH — Vacaciones y horas
   Vacaciones y banco de horas son dos cosas distintas que viven en la misma
   pantalla: Mi saldo, Por aprobar / Mi equipo (jefes)
   e Historial (jefes, RRHH y Admin). El calendario es una pantalla aparte.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, chip, fmt, fmtDT, hoyISO, iso, parse, sumaDias, diffDias,
          antiguedad, tabla, modal, cerrarModal, calendario, descargarCSV } = window.ZX;
  const API = window.ZX_API;

  const sesion = ZX.requiereSesion('vacaciones');
  if (!sesion) return;

  /* El Historial lo ven jefes (de su gente directa), RRHH y Admin (de todos): lo que llega
     a cada quien ya viene filtrado por los permisos de la base de datos. */
  const veHistorial = ZX.esAprobador(sesion) || ZX.esRRHH(sesion) || ZX.esAdmin(sesion);

  const vistas = [
    { id: 'perfil', nombre: 'Mi saldo', ico: '👤' }
  ];
  if (ZX.esAprobador(sesion)) {
    vistas.push({ id: 'aprobar', nombre: 'Por aprobar', ico: '✅' });
    vistas.push({ id: 'equipo',  nombre: 'Mi equipo',   ico: '👥' });
  }
  if (veHistorial) vistas.push({ id: 'historial', nombre: 'Historial', ico: '📚' });

  const shell = ZX.montarShell('vacaciones', 'Vacaciones y horas', vistas);
  const main = shell.main;

  let D = { emps: [], sols: [], banco: [], yo: null };
  const dos = n => String(n).padStart(2, '0');
  const emp = id => D.emps.find(e => e.id === id) || {};
  const nombreDe = id => emp(id).nombre || id;
  const departamentoDe = id => emp(id).departamento || '';
  /* Horario de uso del banco de horas: muchas solicitudes no lo traen. */
  const horario = s => s.horaInicio ? s.horaInicio + '–' + s.horaFin : '';
  /* Quién resolvió la solicitud y cuándo. */
  const resuelta = s => s.resueltoPor ? s.resueltoPor + (s.resuelta ? ' · ' + fmt(s.resuelta) : '') : (s.resuelta ? fmt(s.resuelta) : '—');
  /* Fecha local (AAAA-MM-DD) de una marca de tiempo de la base. */
  const fechaLocal = ts => iso(new Date(ts));

  async function recargar() {
    const [emps, sols, banco] = await Promise.all([
      API.empleados.lista(), API.vacaciones.solicitudes(), API.vacaciones.banco()
    ]);
    D = { emps, sols, banco, yo: emps.find(e => e.id === sesion.id) };
    marcaEquipo();
  }
  async function refrescar() { await recargar(); render(); }

  let vistaActual = 'perfil';
  const nav = ZX.bindVistas(v => { vistaActual = v; render(); });
  function irA(vista) { nav.ir(vista); }

  function render() {
    if (!D.yo) return;                       // todavía cargando: arranque() pinta al terminar
    if (vistaActual === 'historial' && !veHistorial) vistaActual = 'perfil';
    ({ perfil, aprobar, equipo, historial }[vistaActual] || perfil)();
  }

  /* Enlaces directos desde la barra superior y las tarjetas del inicio */
  const atenderHash = ZX.alHash(h => {
    if (!D.yo) return;
    if (h === 'solicitar-vacaciones')      { irA('perfil'); ZX.formularios.vacaciones(); }
    else if (h === 'solicitar-banco')      { irA('perfil'); ZX.formularios.banco(); }
    else if (h === 'pendientes-vacaciones' || h === 'pendientes-banco') { irA('perfil'); }   // enlaces viejos: las pendientes se ven en Mi saldo
  });

  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); atenderHash(); });
  document.addEventListener('zx:datos', () => { refrescar().catch(e => toast(e.message, 'no')); });   // un formulario de la barra superior terminó

  /* ====================== PERIODOS ======================
     Vacaciones: año aniversario (del aniversario de ingreso al día anterior al siguiente).
     Banco de horas: año natural (1 de enero al 31 de diciembre).
     Una solicitud se ve en el periodo en que se CREÓ; si su fecha cae en un periodo
     posterior, se ve también ahí, marcada como "Periodo anterior" / "Año anterior". */
  function aniversario(ingreso, n) {
    const d = parse(ingreso);
    return iso(new Date(d.getFullYear() + n, d.getMonth(), d.getDate()));
  }
  function periodoDe(ingreso, fecha) {            // índice del año aniversario que contiene la fecha (mínimo 0)
    let n = parse(fecha).getFullYear() - parse(ingreso).getFullYear();
    if (aniversario(ingreso, n) > fecha) n--;
    return Math.max(0, n);
  }
  const etiquetaPeriodo = (ingreso, n) => { const y = parse(ingreso).getFullYear() + n; return y + '-' + (y + 1); };
  const rangoPeriodo = (ingreso, n) => fmt(aniversario(ingreso, n)) + ' al ' + fmt(sumaDias(aniversario(ingreso, n + 1), -1));

  function ubicaciones(s, ingreso) {              // vacaciones → periodos donde aparece
    const pc = periodoDe(ingreso, fechaLocal(s.creada)), pi = periodoDe(ingreso, s.inicio);
    return pi > pc ? [{ n: pc, anterior: false }, { n: pi, anterior: true }] : [{ n: pc, anterior: false }];
  }
  function ubicacionesBanco(s) {                  // banco → años donde aparece
    const yc = fechaLocal(s.creada).slice(0, 4), yf = s.fecha.slice(0, 4);
    return yf > yc ? [{ n: yc, anterior: false }, { n: yf, anterior: true }] : [{ n: yc, anterior: false }];
  }
  let perVac = null, anioBan = null;              // null = el actual

  /* ------------------------ MI SALDO ------------------------ */
  function perfil() {
    const yo = D.yo;
    const disp = yo.dias + (yo.pendActivos ? yo.diasPend : 0);
    const mias = D.sols.filter(s => s.empleado === yo.id);
    const misB = D.banco.filter(s => s.empleado === yo.id);

    /* Vacaciones: por año aniversario (sin fecha de ingreso no se puede calcular → todas) */
    const conIngreso = !!yo.ingreso;
    const actualV = conIngreso ? periodoDe(yo.ingreso, hoyISO()) : 0;
    if (perVac === null || !conIngreso) perVac = actualV;
    let filasV, opcionesV = [];
    if (conIngreso) {
      const set = new Set([actualV]);
      mias.forEach(s => ubicaciones(s, yo.ingreso).forEach(u => set.add(u.n)));
      opcionesV = Array.from(set).sort((a, b) => b - a);
      if (opcionesV.indexOf(perVac) < 0) perVac = actualV;
      filasV = [];
      mias.forEach(s => ubicaciones(s, yo.ingreso).filter(u => u.n === perVac).forEach(u => filasV.push({ s, anterior: u.anterior })));
    } else {
      filasV = mias.map(s => ({ s, anterior: false }));
    }
    filasV.sort((a, b) => String(b.s.inicio).localeCompare(String(a.s.inicio)));

    /* Banco de horas: por año natural */
    const anioActual = String(new Date().getFullYear());
    if (anioBan === null) anioBan = anioActual;
    const setB = new Set([anioActual]);
    misB.forEach(s => ubicacionesBanco(s).forEach(u => setB.add(u.n)));
    const opcionesB = Array.from(setB).sort().reverse();
    if (opcionesB.indexOf(anioBan) < 0) anioBan = anioActual;
    const filasB = [];
    misB.forEach(s => ubicacionesBanco(s).filter(u => u.n === anioBan).forEach(u => filasB.push({ s, anterior: u.anterior })));
    filasB.sort((a, b) => String(b.s.fecha).localeCompare(String(a.s.fecha)));

    const anios = antiguedad(yo.ingreso);
    const notaDias = yo.pendActivos && yo.diasPend ? 'Incluye ' + yo.diasPend + ' días pendientes activados'
      : (yo.diasPend > 0 ? 'Tienes ' + yo.diasPend + ' días pendientes; tu jefe puede activarlos' : 'Sin días pendientes');
    const sub = [yo.puesto, yo.departamento, anios + (anios === 1 ? ' año' : ' años') + ' en la empresa'].filter(Boolean).join(' · ');
    main.innerHTML =
      head('Mi saldo', sub,
        '<button class="btn" id="b-vac">🌴 Solicitar vacaciones</button>' +
        '<button class="btn ac" id="b-ban">⏱️ Solicitar banco de horas</button>') +
      '<div class="grid g2">' +
        k('Días disponibles', disp, notaDias, disp < 0 ? 'dn' : '') +
        k('Banco de horas', netoHoras(yo) + ' h', yo.horasDeber ? 'Incluye ' + yo.horasDeber + ' h por reponer' : 'Disponibles', netoHoras(yo) < 0 ? 'dn' : '') +
      '</div>' +

      '<div class="sec-row"><div><h2 class="sec-t">Mis vacaciones</h2>' +
        '<div class="fm-nota">' + (conIngreso ? 'Año aniversario del ' + esc(rangoPeriodo(yo.ingreso, perVac)) :
          'Sin fecha de ingreso registrada: se muestran todas tus solicitudes.') + '</div></div>' +
        (conIngreso ? '<div class="field"><label for="pv">Periodo</label><select id="pv">' +
          opcionesV.map(n => '<option value="' + n + '"' + (n === perVac ? ' selected' : '') + '>' + esc(etiquetaPeriodo(yo.ingreso, n)) +
            (n === actualV ? ' (actual)' : '') + '</option>').join('') + '</select></div>' : '') +
      '</div>' +
      tabla([
        { t: 'Folio', html: r => esc(r.s.id) + (r.anterior ? '<span class="chip in sm">Periodo anterior</span>' : '') },
        { t: 'Inicio', v: r => fmt(r.s.inicio) },
        { t: 'Fin', v: r => fmt(r.s.fin) },
        { t: 'Días', v: r => r.s.dias },
        { t: 'Estado', html: r => chip(r.s.estado) },
        { t: '', html: r => '<button class="btn gh sm" data-det="' + esc(r.s.id) + '" data-t="vacaciones">Detalles</button>' }
      ], filasV, { vacio: 'No hay solicitudes de vacaciones en este periodo.' }) +

      '<div class="sec-row"><div><h2 class="sec-t">Mi banco de horas</h2>' +
        '<div class="fm-nota">Año natural: del 01-ENE-' + esc(anioBan) + ' al 31-DIC-' + esc(anioBan) + '</div></div>' +
        '<div class="field"><label for="pb">Año</label><select id="pb">' +
          opcionesB.map(y => '<option value="' + y + '"' + (y === anioBan ? ' selected' : '') + '>' + y + (y === anioActual ? ' (actual)' : '') + '</option>').join('') +
        '</select></div></div>' +
      tabla([
        { t: 'Folio', html: r => esc(r.s.id) + (r.anterior ? '<span class="chip in sm">Año anterior</span>' : '') },
        { t: 'Fecha de uso', v: r => fmt(r.s.fecha) },
        { t: 'Horario', v: r => horario(r.s) || '—' },
        { t: 'Horas', v: r => r.s.horas + ' h' },
        { t: 'Estado', html: r => chip(r.s.estado) },
        { t: '', html: r => '<button class="btn gh sm" data-det="' + esc(r.s.id) + '" data-t="banco">Detalles</button>' }
      ], filasB, { vacio: 'No hay solicitudes de banco de horas en este año.' });

    ZX.pie(main, 'El saldo se reserva al enviar la solicitud y se devuelve automáticamente si el aprobador la rechaza. Los días pendientes son los que sobraron del periodo anterior: se suman cuando tu jefe (o RRHH) los activa y se usan primero. El banco de horas vuelve a 12 h cada 1 de enero. Las solicitudes creadas en un periodo pero con fecha en el siguiente aparecen en ambos, con la etiqueta de periodo o año anterior.');
    $('#b-vac').addEventListener('click', ZX.formularios.vacaciones);
    $('#b-ban').addEventListener('click', ZX.formularios.banco);
    const pv = $('#pv'); if (pv) pv.addEventListener('change', e => { perVac = +e.target.value; perfil(); });
    $('#pb').addEventListener('change', e => { anioBan = e.target.value; perfil(); });
    enlazarDetalles(false);
  }

  /* ---------------------- POR APROBAR ---------------------- */
  let fTipo = 'todos', fEstado = 'pendiente';
  function aprobar() {
    const todo = D.sols.concat(D.banco).filter(s => s.aprobador === sesion.id);
    const f = todo.filter(s => (fTipo === 'todos' || s.tipo === fTipo) && (fEstado === 'todos' || s.estado === fEstado));
    main.innerHTML =
      head('Por aprobar', 'Solicitudes de las personas que te reportan') +
      '<div class="filters">' +
        '<div class="field"><label>Tipo</label><select id="ft">' + opts([['todos', 'Todos'], ['vacaciones', 'Vacaciones'], ['banco', 'Banco de horas']], fTipo) + '</select></div>' +
        '<div class="field"><label>Estado</label><select id="fe">' + opts([['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todos', 'Todos']], fEstado) + '</select></div>' +
      '</div>' +
      tabla([
        { t: 'Empleado', v: s => nombreDe(s.empleado) },
        { t: 'Tipo', v: s => s.tipo === 'banco' ? 'Banco' : 'Vacaciones' },
        { t: 'Fechas', v: s => s.tipo === 'banco' ? fmt(s.fecha) + (horario(s) ? ' ' + horario(s) : '') : fmt(s.inicio) + ' → ' + fmt(s.fin) },
        { t: 'Cantidad', v: s => s.tipo === 'banco' ? s.horas + ' h' : s.dias + ' días' },
        { t: 'Comentario', v: s => s.comentarioEmpleado || '—' },
        { t: 'Estado', html: s => chip(s.estado) },
        { t: 'Resuelta', v: s => s.estado === 'pendiente' ? '' : resuelta(s) },
        { t: '', html: s => s.estado !== 'pendiente' ? '' :
            '<div class="btn-row"><button class="btn ok sm" data-ok="' + esc(s.id) + '" data-t="' + esc(s.tipo) + '">Aprobar</button>' +
            '<button class="btn no sm" data-no="' + esc(s.id) + '" data-t="' + esc(s.tipo) + '">Rechazar</button></div>' }
      ], f, { vacio: 'No hay solicitudes con esos filtros.' });
    ZX.pie(main, 'Al rechazar una solicitud, los días u horas reservados se devuelven de inmediato al saldo del colaborador.');

    $('#ft').addEventListener('change', e => { fTipo = e.target.value; aprobar(); });
    $('#fe').addEventListener('change', e => { fEstado = e.target.value; aprobar(); });
    $$('[data-ok]').forEach(b => b.addEventListener('click', () => resolver(b.dataset.ok, b.dataset.t, 'aprobada')));
    $$('[data-no]').forEach(b => b.addEventListener('click', () => resolver(b.dataset.no, b.dataset.t, 'rechazada')));
  }

  function resolver(id, tipo, estado) {
    modal({
      titulo: (estado === 'aprobada' ? 'Aprobar' : 'Rechazar') + ' solicitud ' + id,
      cuerpo: '<div class="field"><label for="nota">Comentario para el colaborador</label>' +
              '<textarea id="nota" maxlength="300" placeholder="Opcional"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: estado === 'aprobada' ? 'Aprobar' : 'Rechazar', clase: estado === 'aprobada' ? 'ok' : 'no',
          accion: async (body) => {
            try {
              await API.vacaciones.resolver(id, tipo, estado, $('#nota', body).value);
              cerrarModal(); toast('Solicitud ' + estado + '.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ------------------------ MI EQUIPO ----------------------- */
  /* Horas de banco: las horas por reponer se restan (pueden dar negativo). */
  const netoHoras = e => (+e.horas || 0) - (+e.horasDeber || 0);
  const porActivar = e => (+e.diasPend || 0) > 0 && !e.pendActivos;
  function marcaEquipo() {                       // contador en el menú: personas con días pendientes por activar
    const b = $('.sb-subitem[data-vista="equipo"]'); if (!b) return;
    const viejo = b.querySelector('.chip'); if (viejo) viejo.remove();
    const n = D.emps.filter(e => e.jefe === sesion.id && porActivar(e)).length;
    if (n) b.insertAdjacentHTML('beforeend', '<span class="chip wa sm" style="margin-left:auto" title="Personas con días pendientes por activar">' + n + '</span>');
  }
  function equipo() {
    const mi = D.emps.filter(e => e.jefe === sesion.id);
    const porAct = mi.filter(porActivar).length;
    main.innerHTML =
      head('Mi equipo', mi.length + ' persona(s) a tu cargo' + (porAct ? ' · ' + porAct + ' con días pendientes por activar' : '')) +
      tabla([
        { t: 'Nº', k: 'id' },
        { t: 'Nombre', k: 'nombre' },
        { t: 'Puesto', k: 'puesto' },
        { t: 'Días disp.', v: e => e.dias + (e.pendActivos ? e.diasPend : 0) },
        { t: 'Pendientes', html: e => esc(e.diasPend || 0) + (e.diasPend > 0 ? (e.pendActivos ? ' <span class="chip ok sm">Activados</span>' : ' <span class="chip wa sm">Por activar</span>') : '') },
        { t: 'Banco', v: e => netoHoras(e) + ' h' },
        { t: 'Antigüedad', v: e => { const n = antiguedad(e.ingreso); return n + (n === 1 ? ' año' : ' años'); } },
        { t: 'En curso', html: e => enCurso(e.id) ? '<span class="chip in">De vacaciones</span>' : '<span class="chip nt">Activo</span>' },
        { t: '', html: e => porActivar(e) ? '<button class="btn ac sm" data-pend="' + esc(e.id) + '">Activar pendientes</button>' : '' }
      ], mi, { vacio: 'No tienes personal asignado.', filaAttr: e => porActivar(e) ? 'style="background:var(--wns)"' : '' });
    ZX.pie(main, 'La jerarquía se toma del campo "jefe" del registro de personal. Los días pendientes son los que a cada persona le sobraron del periodo anterior al cumplir su aniversario: al activarlos se suman a sus días disponibles y se usan primero.');
    $$('[data-pend]').forEach(b => b.addEventListener('click', () => {
      const e = emp(b.dataset.pend), disp = e.dias;
      ZX.confirmar('Activar días pendientes', '¿Activar los ' + e.diasPend + ' días pendientes de ' + e.nombre + '? Sus días disponibles pasarán de ' + disp + ' a ' + (disp + e.diasPend) + '. Al solicitar vacaciones se usarán primero estos días.', async () => {
        try { await API.empleados.activarPendientes(e.id); toast('Pendientes activados.', 'ok'); await refrescar(); }
        catch (ex) { toast(ex.message, 'no'); }
      });
    }));
  }
  function enCurso(empId) {
    return D.sols.some(s => s.empleado === empId && s.estado === 'aprobada' && s.inicio <= hoyISO() && s.fin >= hoyISO());
  }

  /* ------------------------ HISTORIAL ----------------------- */
  let hTipo = 'vacaciones', hMes = '', hAnio = String(new Date().getFullYear()), hDep = '';
  function historial() {
    const banco = hTipo === 'banco';
    const todo = banco ? D.banco : D.sols;
    const fechaDe = s => banco ? s.fecha : s.inicio;
    const f = todo.filter(s => {
      const fecha = fechaDe(s);
      if (hAnio && fecha.slice(0, 4) !== hAnio) return false;
      if (hMes && fecha.slice(5, 7) !== hMes) return false;
      if (hDep && departamentoDe(s.empleado) !== hDep) return false;
      return true;
    }).sort(byFechaDesc('creada'));

    const anios = Array.from(new Set(todo.map(s => fechaDe(s).slice(0, 4)).concat([String(new Date().getFullYear())]))).sort().reverse();
    if (hAnio && anios.indexOf(hAnio) < 0) hAnio = anios[0];
    const deps = Array.from(new Set(D.emps.map(e => e.departamento).filter(Boolean))).sort();
    const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    const base = [
      { t: 'Folio', k: 'id' },
      { t: 'Colaborador', v: s => nombreDe(s.empleado) },
      { t: 'Departamento', v: s => departamentoDe(s.empleado) }
    ];
    const especificas = banco
      ? [{ t: 'Fecha de uso', v: s => fmt(s.fecha) }, { t: 'Horario', v: s => horario(s) || '—' }, { t: 'Horas', v: s => s.horas + ' h' }]
      : [{ t: 'Fecha inicio', v: s => fmt(s.inicio) }, { t: 'Fecha fin', v: s => fmt(s.fin) }, { t: 'Días', v: s => s.dias }];
    const pantalla = base.concat(especificas, [
      { t: 'Estado', html: s => chip(s.estado) },
      { t: '', html: s => '<button class="btn gh sm" data-det="' + esc(s.id) + '" data-t="' + (banco ? 'banco' : 'vacaciones') + '">Detalles</button>' }
    ]);
    const csv = base.concat(especificas, [
      { t: 'Estado', v: s => s.estado },
      { t: 'Fecha de solicitud', v: s => fmtDT(s.creada) },
      { t: 'Comentario del empleado', v: s => s.comentarioEmpleado || '' },
      { t: 'Comentario de resolución', v: s => s.resolucion || '' },
      { t: 'Resuelta por', v: s => s.resueltoPor || '' },
      { t: 'Fecha de resolución', v: s => s.resuelta ? fmtDT(s.resuelta) : '' }
    ]);

    main.innerHTML =
      head('Historial', f.length + ' registro(s) de ' + (banco ? 'banco de horas' : 'vacaciones'),
        '<button class="btn gh" id="csv">⬇ Descargar CSV</button>') +
      '<div class="filters">' +
        '<div class="field"><label>Tipo</label><select id="h1">' + opts([['vacaciones', 'Vacaciones'], ['banco', 'Banco de horas']], hTipo) + '</select></div>' +
        '<div class="field"><label>Año</label><select id="h2">' + opts([['', 'Todos']].concat(anios.map(a => [a, a])), hAnio) + '</select></div>' +
        '<div class="field"><label>Mes</label><select id="h3">' + opts([['', 'Todos']].concat(MES.map((m, i) => [dos(i + 1), m])), hMes) + '</select></div>' +
        '<div class="field"><label>Departamento</label><select id="h4">' + opts([['', 'Todos']].concat(deps.map(d => [d, d])), hDep) + '</select></div>' +
      '</div>' +
      tabla(pantalla, f, { vacio: 'Sin registros con esos filtros.' });

    ZX.pie(main, ZX.esRRHH(sesion) || ZX.esAdmin(sesion)
      ? 'Incluye las solicitudes de todos los empleados, en cualquier estado. El CSV se genera con BOM UTF-8 para abrirse correctamente en Excel.'
      : 'Incluye las solicitudes de las personas que te reportan directamente y las tuyas, en cualquier estado. El CSV se genera con BOM UTF-8 para abrirse correctamente en Excel.');
    $('#h1').addEventListener('change', e => { hTipo = e.target.value; historial(); });
    $('#h2').addEventListener('change', e => { hAnio = e.target.value; historial(); });
    $('#h3').addEventListener('change', e => { hMes = e.target.value; historial(); });
    $('#h4').addEventListener('change', e => { hDep = e.target.value; historial(); });
    $('#csv').addEventListener('click', () => descargarCSV('Historial_' + (banco ? 'Banco_de_horas_' : 'Vacaciones_') + hoyISO() + '.csv', csv, f));
    enlazarDetalles(true);
  }

  /* ---------------- DETALLES DE UNA SOLICITUD ---------------- */
  function enlazarDetalles(conColaborador) {
    $$('[data-det]').forEach(b => b.addEventListener('click', () => {
      const lista = b.dataset.t === 'banco' ? D.banco : D.sols;
      const s = lista.find(x => x.id === b.dataset.det);
      if (s) detalle(s, conColaborador);
    }));
  }

  function detalle(s, conColaborador) {
    const banco = s.tipo === 'banco';
    const pendiente = s.estado === 'pendiente';
    const campo = (k, v, nota, ancho) =>
      '<div' + (ancho ? ' class="det-w"' : '') + '><div class="det-k">' + esc(k) + '</div><div class="det-v">' + v +
      (nota ? '<div class="det-nota">' + esc(nota) + '</div>' : '') + '</div></div>';
    const txt = (v, vacio) => v ? esc(v) : '<span class="det-v suave">' + esc(vacio || '—') + '</span>';
    const porResolver = 'Pendiente de resolución';

    const unidad = banco ? 'Horas' : 'Días';
    let notaSaldo = null;
    if (s.saldoDespues == null) notaSaldo = 'No disponible: solicitud del sistema anterior';
    else if (s.estado === 'rechazada') notaSaldo = banco ? 'Las horas fueron devueltas al rechazarse' : 'Los días fueron devueltos al rechazarse';
    const saldo = s.saldoDespues == null ? '—' : esc(s.saldoDespues) + (banco ? ' h' : '');

    const cuerpo =
      (conColaborador ? '<div class="det-w" style="margin-bottom:12px">' + campo('Colaborador', esc(nombreDe(s.empleado)) + ' <span class="det-v suave">· Nómina ' + esc(s.empleado) + '</span>', null, true) + '</div>' : '') +
      '<div class="det-grid">' +
        campo('Folio', esc(s.id)) +
        campo('Estado', chip(s.estado)) +
        campo('Fecha de solicitud', esc(fmtDT(s.creada))) +
        (pendiente ? campo('Aprobador', s.aprobador ? esc(nombreDe(s.aprobador)) : '<span class="det-v suave">Sin aprobador asignado</span>') : '') +
        (banco
          ? campo('Fecha de uso', esc(fmt(s.fecha))) + campo('Horario', horario(s) ? esc(horario(s).replace('–', ' – ')) : '<span class="det-v suave">Sin horario registrado</span>') +
            campo('Horas a tomar', esc(s.horas) + ' h')
          : campo('Fecha de inicio', esc(fmt(s.inicio))) + campo('Fecha de fin', esc(fmt(s.fin))) +
            campo('Días a tomar', esc(s.dias))) +
        campo(unidad + ' disponibles después de la solicitud', saldo, notaSaldo) +
        campo('Comentario del trabajador', txt(s.comentarioEmpleado, 'Sin comentario'), null, true) +
        campo('Comentario del jefe', pendiente ? '<span class="det-v suave">' + porResolver + '</span>' : txt(s.resolucion, 'Sin comentario'), null, true) +
        campo('Fecha de resolución', pendiente ? '<span class="det-v suave">' + porResolver + '</span>' : (s.resuelta ? esc(fmtDT(s.resuelta)) : '<span class="det-v suave">—</span>')) +
        campo('Resuelta por', pendiente ? '<span class="det-v suave">' + porResolver + '</span>' : txt(s.resueltoPor)) +
      '</div>';
    modal({ titulo: (banco ? 'Detalle del banco de horas' : 'Detalle de las vacaciones'), ancho: 'lg', cuerpo, botones: [{ txt: 'Cerrar', clase: 'gh' }] });
  }

  /* ------------------------ helpers ------------------------ */
  function head(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div>' +
           '<div class="btn-row">' + (acciones || '') + '</div></div>';
  }
  function k(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' +
           esc(v) + '</div><div class="kpi-d">' + esc(d) + '</div></div>';
  }
  function opts(pares, actual) {
    return pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(actual) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('');
  }
  function byFechaDesc(campo) { return (a, b) => String(b[campo]).localeCompare(String(a[campo])); }
})();

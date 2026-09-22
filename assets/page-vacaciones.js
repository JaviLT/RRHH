/* ============================================================
   Portal Zubex — Módulo Vacaciones y Banco de horas
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, chip, fmt, fmtLargo, hoyISO, iso, parse, sumaDias, diffDias,
          antiguedad, tabla, modal, cerrarModal, calendario, descargarCSV, MESES, DIAS } = window.ZX;
  const API = window.ZX_API;

  const sesion = ZX.requiereSesion('vacaciones');
  if (!sesion) return;

  const vistas = [
    { id: 'perfil',    nombre: 'Mi saldo',          ico: '👤' },
    { id: 'pendientes',nombre: 'Mis pendientes',    ico: '⏳' },
    { id: 'curso',     nombre: 'Vacaciones en curso',ico: '📆' },
    { id: 'historial', nombre: 'Historial',         ico: '📚' }
  ];
  if (ZX.esAprobador(sesion)) {
    vistas.splice(2, 0, { id: 'aprobar', nombre: 'Por aprobar', ico: '✅' });
    vistas.splice(3, 0, { id: 'equipo',  nombre: 'Mi equipo',   ico: '👥' });
  }

  const shell = ZX.montarShell('vacaciones', 'Vacaciones y banco de horas', vistas);
  const main = shell.main;

  let D = { emps: [], sols: [], banco: [], yo: null };
  const nombreDe = id => (D.emps.find(e => e.id === id) || {}).nombre || id;
  const deptoDe  = id => (D.emps.find(e => e.id === id) || {}).depto || '';

  async function recargar() {
    const [emps, sols, banco] = await Promise.all([
      API.empleados.lista(), API.vacaciones.solicitudes(), API.vacaciones.banco()
    ]);
    D = { emps, sols, banco, yo: emps.find(e => e.id === sesion.id) };
  }

  let vistaActual = 'perfil';
  ZX.bindVistas(v => { vistaActual = v; render(); });

  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); });

  async function refrescar() { await recargar(); render(); }

  function render() {
    ({ perfil, pendientes, aprobar, equipo, curso, historial }[vistaActual] || perfil)();
  }

  /* ------------------------ MI SALDO ------------------------ */
  function perfil() {
    const yo = D.yo;
    const disp = yo.dias + (yo.pendActivos ? yo.diasPend : 0);
    const mias = D.sols.filter(s => s.empleado === yo.id);
    const misB = D.banco.filter(s => s.empleado === yo.id);
    const usados = mias.filter(s => s.estado === 'aprobada').reduce((a, s) => a + s.dias, 0);

    main.innerHTML =
      head('Mi saldo', yo.puesto + ' · ' + yo.depto + ' · ' + antiguedad(yo.ingreso) + ' años en la empresa',
        '<button class="btn" id="b-vac">🌴 Solicitar vacaciones</button>' +
        '<button class="btn ac" id="b-ban">⏱️ Solicitar banco de horas</button>') +
      '<div class="grid g4">' +
        k('Días disponibles', disp, yo.pendActivos && yo.diasPend ? 'Incluye ' + yo.diasPend + ' pendientes activados' : 'Sin días pendientes activos') +
        k('Días tomados', usados, 'Solicitudes aprobadas') +
        k('Banco de horas', yo.horas + ' h', 'Disponibles') +
        k('Horas por reponer', yo.horasDeber + ' h', yo.horasDeber ? 'Acordadas con tu jefe' : 'Al corriente', yo.horasDeber ? 'dn' : 'gn') +
      '</div>' +
      '<h2 class="sec-t">Mis vacaciones</h2>' +
      tabla([
        { t: 'Folio', k: 'id' },
        { t: 'Inicio', v: s => fmt(s.inicio) },
        { t: 'Fin', v: s => fmt(s.fin) },
        { t: 'Días', k: 'dias' },
        { t: 'Estado', html: s => chip(s.estado) },
        { t: 'Resolución', v: s => s.resolucion || '—' }
      ], mias.sort(byFechaDesc('inicio')), { vacio: 'Aún no has solicitado vacaciones.' }) +
      '<h2 class="sec-t">Mi banco de horas</h2>' +
      tabla([
        { t: 'Folio', k: 'id' },
        { t: 'Fecha de uso', v: s => fmt(s.fecha) },
        { t: 'Horario', v: s => s.horaInicio + ' – ' + s.horaFin },
        { t: 'Horas', v: s => s.horas + ' h' },
        { t: 'Estado', html: s => chip(s.estado) },
        { t: 'Resolución', v: s => s.resolucion || '—' }
      ], misB.sort(byFechaDesc('fecha')), { vacio: 'Aún no has usado banco de horas.' });

    ZX.pie(main, 'El saldo se reserva al enviar la solicitud y se devuelve automáticamente si el aprobador la rechaza. Los días pendientes sólo se suman cuando Recursos Humanos los activa.');
    $('#b-vac').addEventListener('click', popupVacaciones);
    $('#b-ban').addEventListener('click', popupBanco);
  }

  /* --------------------- MIS PENDIENTES --------------------- */
  let filtroPend = 'todos';
  function pendientes() {
    const todo = D.sols.concat(D.banco).filter(s => s.empleado === sesion.id && s.estado === 'pendiente');
    const f = todo.filter(s => filtroPend === 'todos' || s.tipo === filtroPend);
    main.innerHTML =
      head('Mis pendientes', 'Solicitudes tuyas esperando resolución') +
      tabsHTML(filtroPend, [['todos', 'Todas'], ['vacaciones', '🌴 Vacaciones'], ['banco', '⏱️ Banco de horas']]) +
      '<div style="height:14px"></div>' +
      tabla([
        { t: 'Folio', k: 'id' },
        { t: 'Tipo', v: s => s.tipo === 'banco' ? 'Banco de horas' : 'Vacaciones' },
        { t: 'Fechas', v: s => s.tipo === 'banco' ? fmt(s.fecha) + ' ' + s.horaInicio + '–' + s.horaFin : fmt(s.inicio) + ' → ' + fmt(s.fin) },
        { t: 'Cantidad', v: s => s.tipo === 'banco' ? s.horas + ' h' : s.dias + ' días' },
        { t: 'Aprobador', v: s => nombreDe(s.aprobador) },
        { t: 'Enviada', v: s => fmt(s.creada) },
        { t: 'Estado', html: s => chip(s.estado) }
      ], f, { vacio: 'No tienes solicitudes pendientes.' });
    ZX.pie(main);
    bindTabs(v => { filtroPend = v; pendientes(); });
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
        { t: 'Fechas', v: s => s.tipo === 'banco' ? fmt(s.fecha) + ' ' + s.horaInicio + '–' + s.horaFin : fmt(s.inicio) + ' → ' + fmt(s.fin) },
        { t: 'Cantidad', v: s => s.tipo === 'banco' ? s.horas + ' h' : s.dias + ' días' },
        { t: 'Comentario', v: s => s.comentarioEmpleado || '—' },
        { t: 'Estado', html: s => chip(s.estado) },
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
  function equipo() {
    const mi = D.emps.filter(e => e.jefe === sesion.id);
    main.innerHTML =
      head('Mi equipo', mi.length + ' persona(s) a tu cargo') +
      tabla([
        { t: 'Nº', k: 'id' },
        { t: 'Nombre', k: 'nombre' },
        { t: 'Puesto', k: 'puesto' },
        { t: 'Días disp.', v: e => e.dias + (e.pendActivos ? e.diasPend : 0) },
        { t: 'Pendientes', k: 'diasPend' },
        { t: 'Banco', v: e => e.horas + ' h' },
        { t: 'Antigüedad', v: e => antiguedad(e.ingreso) + ' años' },
        { t: 'En curso', html: e => enCurso(e.id) ? '<span class="chip in">De vacaciones</span>' : '<span class="chip nt">Activo</span>' }
      ], mi, { vacio: 'No tienes personal asignado.' });
    ZX.pie(main, 'La jerarquía se toma del campo "jefe" del registro de personal. Los saldos ya descuentan las solicitudes enviadas.');
  }
  function enCurso(empId) {
    return D.sols.some(s => s.empleado === empId && s.estado === 'aprobada' && s.inicio <= hoyISO() && s.fin >= hoyISO());
  }

  /* ------------------ VACACIONES EN CURSO ------------------- */
  let semanaBase = null, fDepto = '';
  function curso() {
    if (!semanaBase) {
      const h = new Date(); h.setDate(h.getDate() - ((h.getDay() + 6) % 7));  // lunes
      semanaBase = iso(h);
    }
    const dias = []; for (let i = 0; i < 7; i++) dias.push(sumaDias(semanaBase, i));
    const ini = dias[0], fin = dias[6];
    const act = D.sols.filter(s => s.estado === 'aprobada' && !(s.fin < ini || s.inicio > fin));
    const deptos = Array.from(new Set(act.map(s => deptoDe(s.empleado)))).sort();
    const vis = act.filter(s => !fDepto || deptoDe(s.empleado) === fDepto);

    let filas = '';
    vis.sort((a, b) => nombreDe(a.empleado).localeCompare(nombreDe(b.empleado))).forEach(s => {
      filas += '<div class="wk-n" title="' + esc(deptoDe(s.empleado)) + '">' + esc(nombreDe(s.empleado)) + '</div>';
      dias.forEach(d => {
        const dentro = d >= s.inicio && d <= s.fin;
        const we = [0, 6].indexOf(parse(d).getDay()) >= 0;
        filas += '<div class="wk-c' + (we ? ' we' : '') + '">' + (dentro ? '<div class="wk-b"></div>' : '') + '</div>';
      });
    });

    main.innerHTML =
      head('Vacaciones en curso', 'Semana del ' + fmt(ini) + ' al ' + fmt(fin),
        '<div class="btn-row"><button class="btn gh sm" id="ant">‹ Anterior</button>' +
        '<button class="btn gh sm" id="hoy">Hoy</button>' +
        '<button class="btn gh sm" id="sig">Siguiente ›</button></div>') +
      '<div class="filters"><div class="field"><label>Departamento</label><select id="fd">' +
        opts([['', 'Todos']].concat(deptos.map(d => [d, d])), fDepto) + '</select></div></div>' +
      (vis.length
        ? '<div style="overflow-x:auto"><div class="wk">' +
            '<div class="wk-h">Colaborador</div>' +
            dias.map(d => '<div class="wk-h' + ([0, 6].indexOf(parse(d).getDay()) >= 0 ? ' we' : '') + '">' +
              esc(DIAS[parse(d).getDay()]) + '<br>' + parse(d).getDate() + '</div>').join('') +
            filas + '</div></div>'
        : '<div class="tbl-wrap"><div class="empty">Nadie del filtro seleccionado tiene vacaciones aprobadas en esta semana.</div></div>');

    ZX.pie(main, 'Sólo se muestran solicitudes en estado Aprobada que se traslapan con la semana visible. Las solicitudes pendientes no aparecen.');
    $('#ant').addEventListener('click', () => { semanaBase = sumaDias(semanaBase, -7); curso(); });
    $('#sig').addEventListener('click', () => { semanaBase = sumaDias(semanaBase, 7); curso(); });
    $('#hoy').addEventListener('click', () => { semanaBase = null; curso(); });
    $('#fd').addEventListener('change', e => { fDepto = e.target.value; curso(); });
  }

  /* ------------------------ HISTORIAL ----------------------- */
  let hTipo = 'todos', hMes = '', hAnio = String(new Date().getFullYear()), hDepto = '';
  function historial() {
    const todo = D.sols.concat(D.banco);
    const f = todo.filter(s => {
      const fecha = s.tipo === 'banco' ? s.fecha : s.inicio;
      if (hTipo !== 'todos' && s.tipo !== hTipo) return false;
      if (hAnio && fecha.slice(0, 4) !== hAnio) return false;
      if (hMes && fecha.slice(5, 7) !== hMes) return false;
      if (hDepto && deptoDe(s.empleado) !== hDepto) return false;
      return true;
    }).sort(byFechaDesc('creada'));

    const anios = Array.from(new Set(todo.map(s => (s.tipo === 'banco' ? s.fecha : s.inicio).slice(0, 4)))).sort().reverse();
    const deptos = Array.from(new Set(D.emps.map(e => e.depto))).sort();

    const cols = [
      { t: 'Folio', k: 'id' },
      { t: 'Tipo', v: s => s.tipo === 'banco' ? 'Banco de horas' : 'Vacaciones' },
      { t: 'Colaborador', v: s => nombreDe(s.empleado) },
      { t: 'Departamento', v: s => deptoDe(s.empleado) },
      { t: 'Fecha inicio', v: s => fmt(s.tipo === 'banco' ? s.fecha : s.inicio) },
      { t: 'Fecha fin', v: s => s.tipo === 'banco' ? s.horaFin : fmt(s.fin) },
      { t: 'Cantidad', v: s => s.tipo === 'banco' ? s.horas + ' h' : s.dias + ' d' },
      { t: 'Estado', v: s => s.estado }
    ];

    main.innerHTML =
      head('Historial', f.length + ' registro(s)', '<button class="btn gh" id="csv">⬇ Descargar CSV</button>') +
      '<div class="filters">' +
        '<div class="field"><label>Tipo</label><select id="h1">' + opts([['todos', 'Todos'], ['vacaciones', 'Vacaciones'], ['banco', 'Banco de horas']], hTipo) + '</select></div>' +
        '<div class="field"><label>Año</label><select id="h2">' + opts([['', 'Todos']].concat(anios.map(a => [a, a])), hAnio) + '</select></div>' +
        '<div class="field"><label>Mes</label><select id="h3">' + opts([['', 'Todos']].concat(MESES.map((m, i) => [String(i + 1).padStart(2, '0'), m])), hMes) + '</select></div>' +
        '<div class="field"><label>Departamento</label><select id="h4">' + opts([['', 'Todos']].concat(deptos.map(d => [d, d])), hDepto) + '</select></div>' +
      '</div>' +
      tabla(cols.slice(0, 7).concat([{ t: 'Estado', html: s => chip(s.estado) }]), f, { vacio: 'Sin registros con esos filtros.' });

    ZX.pie(main, 'Incluye vacaciones y banco de horas en cualquier estado. El CSV se genera con BOM UTF-8 para abrirse correctamente en Excel.');
    $('#h1').addEventListener('change', e => { hTipo = e.target.value; historial(); });
    $('#h2').addEventListener('change', e => { hAnio = e.target.value; historial(); });
    $('#h3').addEventListener('change', e => { hMes = e.target.value; historial(); });
    $('#h4').addEventListener('change', e => { hDepto = e.target.value; historial(); });
    $('#csv').addEventListener('click', () => descargarCSV('Historial_Vacaciones_' + hoyISO() + '.csv', cols, f));
  }

  /* --------------------- POPUP VACACIONES ------------------- */
  function popupVacaciones() {
    const yo = D.yo;
    const disp = yo.dias + (yo.pendActivos ? yo.diasPend : 0);
    const body = modal({
      titulo: 'Solicitar vacaciones',
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">Tienes <b>' + disp + '</b> días disponibles. Selecciona el rango en el calendario.</p>' +
        '<div id="cal"></div>' +
        '<div class="frow" style="margin-top:14px">' +
          '<div class="field"><label>Inicio</label><input id="i" readonly placeholder="—"></div>' +
          '<div class="field"><label>Fin</label><input id="f" readonly placeholder="—"></div>' +
          '<div class="field"><label>Días a tomar</label><input id="d" type="number" min="1" max="' + disp + '" step="1" value="1"></div>' +
        '</div>' +
        '<div class="field"><label>Comentario</label><textarea id="c" maxlength="300" placeholder="Motivo o detalles (opcional)"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Enviar solicitud', accion: async (b) => {
            const inicio = $('#i', b).value, fin = $('#f', b).value, dias = parseInt($('#d', b).value, 10);
            if (!inicio || !fin) return toast('Selecciona el rango de fechas.', 'wa');
            if (!dias || dias < 1) return toast('Indica cuántos días vas a tomar.', 'wa');
            try {
              await API.vacaciones.solicitar({ empleado: sesion.id, inicio, fin, dias, comentarioEmpleado: $('#c', b).value });
              cerrarModal(); toast('Solicitud enviada. Queda pendiente de aprobación.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    calendario($('#cal', body), {
      rango: true,
      onPick: (r) => {
        $('#i', body).value = r.inicio || '';
        $('#f', body).value = r.fin || '';
        if (r.inicio && r.fin) $('#d', body).value = Math.min(diffDias(r.inicio, r.fin), disp);
      }
    });
  }

  /* ------------------- POPUP BANCO DE HORAS ----------------- */
  function popupBanco() {
    const horas = [];
    for (let h = 6; h <= 20; h++) { horas.push(String(h).padStart(2, '0') + ':00'); horas.push(String(h).padStart(2, '0') + ':30'); }
    const body = modal({
      titulo: 'Solicitar banco de horas',
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">Tienes <b>' + D.yo.horas + ' h</b> disponibles.</p>' +
        '<div id="cal"></div>' +
        '<div class="frow" style="margin-top:14px">' +
          '<div class="field"><label>Fecha de uso</label><input id="f" readonly placeholder="—"></div>' +
          '<div class="field"><label>Hora de salida</label><select id="hi">' + horas.map(h => '<option>' + h + '</option>').join('') + '</select></div>' +
          '<div class="field"><label>Hora de regreso</label><select id="hf"></select></div>' +
        '</div>' +
        '<div class="field"><label>Comentario</label><textarea id="c" maxlength="300" placeholder="Opcional"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Enviar solicitud', accion: async (b) => {
            const fecha = $('#f', b).value, hi = $('#hi', b).value, hf = $('#hf', b).value;
            if (!fecha) return toast('Selecciona la fecha de uso.', 'wa');
            if (!hf) return toast('Selecciona la hora de regreso.', 'wa');
            const h = (min(hf) - min(hi)) / 60;
            try {
              await API.vacaciones.solicitarBanco({ empleado: sesion.id, fecha, horas: h, horaInicio: hi, horaFin: hf, comentarioEmpleado: $('#c', b).value });
              cerrarModal(); toast('Solicitud de banco de horas enviada.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    const min = t => (+t.slice(0, 2)) * 60 + (+t.slice(3));
    function syncFin() {
      const hi = $('#hi', body).value;
      // Sólo horas completas: mismo minuto que la salida
      const validas = horas.filter(h => min(h) > min(hi) && h.slice(3) === hi.slice(3));
      $('#hf', body).innerHTML = validas.map(h => '<option>' + h + '</option>').join('');
    }
    $('#hi', body).addEventListener('change', syncFin);
    syncFin();
    calendario($('#cal', body), { onPick: f => { $('#f', body).value = f; } });
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
  function opts(pares, sel) {
    return pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(sel) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('');
  }
  function tabsHTML(actual, pares) {
    return '<div class="tabs">' + pares.map(p =>
      '<button class="tab' + (p[0] === actual ? ' on' : '') + '" data-tab="' + esc(p[0]) + '">' + esc(p[1]) + '</button>').join('') + '</div>';
  }
  function bindTabs(cb) { $$('[data-tab]').forEach(b => b.addEventListener('click', () => cb(b.dataset.tab))); }
  function byFechaDesc(campo) { return (a, b) => String(b[campo]).localeCompare(String(a[campo])); }
})();

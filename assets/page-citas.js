/* ============================================================
   Portal Zubex — Módulo Citas médicas
   Empleado: consulta disponibilidad y agenda.
   Médico:   ve su agenda del día / semana.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, chip, fmt, fmtLargo, hoyISO, sumaDias, parse, iso, tabla, modal, cerrarModal, calendario, confirmar } = window.ZX;
  const API = window.ZX_API;

  const sesion = ZX.requiereSesion('citas');
  if (!sesion) return;
  const soyMedico = ZX.esClinico(sesion);

  const vistas = soyMedico
    ? [{ id: 'agenda', nombre: 'Agenda del médico', ico: '🗓️' }, { id: 'agendar', nombre: 'Agendar cita', ico: '➕' }, { id: 'mias', nombre: 'Mis citas', ico: '📋' }]
    : [{ id: 'agendar', nombre: 'Agendar cita', ico: '➕' }, { id: 'mias', nombre: 'Mis citas', ico: '📋' }];

  const shell = ZX.montarShell('citas', 'Citas con el servicio médico', vistas);
  const main = shell.main;

  let D = { emps: [], citas: [], agenda: null };
  const nombreDe = id => (D.emps.find(e => e.id === id) || {}).nombre || id;
  const deptoDe = id => (D.emps.find(e => e.id === id) || {}).depto || '';

  async function recargar() {
    const [emps, citas, agenda] = await Promise.all([API.empleados.lista(), API.citas.lista(), API.citas.agenda()]);
    D = { emps, citas, agenda };
  }

  let vista = vistas[0].id, fechaSel = null, horaSel = null;
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); });
  async function refrescar() { await recargar(); render(); }
  function render() { ({ agendar, mias, agenda: agendaMedico }[vista] || agendar)(); }

  /* ======================= AGENDAR ======================= */
  function agendar() {
    if (!fechaSel) fechaSel = proximoHabil(hoyISO());
    main.innerHTML =
      cab('Agendar cita', 'Servicio médico de empresa · ' + nombreDe(D.agenda.medico) + ' · consultas de ' + D.agenda.duracionMin + ' minutos') +
      '<div class="grid g2">' +
        '<div class="card"><div class="card-t">1. Elige el día</div><div id="cal"></div>' +
          '<p style="font-size:11.5px;color:var(--tx2);margin-top:10px">Atención de lunes a viernes. Los días sin servicio aparecen deshabilitados.</p></div>' +
        '<div class="card"><div class="card-t">2. Elige el horario</div><div id="slots"><div class="empty">Selecciona una fecha…</div></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-t">3. Confirma</div>' +
        '<div class="frow">' +
          '<div class="field"><label>Fecha seleccionada</label><input id="rf" readonly value=""></div>' +
          '<div class="field"><label>Hora seleccionada</label><input id="rh" readonly value=""></div>' +
        '</div>' +
        '<div class="field"><label for="motivo">Motivo de la consulta</label>' +
          '<input id="motivo" maxlength="150" placeholder="Ej. Revisión general, seguimiento, malestar"></div>' +
        '<button class="btn" id="ok" disabled>Confirmar cita</button>' +
      '</div>';

    ZX.pie(main, 'La disponibilidad se calcula con el horario del servicio médico menos las citas ya confirmadas y los bloqueos registrados. Una persona sólo puede tener una cita confirmada por día.');

    calendario($('#cal'), {
      valor: fechaSel, min: hoyISO(),
      deshabilitado: f => D.agenda.diasHabiles.indexOf(parse(f).getDay()) < 0,
      onPick: f => { fechaSel = f; horaSel = null; pintaSlots(); }
    });
    pintaSlots();
    $('#ok').addEventListener('click', confirmarCita);
  }

  async function pintaSlots() {
    const cont = $('#slots'); if (!cont) return;
    cont.innerHTML = '<div class="empty">Consultando disponibilidad…</div>';
    const d = await API.citas.disponibilidad(fechaSel);
    $('#rf').value = fmtLargo(fechaSel);
    $('#rh').value = '';
    $('#ok').disabled = true;

    if (!d.habil) { cont.innerHTML = '<div class="empty">El servicio médico no atiende ese día.</div>'; return; }
    if (d.bloqueo) { cont.innerHTML = '<div class="empty">Sin servicio: ' + esc(d.bloqueo) + '</div>'; return; }

    const libres = d.slots.filter(s => s.libre).length;
    cont.innerHTML =
      '<p style="font-size:12px;color:var(--tx2);margin-bottom:10px">' + libres + ' de ' + d.slots.length + ' horarios disponibles el ' + esc(fmt(fechaSel)) + '</p>' +
      '<div class="slots">' + d.slots.map(s =>
        '<button type="button" class="slot" data-h="' + esc(s.hora) + '"' + (s.libre ? '' : ' disabled') + '>' + esc(s.hora) + '</button>').join('') + '</div>';

    $$('.slot[data-h]', cont).forEach(b => b.addEventListener('click', () => {
      $$('.slot', cont).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      horaSel = b.dataset.h;
      $('#rh').value = horaSel + ' h';
      $('#ok').disabled = false;
    }));
  }

  async function confirmarCita() {
    const motivo = $('#motivo').value.trim();
    if (!fechaSel || !horaSel) return toast('Selecciona fecha y hora.', 'wa');
    if (!motivo) return toast('Escribe el motivo de la consulta.', 'wa');
    try {
      await API.citas.agendar({ empleado: sesion.id, fecha: fechaSel, hora: horaSel, motivo });
      toast('Cita confirmada para el ' + fmt(fechaSel) + ' a las ' + horaSel + '.', 'ok');
      horaSel = null; vista = 'mias';
      $$('.sb-item[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === 'mias'));
      await refrescar();
    } catch (e) { toast(e.message, 'no'); }
  }

  /* ======================== MIS CITAS ======================== */
  function mias() {
    const c = D.citas.filter(x => x.empleado === sesion.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const prox = c.filter(x => x.estado === 'confirmada' && x.fecha >= hoyISO());
    main.innerHTML =
      cab('Mis citas', prox.length ? 'Tienes ' + prox.length + ' cita(s) por delante' : 'No tienes citas próximas',
          '<button class="btn" id="nueva">＋ Agendar cita</button>') +
      tabla([
        { t: 'Folio', k: 'id' },
        { t: 'Fecha', v: x => fmtLargo(x.fecha) },
        { t: 'Hora', k: 'hora' },
        { t: 'Motivo', k: 'motivo' },
        { t: 'Estado', html: x => chip(x.estado) },
        { t: '', html: x => (x.estado === 'confirmada' && x.fecha >= hoyISO())
            ? '<button class="btn gh sm" data-cancel="' + esc(x.id) + '">Cancelar</button>' : '' }
      ], c, { vacio: 'Todavía no has agendado ninguna cita.' });
    ZX.pie(main, 'Cancela con al menos 24 horas de anticipación para liberar el horario a otro colaborador.');

    $('#nueva').addEventListener('click', () => { vista = 'agendar'; $$('.sb-item[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === 'agendar')); render(); });
    $$('[data-cancel]').forEach(b => b.addEventListener('click', () => {
      confirmar('Cancelar cita', '¿Seguro que quieres cancelar la cita ' + b.dataset.cancel + '? El horario quedará libre para alguien más.', async () => {
        try { await API.citas.cancelar(b.dataset.cancel, 'Cancelada por el colaborador'); toast('Cita cancelada.', 'ok'); await refrescar(); }
        catch (e) { toast(e.message, 'no'); }
      });
    }));
  }

  /* ==================== AGENDA DEL MÉDICO ==================== */
  let diaAgenda = null;
  function agendaMedico() {
    if (!diaAgenda) diaAgenda = hoyISO();
    const dia = D.citas.filter(c => c.fecha === diaAgenda && c.estado !== 'cancelada').sort((a, b) => a.hora.localeCompare(b.hora));
    const semana = D.citas.filter(c => c.fecha >= hoyISO() && c.fecha <= sumaDias(hoyISO(), 6) && c.estado === 'confirmada');

    main.innerHTML =
      cab('Agenda del médico', fmtLargo(diaAgenda),
        '<div class="btn-row"><button class="btn gh sm" id="a">‹ Día anterior</button>' +
        '<button class="btn gh sm" id="h">Hoy</button><button class="btn gh sm" id="s">Día siguiente ›</button></div>') +
      '<div class="grid g4">' +
        k('Citas del día', dia.length, 'Confirmadas y atendidas') +
        k('Próximos 7 días', semana.length, 'Citas confirmadas') +
        k('Horarios del día', D.agenda.horarios.length, 'Capacidad instalada') +
        k('Ocupación', Math.round(dia.length / D.agenda.horarios.length * 100) + '%', 'Del día seleccionado',
          (dia.length / D.agenda.horarios.length) > 0.8 ? 'dn' : 'gn') +
      '</div>' +
      '<h2 class="sec-t">Citas del día</h2>' +
      tabla([
        { t: 'Hora', k: 'hora' },
        { t: 'Colaborador', v: c => nombreDe(c.empleado) },
        { t: 'Departamento', v: c => deptoDe(c.empleado) },
        { t: 'Motivo', k: 'motivo' },
        { t: 'Estado', html: c => chip(c.estado) },
        { t: '', html: c => c.estado === 'confirmada'
            ? '<a class="btn sm" href="medico.html">Abrir expediente</a>' : '' }
      ], dia, { vacio: 'Sin citas agendadas para este día.' }) +
      '<h2 class="sec-t">Próximos 7 días</h2>' +
      tabla([
        { t: 'Fecha', v: c => fmtLargo(c.fecha) },
        { t: 'Hora', k: 'hora' },
        { t: 'Colaborador', v: c => nombreDe(c.empleado) },
        { t: 'Motivo', k: 'motivo' }
      ], semana.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)), { vacio: 'Sin citas en la semana.' });

    ZX.pie(main, 'La ocupación compara las citas del día contra los horarios configurados en la agenda del servicio médico.');
    $('#a').addEventListener('click', () => { diaAgenda = sumaDias(diaAgenda, -1); agendaMedico(); });
    $('#s').addEventListener('click', () => { diaAgenda = sumaDias(diaAgenda, 1); agendaMedico(); });
    $('#h').addEventListener('click', () => { diaAgenda = hoyISO(); agendaMedico(); });
  }

  /* ========================= helpers ========================= */
  function proximoHabil(f) {
    let x = f;
    for (let i = 0; i < 10; i++) {
      if (D.agenda.diasHabiles.indexOf(parse(x).getDay()) >= 0) return x;
      x = sumaDias(x, 1);
    }
    return f;
  }
  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
  function k(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) +
           '</div><div class="kpi-d">' + esc(d) + '</div></div>';
  }
})();

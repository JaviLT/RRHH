/* ============================================================
   Portal Zubex — Calendario
   Quién está fuera: vacaciones (por semana) y banco de horas (por día).
   Sólo con sesión iniciada. Lee las tablas mínimas calendario_vacaciones y
   calendario_banco —nombre, departamento y fechas de lo APROBADO— y se
   actualiza solo cuando se aprueba una solicitud (tiempo real; si esa
   conexión no se logra, se refresca cada 30 s).
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, fmt, hoyISO, iso, parse, sumaDias, modal, cerrarModal, calendario, tabla, DIAS, MESES } = window.ZX;
  const API = window.ZX_API;

  const sesion = ZX.requiereSesion('calendario');
  if (!sesion) return;
  const shell = ZX.montarShell('calendario', 'Calendario', []);
  const main = shell.main;

  let vista = 'vacaciones';                       // 'vacaciones' | 'banco'
  let fDep = '';
  let departamentos = [];
  let datosV = null, datosB = null;               // null = todavía cargando
  let peticion = 0;                               // descarta respuestas viejas si se navega rápido

  const lunesDe = f => { const d = parse(f); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  let semanaBase = lunesDe(hoyISO());
  let diaBanco = hoyISO();
  const finde = f => [0, 6].indexOf(parse(f).getDay()) >= 0;
  const minDe = t => (+t.slice(0, 2)) * 60 + (+t.slice(3));
  const DIA3 = i => DIAS[i].slice(0, 3).toUpperCase();

  /* ------------------------ datos ------------------------ */
  async function cargar() {
    const t = ++peticion;
    if (vista === 'vacaciones') {
      const fin = sumaDias(semanaBase, 6);
      // un día de margen a cada lado para saber si una barra continúa fuera de la semana
      const d = await API.calendario.vacaciones(sumaDias(semanaBase, -1), sumaDias(fin, 1));
      if (t === peticion) datosV = d;
    } else {
      const d = await API.calendario.banco(diaBanco);
      if (t === peticion) datosB = d;
    }
    return t === peticion;
  }
  async function actualizar() { if (await cargar()) pinta(); }

  /* ------------------------ pantalla ------------------------ */
  function encabezado(subtitulo, textoPicker, ant, hoy, sig) {
    const deps = departamentos.length ? departamentos
      : Array.from(new Set(((vista === 'vacaciones' ? datosV : datosB) || []).map(r => r.departamento).filter(Boolean))).sort();
    return '<div class="cal-head"><h1 class="page-t">Calendario</h1>' +
        '<div class="field"><label for="fd">Departamento</label><select id="fd"><option value="">Todos</option>' +
          deps.map(d => '<option value="' + esc(d) + '"' + (d === fDep ? ' selected' : '') + '>' + esc(d) + '</option>').join('') + '</select></div>' +
      '</div>' +
      '<div class="tabs" style="margin-top:14px;width:max-content;max-width:100%">' +
        '<button class="tab' + (vista === 'vacaciones' ? ' on' : '') + '" data-tab="vacaciones">🌴 Vacaciones</button>' +
        '<button class="tab' + (vista === 'banco' ? ' on' : '') + '" data-tab="banco">⏱️ Banco de horas</button>' +
      '</div>' +
      '<div class="cal-bar"><div class="page-sub" style="margin:0;font-size:13.5px;font-weight:600;color:var(--tx)">' + esc(subtitulo) + '</div>' +
        '<div class="btn-row"><button class="btn gh sm" id="ant">‹ ' + esc(ant) + '</button>' +
          '<button class="btn gh sm" id="hoy">' + esc(hoy) + '</button>' +
          '<button class="btn gh sm" id="sig">' + esc(sig) + ' ›</button>' +
          '<button class="btn sm" id="pick" title="Elegir en el calendario">📅 ' + esc(textoPicker) + '</button></div></div>';
  }

  function pinta() {
    if (vista === 'vacaciones') pintaVacaciones(); else pintaBanco();
    $('#fd').addEventListener('change', e => { fDep = e.target.value; pinta(); });
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => { vista = b.dataset.tab; if (vista === 'vacaciones') datosV = null; else datosB = null; pinta(); actualizar(); }));
  }

  /* ---- Vacaciones: una fila por persona; los días seguidos forman una sola barra ---- */
  function pintaVacaciones() {
    const dias = []; for (let i = 0; i < 7; i++) dias.push(sumaDias(semanaBase, i));
    const ext = [sumaDias(semanaBase, -1)].concat(dias, [sumaDias(semanaBase, 7)]);   // 9 días: semana + margen
    const hoy = hoyISO();

    const porPersona = {};
    (datosV || []).filter(r => !fDep || r.departamento === fDep).forEach(r => {
      (porPersona[r.empleado] = porPersona[r.empleado] || { nombre: r.nombre, departamento: r.departamento, rangos: [] }).rangos.push(r);
    });
    const personas = Object.keys(porPersona).map(id => {
      const p = porPersona[id];
      const cubierto = new Set();
      ext.forEach(d => { if (p.rangos.some(r => d >= r.inicio && d <= r.fin)) cubierto.add(d); });
      const barras = [];
      for (let i = 0; i < 7; ) {
        if (!cubierto.has(dias[i])) { i++; continue; }
        let j = i; while (j + 1 < 7 && cubierto.has(dias[j + 1])) j++;
        barras.push({ a: i, b: j, ci: i === 0 && cubierto.has(ext[0]), cd: j === 6 && cubierto.has(ext[8]) });
        i = j + 1;
      }
      return { nombre: p.nombre, departamento: p.departamento, barras };
    }).filter(p => p.barras.length).sort((a, b) => a.nombre.localeCompare(b.nombre));

    let g = '<div class="cw-h nm" style="grid-row:1;grid-column:1">Nombre</div>';
    dias.forEach((d, i) => {
      g += '<div class="cw-h' + (finde(d) ? ' we' : '') + (d === hoy ? ' hoy' : '') + '" style="grid-row:1;grid-column:' + (i + 2) + '">' +
        esc(DIA3(parse(d).getDay())) + '<br>' + parse(d).getDate() + '</div>';
    });
    personas.forEach((p, ri) => {
      const r = ri + 2;
      g += '<div class="cw-n" style="grid-row:' + r + ';grid-column:1" title="' + esc(p.departamento || '') + '">' + esc(p.nombre) + '</div>';
      dias.forEach((d, i) => { g += '<div class="cw-c' + (finde(d) ? ' we' : '') + '" style="grid-row:' + r + ';grid-column:' + (i + 2) + '"></div>'; });
      p.barras.forEach(b => {
        const tip = p.nombre + ' · ' + fmt(dias[b.a]) + (b.a !== b.b ? ' → ' + fmt(dias[b.b]) : '') +
          (b.ci ? ' (viene de la semana anterior)' : '') + (b.cd ? ' (continúa la semana siguiente)' : '');
        g += '<div class="cw-bar' + (b.ci ? ' ci' : '') + (b.cd ? ' cd' : '') + '" style="grid-row:' + r + ';grid-column:' + (b.a + 2) + ' / ' + (b.b + 3) + '" title="' + esc(tip) + '">' +
          '<span>' + (b.ci ? '◂' : '') + '</span><span>' + (b.cd ? '▸' : '') + '</span></div>';
      });
    });

    main.innerHTML =
      encabezado('Semana del ' + fmt(dias[0]) + ' al ' + fmt(dias[6]), 'Elegir semana', 'Anterior', 'Hoy', 'Siguiente') +
      (datosV === null ? '<div class="tbl-wrap"><div class="empty">Cargando…</div></div>' : personas.length
        ? '<div class="cw-wrap"><div class="cw">' + g + '</div></div>'
        : '<div class="tbl-wrap"><div class="empty">' + (fDep ? 'Nadie de ese departamento tiene vacaciones aprobadas en esta semana.' : 'Nadie tiene vacaciones aprobadas en esta semana.') + '</div></div>');
    ZX.pie(main, 'Sólo se muestran vacaciones aprobadas que coinciden con la semana visible; las solicitudes pendientes no aparecen. Los días seguidos se unen en una sola barra y una flecha indica que continúa en otra semana. Se actualiza sola cuando se aprueba una solicitud.');

    $('#ant').addEventListener('click', () => { semanaBase = sumaDias(semanaBase, -7); irASemana(); });
    $('#sig').addEventListener('click', () => { semanaBase = sumaDias(semanaBase, 7); irASemana(); });
    $('#hoy').addEventListener('click', () => { semanaBase = lunesDe(hoyISO()); irASemana(); });
    $('#pick').addEventListener('click', () => elegirFecha('Elegir semana', semanaBase, f => { semanaBase = lunesDe(f); irASemana(); }));
  }
  function irASemana() { datosV = null; pinta(); actualizar(); }

  /* ---- Banco de horas: un día, una tabla ---- */
  function textoHorario(r) {
    if (!r.horaInicio) return '<span style="color:var(--tx3)">Sin horario registrado</span>';
    const ini = minDe(r.horaInicio), fin = minDe(r.horaFin || '00:00');
    const dur = ((fin - ini) + 1440) % 1440;
    // "día siguiente" sólo si el horario cruza la medianoche de forma coherente con las horas; si no, se muestra tal cual viene
    const cruza = fin < ini && r.horas > 0 && Math.abs(dur / 60 - r.horas) < 0.01;
    return esc(r.horaInicio + ' – ' + r.horaFin) + (cruza ? ' <span style="color:var(--tx3)">(día siguiente)</span>' : '');
  }
  function pintaBanco() {
    const porPersona = {};
    (datosB || []).filter(r => !fDep || r.departamento === fDep).forEach(r => {
      (porPersona[r.empleado] = porPersona[r.empleado] || { nombre: r.nombre, registros: [] }).registros.push(r);
    });
    const filas = Object.keys(porPersona).map(id => {
      const p = porPersona[id];
      p.registros.sort((a, b) => (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99'));
      const horas = p.registros.reduce((a, r) => a + (r.horas > 0 ? +r.horas : 0), 0);
      const primero = p.registros.find(r => r.horaInicio);
      return { nombre: p.nombre, registros: p.registros, horas, orden: primero ? minDe(primero.horaInicio) : 9999 };
    }).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

    main.innerHTML =
      encabezado(fmtDia(diaBanco), 'Elegir día', 'Día anterior', 'Hoy', 'Día siguiente') +
      (datosB === null ? '<div class="tbl-wrap"><div class="empty">Cargando…</div></div>' : tabla([
        { t: 'Nombre', k: 'nombre' },
        { t: 'Horario', html: f => f.registros.map(textoHorario).join('<br>') },
        { t: 'Horas', v: f => f.horas > 0 ? f.horas + ' h' : '—' }
      ], filas, { vacio: fDep ? 'Nadie de ese departamento tiene banco de horas aprobado este día.' : 'Nadie tiene banco de horas aprobado este día.' }));
    ZX.pie(main, 'Sólo se muestran solicitudes de banco de horas aprobadas para el día elegido, ordenadas por hora de inicio. Se actualiza sola cuando se aprueba una solicitud.');

    $('#ant').addEventListener('click', () => { diaBanco = sumaDias(diaBanco, -1); irADia(); });
    $('#sig').addEventListener('click', () => { diaBanco = sumaDias(diaBanco, 1); irADia(); });
    $('#hoy').addEventListener('click', () => { diaBanco = hoyISO(); irADia(); });
    $('#pick').addEventListener('click', () => elegirFecha('Elegir día', diaBanco, f => { diaBanco = f; irADia(); }));
  }
  function irADia() { datosB = null; pinta(); actualizar(); }
  const fmtDia = f => { const d = parse(f); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); };

  /* ---- Selector de fecha en un popup, con el mismo calendario de los formularios ---- */
  function elegirFecha(titulo, valor, alElegir) {
    const body = modal({ titulo, cuerpo: '<div id="cal-pick"></div>', botones: [{ txt: 'Cancelar', clase: 'gh' }] });
    calendario($('#cal-pick', body), { valor, onPick: f => { cerrarModal(); alElegir(f); } });
  }

  /* ------------------------ arranque ------------------------ */
  ZX.arranque(async function () {
    ZX.cargando(main);
    try { departamentos = (await API.empleados.catalogos()).departamentos; } catch (e) { departamentos = []; }
    await cargar();
    pinta();
    // Tiempo real: cuando se aprueba (o cambia) una solicitud se vuelve a leer lo visible. Varios avisos seguidos cuentan como uno.
    let espera = null;
    API.calendario.suscribir(() => { clearTimeout(espera); espera = setTimeout(actualizar, 250); });
  });
})();

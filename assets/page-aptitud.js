/* ============================================================
   Portal Zubex — Aptitud y restricciones laborales
   ------------------------------------------------------------
   Vista para Seguridad Industrial (perfil Vigilancia).
   Muestra ÚNICAMENTE lo necesario para prevención en el puesto:
   dictamen de aptitud, restricciones, recomendaciones y fecha de
   próxima valoración. NUNCA diagnósticos, tratamientos,
   antecedentes ni notas clínicas.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, fmt, fmtLargo, hoyISO, sumaDias, tabla, descargarCSV, toast } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;

  const sesion = ZX.requiereSesion('aptitud');
  if (!sesion) return;

  /* Acceso pleno (planta completa) si el PERFIL lo otorga (medico o
     vigilancia — incluye a alguien que a la vez es Jefe de Seguridad
     Industrial: nivel supervisor + perfil vigilancia). Sin ese perfil, un
     supervisor sólo ve la restricción operativa de su propio equipo. */
  const accesoPleno = ['medico', 'vigilancia'].indexOf(sesion.perfil) >= 0;
  const soloEquipo = !accesoPleno && sesion.nivel === 'supervisor';

  const vistas = soloEquipo
    ? [{ id: 'restricciones', nombre: 'Restricciones de mi equipo', ico: '⛔' }]
    : [{ id: 'tablero', nombre: 'Aptitud del personal', ico: '🦺' },
       { id: 'restricciones', nombre: 'Restricciones vigentes', ico: '⛔' },
       { id: 'eventos', nombre: 'Eventos por área', ico: '🏭' }];
  const shell = ZX.montarShell('aptitud', 'Aptitud laboral y restricciones', vistas);
  const main = shell.main;

  let D = null, vista = (soloEquipo ? 'restricciones' : 'tablero');
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await cargar(); render(); });

  async function cargar() {
    const [emps, evals, riesgos] = await Promise.all([
      API.empleados.lista(), API.medico.evaluaciones(), API.medico.riesgos()
    ]);
    const vigilancia = await Promise.all(emps.map(e => API.medico.vigilancia(e.id)));
    /* Se arma una proyección "no clínica": de la evaluación sólo se toman
       dictamen, vigencia y restricciones; nunca hallazgos ni estudios. */
    const filas = emps.filter(e => e.estatus !== 'baja')
      /* El jefe sólo ve a quienes le reportan */
      .filter(e => !soloEquipo || e.jefe === sesion.id)
      .map((e, i) => {
      const ev = evals.filter(x => x.empleado === e.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      const v = vigilancia[emps.indexOf(e)] || {};
      return {
        id: e.id, nombre: e.nombre, depto: e.depto, area: e.area, turno: e.turno, puesto: e.puesto,
        dictamen: ev ? ev.dictamen : '', fechaDictamen: ev ? ev.fecha : '', vigencia: ev ? ev.vigencia : '',
        restricciones: (ev && ev.restricciones) || v.restricciones || '',
        recomendaciones: v.recomendaciones || '',
        programa: v.programa || '', periodicidad: v.periodicidad || '',
        proximaValoracion: v.proximaValoracion || ''
      };
    });
    D = { filas, riesgos, emps };
    API.auditoria.registrar('aptitud.consultar', '', '', 'Consulta del tablero de aptitud y restricciones');
  }

  const AVISO_JEFE =
    '<div class="priv">🔐 <div><b>Alcance para jefaturas.</b> Aquí sólo aparecen las personas que te reportan y ' +
    'únicamente la <b>medida operativa</b> que debes garantizar en el puesto. No verás el dictamen médico, el ' +
    'diagnóstico ni la causa de la restricción, y no corresponde solicitarlos al servicio médico. ' +
    'Tu responsabilidad es que la restricción se respete en la operación.</div></div>';

  const AVISO =
    '<div class="priv">🔐 <div><b>Alcance de esta pantalla.</b> Aquí sólo se muestra la información necesaria para la prevención ' +
    'en el puesto: aptitud, restricciones, recomendaciones y fechas de valoración. El diagnóstico, el tratamiento y los ' +
    'antecedentes clínicos no son visibles para este perfil y no deben solicitarse al servicio médico. ' +
    'Si necesitas entender una restricción, pídele al médico la <b>medida operativa</b>, no la causa médica.</div></div>';

  function render() {
    if (soloEquipo) return restricciones();
    ({ tablero, restricciones, eventos }[vista] || tablero)();
  }

  const nombreDic = c => { const x = CAT.dictamenes.find(d => d.c === c); return x ? x.n : 'Sin evaluación'; };
  function chipDic(c) {
    const m = { apto: 'ok', apto_con_restricciones: 'wa', no_apto: 'no', pendiente: 'nt' };
    return '<span class="chip ' + (m[c] || 'nt') + '">' + esc(nombreDic(c)) + '</span>';
  }

  /* ---------------------- TABLERO ---------------------- */
  let q = '', fDic = '';
  function tablero() {
    const lista = D.filas.filter(f =>
      (!fDic || f.dictamen === fDic) &&
      (!q || (f.nombre + ' ' + f.id + ' ' + f.depto + ' ' + (f.area || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0));
    const conRestr = D.filas.filter(f => f.restricciones && f.restricciones.toLowerCase() !== 'ninguna');
    const vencidos = D.filas.filter(f => f.vigencia && f.vigencia < hoyISO());
    const sinEval = D.filas.filter(f => !f.dictamen);
    const cols = [
      { t: 'Nº', k: 'id' }, { t: 'Colaborador', k: 'nombre' }, { t: 'Puesto', k: 'puesto' },
      { t: 'Área', k: 'area' }, { t: 'Turno', k: 'turno' },
      { t: 'Dictamen', v: f => nombreDic(f.dictamen) },
      { t: 'Vigencia', v: f => f.vigencia ? fmt(f.vigencia) : '' },
      { t: 'Restricciones', k: 'restricciones' }
    ];

    main.innerHTML =
      cab('Aptitud del personal', D.filas.length + ' colaboradores activos', '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO +
      '<div class="grid g4">' +
        k('Aptos', D.filas.filter(f => f.dictamen === 'apto').length, 'Sin restricciones', 'gn') +
        k('Con restricciones', conRestr.length, 'Requieren ajuste en el puesto', conRestr.length ? 'wn' : 'gn') +
        k('Dictamen vencido', vencidos.length, 'Requieren nueva valoración', vencidos.length ? 'dn' : 'gn') +
        k('Sin evaluación', sinEval.length, 'Nunca valorados', sinEval.length ? 'wn' : 'gn') +
      '</div>' +
      '<div class="filters" style="margin-top:14px">' +
        '<div class="field" style="min-width:250px"><label>Buscar</label>' +
          '<input id="q" value="' + esc(q) + '" placeholder="Nombre, número, departamento o área"></div>' +
        '<div class="field"><label>Dictamen</label><select id="fd">' +
          [['', 'Todos']].concat(CAT.dictamenes.map(d => [d.c, d.n])).map(p =>
            '<option value="' + esc(p[0]) + '"' + (p[0] === fDic ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      tabla(cols.slice(0, 5).concat([
        { t: 'Dictamen', html: f => chipDic(f.dictamen) },
        { t: 'Vigencia', html: f => !f.vigencia ? '—'
            : f.vigencia < hoyISO() ? '<span class="chip no">Vencido ' + esc(fmt(f.vigencia)) + '</span>'
            : f.vigencia <= sumaDias(hoyISO(), 60) ? '<span class="chip wa">' + esc(fmt(f.vigencia)) + '</span>'
            : '<span class="chip ok">' + esc(fmt(f.vigencia)) + '</span>' },
        { t: 'Restricciones', v: f => f.restricciones || 'Ninguna' }
      ]), lista, { vacio: 'Sin coincidencias.' });

    ZX.pie(main, 'El dictamen y la restricción provienen de la última evaluación de salud registrada por el servicio médico. Un dictamen vencido no significa que el colaborador sea no apto: significa que corresponde volver a valorarlo.');
    const qi = $('#q');
    qi.addEventListener('input', () => { q = qi.value; const p = qi.selectionStart; tablero(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $('#fd').addEventListener('change', e => { fDic = e.target.value; tablero(); });
    $('#csv').addEventListener('click', () => descargarCSV('Aptitud_Personal_' + hoyISO() + '.csv', cols, lista));
  }

  /* ------------------ RESTRICCIONES ------------------ */
  function restricciones() {
    const lista = D.filas.filter(f => f.restricciones && f.restricciones.toLowerCase() !== 'ninguna');
    main.innerHTML =
      cab(soloEquipo ? 'Restricciones de mi equipo' : 'Restricciones vigentes',
          soloEquipo
            ? lista.length + ' de ' + D.filas.length + ' personas de tu equipo con restricción activa'
            : lista.length + ' colaboradores con restricción activa') +
      (soloEquipo ? AVISO_JEFE : AVISO) +
      (lista.length ? lista.map(f =>
        '<div class="card"><div class="card-t"><span>' + esc(f.nombre) + ' · ' + esc(f.puesto) + '</span>' +
          (soloEquipo ? '<span class="chip wa">Con restricción</span>' : chipDic(f.dictamen)) + '</div>' +
        '<div class="frow">' +
          ro('Área', f.area) + ro('Turno', f.turno) + ro('Departamento', f.depto) +
          (soloEquipo ? '' : ro('Vigencia del dictamen', f.vigencia ? fmt(f.vigencia) : '—')) +
          ro('Próxima valoración', f.proximaValoracion ? fmt(f.proximaValoracion) : '—') +
        '</div>' +
        '<div class="field"><label>Restricción laboral</label>' +
          '<div style="font-size:13px;font-weight:600;color:var(--wnt)">' + esc(f.restricciones) + '</div></div>' +
        ((f.recomendaciones && !soloEquipo) ? '<div class="field"><label>Recomendaciones</label>' +
          '<div style="font-size:13px">' + esc(f.recomendaciones) + '</div></div>' : '') +
        '</div>').join('')
        : '<div class="tbl-wrap"><div class="empty">' +
          (soloEquipo ? 'Nadie de tu equipo tiene restricciones laborales vigentes.'
                      : 'Ningún colaborador tiene restricciones vigentes.') + '</div></div>');

    ZX.pie(main, 'Las restricciones describen la limitación operativa (qué no debe hacer la persona en su puesto), nunca la condición médica que la origina. Es responsabilidad del jefe de área garantizar que la restricción se respete.');
  }

  /* ------------------ EVENTOS POR ÁREA ------------------ */
  function eventos() {
    const anio = String(new Date().getFullYear());
    const delAnio = D.riesgos.filter(r => r.fecha.slice(0, 4) === anio);
    const grupos = {};
    D.filas.forEach(f => {
      const kk = (f.area || '—') + ' · ' + (f.turno || '—');
      if (!grupos[kk]) grupos[kk] = { etiqueta: kk, area: f.area, turno: f.turno, personas: 0, eventos: 0, restringidos: 0 };
      grupos[kk].personas++;
      if (f.restricciones && f.restricciones.toLowerCase() !== 'ninguna') grupos[kk].restringidos++;
    });
    delAnio.forEach(r => {
      const e = D.emps.find(x => x.id === r.empleado); if (!e) return;
      const kk = (e.area || '—') + ' · ' + (e.turno || '—');
      if (grupos[kk]) grupos[kk].eventos++;
    });
    const lista = Object.keys(grupos).map(kk => {
      const g = grupos[kk];
      g.tasa = g.personas ? +(g.eventos / g.personas * 100).toFixed(1) : 0;
      return g;
    }).sort((a, b) => b.tasa - a.tasa);
    const max = Math.max(1, ...lista.map(g => g.eventos));

    main.innerHTML =
      cab('Eventos de salud por área y turno', 'Accidentes, incidentes y enfermedades de trabajo · ' + anio) +
      AVISO +
      '<div class="card"><div class="card-t">Eventos registrados</div>' + lista.map(g =>
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:250px;font-size:12.5px;color:var(--tx2)">' + esc(g.etiqueta) + '</div>' +
          '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
            '<div style="width:' + (g.eventos / max * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
          '<b style="width:80px;text-align:right;font-size:12.5px">' + g.eventos + ' · ' + g.tasa + '%</b>' +
        '</div>').join('') + '</div>' +
      '<h2 class="sec-t">Detalle</h2>' +
      tabla([
        { t: 'Área', k: 'area' }, { t: 'Turno', k: 'turno' }, { t: 'Colaboradores', k: 'personas' },
        { t: 'Eventos', k: 'eventos' }, { t: 'Tasa', v: g => g.tasa + '%' },
        { t: 'Con restricción', k: 'restringidos' }
      ], lista, { vacio: 'Sin datos.' }) +
      '<div class="nota"><b>Grupos pequeños.</b> En áreas o turnos con pocas personas, una tasa puede señalar a un individuo. ' +
      'Conviene fijar un umbral mínimo de colaboradores por grupo antes de difundir este reporte.</div>';

    ZX.pie(main, 'Este corte no incluye la causa clínica de cada evento; para el análisis de causa raíz (8D) coordina con el servicio médico y el responsable del área.');
  }

  /* ---------------------- helpers ---------------------- */
  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
  function k(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) +
           '</div><div class="kpi-d">' + esc(d) + '</div></div>';
  }
  function ro(l, v) {
    return '<div class="field"><label>' + esc(l) + '</label>' +
           '<div style="font-size:13px;font-weight:600;padding:6px 0">' + esc(v || '—') + '</div></div>';
  }
})();

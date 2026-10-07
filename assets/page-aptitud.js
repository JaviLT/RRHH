/* ============================================================
   Portal RRHH — Aptitud y restricciones laborales
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
     Industrial: nivel jefe + perfil vigilancia). Sin ese perfil, un jefe sólo ve la restricción operativa de su propio equipo. */
  const accesoPleno = ['medico', 'vigilancia'].indexOf(sesion.perfil) >= 0;
  const soloEquipo = !accesoPleno && sesion.nivel === 'jefe';

  const vistas = soloEquipo
    ? [{ id: 'restricciones', nombre: 'Restricciones de mi equipo', ico: '⛔' }]
    : [{ id: 'tablero', nombre: 'Aptitud del personal', ico: '🦺' },
       { id: 'restricciones', nombre: 'Restricciones vigentes', ico: '⛔' }];
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
        id: e.id, nombre: e.nombre, direccion: e.direccion, departamento: e.departamento, turno: e.turno, puesto: e.puesto,
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
    ({ tablero, restricciones }[vista] || tablero)();
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
      (!q || (f.nombre + ' ' + f.id + ' ' + f.direccion + ' ' + (f.departamento || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0));
    const conRestr = D.filas.filter(f => f.restricciones && f.restricciones.toLowerCase() !== 'ninguna');
    const vencidos = D.filas.filter(f => f.vigencia && f.vigencia < hoyISO());
    const sinEval = D.filas.filter(f => !f.dictamen);
    const cols = [
      { t: 'Nº', k: 'id' }, { t: 'Colaborador', k: 'nombre' }, { t: 'Puesto', k: 'puesto' },
      { t: 'Departamento', k: 'departamento' }, { t: 'Turno', k: 'turno' },
      { t: 'Dictamen', v: f => nombreDic(f.dictamen) },
      { t: 'Vigencia', v: f => f.vigencia ? fmt(f.vigencia) : '' },
      { t: 'Restricciones', k: 'restricciones' }
    ];

    main.innerHTML =
      cab('Aptitud del personal', D.filas.length + ' colaboradores activos', '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO +
      (ZX.puede(sesion, 'indicadores') ? '<div class="nota" style="margin-bottom:12px">Los totales de aptitud y los eventos por departamento están ahora en <a href="indicadores.html">Indicadores</a>.</div>' : '') +
      '<div class="filters" style="margin-top:14px">' +
        '<div class="field" style="min-width:250px"><label>Buscar</label>' +
          '<input id="q" value="' + esc(q) + '" placeholder="Nombre, número, dirección o departamento"></div>' +
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
          ro('Departamento', f.departamento) + ro('Turno', f.turno) + ro('Dirección', f.direccion) +
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

    ZX.pie(main, 'Las restricciones describen la limitación operativa (qué no debe hacer la persona en su puesto), nunca la condición médica que la origina. Es responsabilidad del jefe de departamento garantizar que la restricción se respete.');
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

/* ============================================================
   Portal Zubex — ETAPA 1 · Análisis clínicos (SQF)
   ------------------------------------------------------------
   Alcance del documento "Expediente Médico Electrónico ZX v3":
   registro y consulta de resultados, identificación de
   desviaciones, y seguimiento médico de cada desviación hasta
   el alta o cierre del caso.

   Dos niveles de acceso en la misma pantalla:
   · Salud Ocupacional  → todo, incluido el resultado clínico.
   · RH / Seg. Industrial / Dirección → estatus e indicadores de
     gestión, SIN el resultado ni la valoración médica.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, fmt, fmtLargo, hoyISO, sumaDias, diffDias, tabla,
          modal, cerrarModal, confirmar, descargarCSV } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_DEMO.CAT;

  const sesion = ZX.requiereSesion('analisis');
  if (!sesion) return;

  /* Sólo Salud Ocupacional ve el contenido clínico. El resto ve gestión. */
  const clinico = ZX.esClinico(sesion);

  const vistas = clinico
    ? [{ id: 'tablero',   nombre: 'Tablero Etapa 1',    ico: '📊' },
       { id: 'programa',  nombre: 'Programación',       ico: '🗓️' },
       { id: 'resultados',nombre: 'Resultados',         ico: '🧾' },
       { id: 'validar',   nombre: 'Por validar',        ico: '✔️' },
       { id: 'casos',     nombre: 'Casos de seguimiento', ico: '🔬' },
       { id: 'reporte',   nombre: 'Reporte de gestión', ico: '📤' }]
    : [{ id: 'tablero',   nombre: 'Tablero Etapa 1',    ico: '📊' },
       { id: 'programa',  nombre: 'Programación',       ico: '🗓️' },
       { id: 'casos',     nombre: 'Estatus de casos',   ico: '🔬' },
       { id: 'reporte',   nombre: 'Reporte de gestión', ico: '📤' }];

  const shell = ZX.montarShell('analisis', 'Etapa 1 · Control y seguimiento de análisis clínicos', vistas);
  const main = shell.main;

  let D = { emps: [], prog: [], res: [], casos: [] };
  let vista = 'tablero', casoSel = null;

  ZX.bindVistas(v => { vista = v; casoSel = null; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); });

  async function recargar() {
    const [emps, prog, res, casos] = await Promise.all([
      API.empleados.lista(), API.analisis.programacion(), API.analisis.resultados(), API.analisis.casos()
    ]);
    D = { emps, prog, res, casos };
  }
  async function refrescar() { await recargar(); render(); }
  function render() {
    if (casoSel) return fichaCaso(casoSel);
    ({ tablero, programa, resultados, validar, casos: listaCasos, reporte }[vista] || tablero)();
  }

  const empDe = id => D.emps.find(e => e.id === id) || {};
  const nombreDe = id => empDe(id).nombre || id || '—';
  const nombreCat = (cat, c) => { const x = cat.find(v => v.c === c); return x ? x.n : (c || '—'); };
  const chipEstatus = c => {
    const e = CAT.estatusCaso.find(x => x.c === c) || { chip: 'nt', n: c };
    return '<span class="chip ' + e.chip + '">' + esc(e.n) + '</span>';
  };
  const activos = () => D.emps.filter(e => e.estatus !== 'baja');

  const AVISO_GESTION =
    '<div class="priv">🔐 <div><b>Vista de gestión.</b> Este perfil ve el <b>estatus</b> del seguimiento y los indicadores ' +
    'necesarios para la gestión, pero no el resultado del análisis ni la valoración médica. Como señala la propuesta, el ' +
    'sistema no debe convertir los resultados médicos individuales en información de libre consulta.</div></div>';

  /* ===================== TABLERO ETAPA 1 ===================== */
  function tablero() {
    const a = activos();
    const evaluados = new Set(D.prog.filter(p => p.estado === 'realizado').map(p => p.empleado));
    const pendientes = D.prog.filter(p => p.estado === 'programado');
    const vencidos = D.prog.filter(p => p.estado === 'vencido');
    const desviaciones = D.res.filter(r => r.valoracion === 'desviacion');
    const porValidar = D.res.filter(r => r.valoracion === 'pendiente_validacion');
    const abiertos = D.casos.filter(c => c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere');
    const cerrados = D.casos.filter(c => c.estatus === 'alta_cierre');
    const vencidasVal = D.casos.filter(c => c.proximaValoracion && c.proximaValoracion < hoyISO() &&
      c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere');

    /* Distribución por los cinco estatus del documento */
    const porEstatus = CAT.estatusCaso.map(e => ({
      c: e.c, n: e.n, chip: e.chip, total: D.casos.filter(x => x.estatus === e.c).length
    }));
    const maxE = Math.max(1, ...porEstatus.map(p => p.total));

    main.innerHTML =
      cab('Tablero Etapa 1', 'Control y seguimiento de resultados de análisis clínicos · lineamiento SQF') +
      (clinico ? '' : AVISO_GESTION) +
      '<div class="grid g4">' +
        k('Evaluados', evaluados.size, 'De ' + a.length + ' colaboradores activos') +
        k('Pendientes de evaluar', pendientes.length, vencidos.length ? vencidos.length + ' ya vencidos' : 'Dentro de fecha',
          vencidos.length ? 'dn' : pendientes.length ? 'wn' : 'gn') +
        k('Desviaciones', desviaciones.length, 'Resultados fuera de criterio', desviaciones.length ? 'wn' : 'gn') +
        k('Casos abiertos', abiertos.length, 'En algún estatus de seguimiento', abiertos.length ? 'wn' : 'gn') +
        k('Casos cerrados', cerrados.length, 'Con alta médica', 'gn') +
        k('Valoraciones vencidas', vencidasVal.length, 'Fecha de control ya pasada', vencidasVal.length ? 'dn' : 'gn') +
        (clinico ? k('Por validar', porValidar.length, 'Resultados esperando validación médica', porValidar.length ? 'wn' : 'gn') : '') +
        k('Cobertura', Math.round(evaluados.size / Math.max(1, a.length) * 100) + '%', 'Plantilla activa evaluada',
          (evaluados.size / Math.max(1, a.length)) >= 0.9 ? 'gn' : 'wn') +
      '</div>' +

      '<h2 class="sec-t">Casos por estatus</h2>' +
      '<div class="card">' + porEstatus.map(p =>
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:270px;font-size:12.5px;color:var(--tx2)">' + esc(p.n) + '</div>' +
          '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
            '<div style="width:' + (p.total / maxE * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
          '<b style="width:28px;text-align:right;font-size:13px">' + p.total + '</b>' +
        '</div>').join('') + '</div>' +

      '<h2 class="sec-t">Requieren atención</h2>' +
      tabla([
        { t: 'Caso', k: 'id' },
        { t: 'Colaborador', v: c => nombreDe(c.empleado) },
        { t: 'Área', v: c => empDe(c.empleado).area },
        { t: 'Detección', v: c => fmt(c.fechaDeteccion) },
        { t: 'Días abierto', v: c => diffDias(c.fechaDeteccion, hoyISO()) },
        { t: 'Próxima valoración', html: c => !c.proximaValoracion ? '<span class="chip nt">Sin programar</span>'
            : c.proximaValoracion < hoyISO() ? '<span class="chip no">Vencida ' + esc(fmt(c.proximaValoracion)) + '</span>'
            : '<span class="chip wa">' + esc(fmt(c.proximaValoracion)) + '</span>' },
        { t: 'Estatus', html: c => chipEstatus(c.estatus) },
        { t: '', html: c => '<button class="btn sm" data-caso="' + esc(c.id) + '">Abrir</button>' }
      ], abiertos.sort((x, y) => String(x.proximaValoracion || '9').localeCompare(String(y.proximaValoracion || '9'))),
         { vacio: 'No hay casos abiertos.' });

    ZX.pie(main, 'La cobertura compara colaboradores con al menos una evaluación realizada contra la plantilla activa. Un caso se considera abierto mientras no esté en “Alta / cierre” ni en “No requiere seguimiento”.');
    bindCasos();
  }

  /* ===================== PROGRAMACIÓN ===================== */
  let fEstadoP = '';
  function programa() {
    const lista = D.prog.filter(p => !fEstadoP || p.estado === fEstadoP)
      .sort((a, b) => a.programada.localeCompare(b.programada));
    const cols = [
      { t: 'Folio', k: 'id' },
      { t: 'Colaborador', v: p => nombreDe(p.empleado) },
      { t: 'Puesto', v: p => empDe(p.empleado).puesto },
      { t: 'Área', v: p => empDe(p.empleado).area },
      { t: 'Turno', v: p => empDe(p.empleado).turno },
      { t: 'Tipo de evaluación', v: p => nombreCat(CAT.tiposEvaluacionAnalisis, p.tipoEvaluacion) },
      { t: 'Fecha programada', v: p => fmt(p.programada) },
      { t: 'Fecha de evaluación', v: p => p.fechaEvaluacion ? fmt(p.fechaEvaluacion) : '—' },
      { t: 'Estado', k: 'estado' }
    ];
    /* Colaboradores activos sin ninguna programación en el periodo */
    const sinProgramar = activos().filter(e => !D.prog.some(p => p.empleado === e.id));

    main.innerHTML =
      cab('Programación de análisis', 'Quién ya fue evaluado y quién sigue pendiente',
          (clinico ? '<button class="btn" id="nuevo">＋ Programar</button>' : '') +
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
      (clinico ? '' : AVISO_GESTION) +
      '<div class="grid g4">' +
        k('Realizados', D.prog.filter(p => p.estado === 'realizado').length, 'Con resultados recibidos', 'gn') +
        k('Programados', D.prog.filter(p => p.estado === 'programado').length, 'Con fecha por delante') +
        k('Vencidos', D.prog.filter(p => p.estado === 'vencido').length, 'Fuera de fecha sin realizar',
          D.prog.filter(p => p.estado === 'vencido').length ? 'dn' : 'gn') +
        k('Sin programar', sinProgramar.length, 'Colaboradores activos sin cita', sinProgramar.length ? 'wn' : 'gn') +
      '</div>' +
      '<div class="filters" style="margin-top:14px"><div class="field"><label>Estado</label><select id="fe">' +
        opts([['', 'Todos']].concat(CAT.estadosProgramacion.map(e => [e.c, e.n])), fEstadoP) + '</select></div></div>' +
      tabla(cols.slice(0, 8).concat([
        { t: 'Estado', html: p => '<span class="chip ' + (p.estado === 'realizado' ? 'ok' : p.estado === 'vencido' ? 'no' : 'wa') + '">' +
            esc(nombreCat(CAT.estadosProgramacion, p.estado)) + '</span>' }
      ]), lista, { vacio: 'Sin programaciones con ese filtro.' }) +
      (sinProgramar.length
        ? '<h2 class="sec-t">Sin programación en el periodo</h2>' +
          tabla([
            { t: 'Nº', k: 'id' }, { t: 'Colaborador', k: 'nombre' }, { t: 'Puesto', k: 'puesto' },
            { t: 'Área', k: 'area' }, { t: 'Turno', k: 'turno' },
            { t: '', html: e => clinico ? '<button class="btn sm" data-prog="' + esc(e.id) + '">Programar</button>' : '' }
          ], sinProgramar, {})
        : '');

    ZX.pie(main, 'La programación es la base de la cobertura: un colaborador sin programación no aparece como pendiente en los indicadores, por eso se listan aparte los que no tienen cita en el periodo.');
    $('#fe').addEventListener('change', e => { fEstadoP = e.target.value; programa(); });
    $('#csv').addEventListener('click', () => descargarCSV('Programacion_Analisis_' + hoyISO() + '.csv', cols, lista));
    const bn = $('#nuevo');
    if (bn) bn.addEventListener('click', () => popupProgramar(''));
    $$('[data-prog]').forEach(b => b.addEventListener('click', () => popupProgramar(b.dataset.prog)));
  }

  function popupProgramar(empId) {
    modal({
      titulo: 'Programar análisis clínicos',
      cuerpo:
        '<div class="frow">' +
          selEmp('empP', empId) +
          selc('tipoP', 'Tipo de evaluación', CAT.tiposEvaluacionAnalisis.map(t => [t.c, t.n])) +
          txt('fechaP', 'Fecha programada', sumaDias(hoyISO(), 15), 'date') +
          txt('periodoP', 'Periodo', String(new Date().getFullYear())) +
        '</div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Programar', accion: async (b) => {
            try {
              await API.analisis.programar({
                empleado: $('#empP', b).value, tipoEvaluacion: $('#tipoP', b).value,
                programada: $('#fechaP', b).value, periodo: $('#periodoP', b).value
              });
              cerrarModal(); toast('Análisis programado.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ===================== RESULTADOS (sólo clínico) ===================== */
  let qr = '', fVal = '';
  function resultados() {
    const lista = D.res.filter(r =>
      (!fVal || r.valoracion === fVal) &&
      (!qr || (nombreDe(r.empleado) + ' ' + r.empleado + ' ' + r.analisis).toLowerCase().indexOf(qr.toLowerCase()) >= 0))
      .sort((a, b) => String(b.fechaResultado).localeCompare(String(a.fechaResultado)));
    const cols = [
      { t: 'Folio', k: 'id' },
      { t: 'Colaborador', v: r => nombreDe(r.empleado) },
      { t: 'Análisis', k: 'analisis' },
      { t: 'Fecha de toma', v: r => fmt(r.fechaToma) },
      { t: 'Fecha de resultado', v: r => fmt(r.fechaResultado) },
      { t: 'Resultado', k: 'resultado' },
      { t: 'Parámetro / criterio', k: 'parametro' },
      { t: 'Valoración', v: r => nombreCat(CAT.valoracionResultado, r.valoracion) },
      { t: 'Validó', v: r => r.validadoPor ? nombreDe(r.validadoPor) : '—' }
    ];

    main.innerHTML =
      cab('Resultados de análisis', lista.length + ' registro(s) · consulta histórica',
          '<button class="btn" id="nuevo">＋ Registrar resultado</button><button class="btn gh" id="csv">⬇ CSV</button>') +
      '<div class="filters">' +
        '<div class="field" style="min-width:250px"><label>Buscar</label>' +
          '<input id="q" value="' + esc(qr) + '" placeholder="Colaborador, número o análisis"></div>' +
        '<div class="field"><label>Valoración</label><select id="fv">' +
          opts([['', 'Todas']].concat(CAT.valoracionResultado.map(v => [v.c, v.n])), fVal) + '</select></div>' +
      '</div>' +
      tabla(cols.slice(0, 7).concat([
        { t: 'Valoración', html: r => '<span class="chip ' +
            (r.valoracion === 'desviacion' ? 'no' : r.valoracion === 'normal' ? 'ok' : 'wa') + '">' +
            esc(nombreCat(CAT.valoracionResultado, r.valoracion)) + '</span>' },
        { t: '', html: r => r.valoracion === 'pendiente_validacion'
            ? '<button class="btn sm" data-val="' + esc(r.id) + '">Validar</button>'
            : (r.valoracion === 'desviacion'
                ? (casoDe(r.id) ? '<button class="btn gh sm" data-caso="' + esc(casoDe(r.id).id) + '">Ver caso</button>' : '')
                : '') }
      ]), lista, { vacio: 'Sin resultados con esos filtros.' });

    ZX.pie(main, 'Todo resultado se registra como “pendiente de validación”: quien lo captura no decide si hay desviación. La validación médica es la que clasifica el resultado y, cuando corresponde, abre el caso de seguimiento.');
    const qi = $('#q');
    qi.addEventListener('input', () => { qr = qi.value; const p = qi.selectionStart; resultados(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $('#fv').addEventListener('change', e => { fVal = e.target.value; resultados(); });
    $('#nuevo').addEventListener('click', popupResultado);
    $('#csv').addEventListener('click', () => descargarCSV('Resultados_Analisis_' + hoyISO() + '.csv', cols, lista));
    $$('[data-val]').forEach(b => b.addEventListener('click', () => popupValidar(b.dataset.val)));
    bindCasos();
  }

  const casoDe = resId => D.casos.find(c => c.resultado === resId);

  function popupResultado() {
    const body = modal({
      titulo: 'Registrar resultado de análisis', ancho: 'lg',
      cuerpo:
        '<fieldset><legend>Colaborador y evaluación</legend><div class="frow">' +
          selEmp('empR', '') +
          '<div class="field"><label for="progR">Programación asociada</label><select id="progR"></select></div>' +
        '</div></fieldset>' +
        '<fieldset><legend>Resultado</legend><div class="frow">' +
          '<div class="field"><label for="analisisR">Tipo de análisis</label><select id="analisisR">' +
            CAT.tiposAnalisis.map(t => '<option value="' + esc(t.n) + '">' + esc(t.n) + '</option>').join('') +
          '</select></div>' +
          txt('tomaR', 'Fecha de toma', hoyISO(), 'date') +
          txt('resR', 'Fecha de resultado', hoyISO(), 'date') +
          txt('labR', 'Laboratorio', 'Laboratorio externo autorizado') +
        '</div>' +
        txtL('resultadoR', 'Resultado') +
        txtL('parametroR', 'Parámetro / criterio de referencia') +
        '<p class="hint" style="font-size:11px;color:var(--tx3)">El resultado quedará como <b>pendiente de validación</b> ' +
        'hasta que el médico lo clasifique como normal o desviación.</p></fieldset>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Registrar', accion: async (b) => {
            const r = $('#resultadoR', b).value.trim();
            if (!r) return toast('Captura el resultado.', 'wa');
            try {
              await API.analisis.registrarResultado({
                empleado: $('#empR', b).value, programacion: $('#progR', b).value,
                analisis: $('#analisisR', b).value, fechaToma: $('#tomaR', b).value,
                fechaResultado: $('#resR', b).value, resultado: r,
                parametro: $('#parametroR', b).value.trim(), laboratorio: $('#labR', b).value.trim(),
                capturadoPor: sesion.id
              });
              cerrarModal(); toast('Resultado registrado. Queda pendiente de validación.', 'ok');
              vista = 'validar'; marcarVista('validar'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    /* El parámetro se sugiere solo según el análisis elegido */
    const sugerir = () => {
      const t = CAT.tiposAnalisis.find(x => x.n === $('#analisisR', body).value);
      if (t && !$('#parametroR', body).value) $('#parametroR', body).value = t.p;
    };
    const cargarProgs = () => {
      const emp = $('#empR', body).value;
      const props = D.prog.filter(p => p.empleado === emp);
      $('#progR', body).innerHTML = props.length
        ? props.map(p => '<option value="' + esc(p.id) + '">' + esc(p.id + ' · ' + nombreCat(CAT.tiposEvaluacionAnalisis, p.tipoEvaluacion) + ' · ' + fmt(p.programada)) + '</option>').join('')
        : '<option value="">Sin programación registrada</option>';
    };
    $('#analisisR', body).addEventListener('change', sugerir);
    $('#empR', body).addEventListener('change', cargarProgs);
    cargarProgs(); sugerir();
  }

  /* ===================== POR VALIDAR ===================== */
  function validar() {
    const lista = D.res.filter(r => r.valoracion === 'pendiente_validacion');
    main.innerHTML =
      cab('Resultados por validar', lista.length + ' resultado(s) esperando valoración médica') +
      (lista.length ? lista.map(r =>
        '<div class="card"><div class="card-t"><span>' + esc(nombreDe(r.empleado)) + ' · ' + esc(r.analisis) + '</span>' +
          '<span class="chip wa">Pendiente de validación</span></div>' +
        '<div class="frow">' +
          ro('Fecha de toma', fmt(r.fechaToma)) + ro('Fecha de resultado', fmt(r.fechaResultado)) +
          ro('Laboratorio', r.laboratorio) + ro('Capturó', nombreDe(r.capturadoPor)) +
        '</div>' +
        '<div class="frow">' + ro('Resultado', r.resultado) + ro('Parámetro / criterio', r.parametro) + '</div>' +
        '<div class="btn-row"><button class="btn ok sm" data-normal="' + esc(r.id) + '">Marcar normal</button>' +
        '<button class="btn no sm" data-desv="' + esc(r.id) + '">Marcar desviación y abrir caso</button></div>' +
        '</div>').join('')
        : '<div class="tbl-wrap"><div class="empty">No hay resultados pendientes de validación.</div></div>');

    ZX.pie(main, 'Al marcar una desviación se abre automáticamente un caso en estatus “Pendiente de valoración”, para que ninguna desviación quede sin seguimiento.');
    $$('[data-normal]').forEach(b => b.addEventListener('click', () => popupValidar(b.dataset.normal, 'normal')));
    $$('[data-desv]').forEach(b => b.addEventListener('click', () => popupValidar(b.dataset.desv, 'desviacion')));
  }

  function popupValidar(id, preseleccion) {
    const r = D.res.find(x => x.id === id) || {};
    modal({
      titulo: 'Validar resultado · ' + nombreDe(r.empleado),
      cuerpo:
        '<div class="frow">' + ro('Análisis', r.analisis) + ro('Resultado', r.resultado) +
          ro('Parámetro / criterio', r.parametro) + '</div>' +
        '<div class="field"><label for="val">Valoración médica</label><select id="val">' +
          '<option value="normal"' + (preseleccion === 'normal' ? ' selected' : '') + '>Normal — dentro de criterio</option>' +
          '<option value="desviacion"' + (preseleccion === 'desviacion' ? ' selected' : '') + '>Desviación — fuera de criterio</option>' +
        '</select></div>' +
        txtL('notaVal', 'Nota de validación (opcional)') +
        '<div class="nota" id="avisoVal"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Validar', accion: async (b) => {
            try {
              const res = await API.analisis.validarResultado(id, $('#val', b).value, sesion.id, $('#notaVal', b).value.trim());
              cerrarModal();
              toast(res.caso ? 'Desviación registrada. Caso ' + res.caso.id + ' abierto.' : 'Resultado validado como normal.',
                    res.caso ? 'wa' : 'ok');
              await recargar();
              if (res.caso) { casoSel = res.caso.id; render(); } else render();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    const pinta = () => {
      $('#avisoVal').innerHTML = $('#val').value === 'desviacion'
        ? '<b>Al validar como desviación</b> se abrirá un caso de seguimiento en estatus “Pendiente de valoración”.'
        : '<b>Al validar como normal</b> el resultado queda en el histórico y no se abre ningún caso.';
    };
    $('#val').addEventListener('change', pinta); pinta();
  }

  /* ===================== CASOS ===================== */
  let fEstatus = '';
  function listaCasos() {
    const lista = D.casos.filter(c => !fEstatus || c.estatus === fEstatus)
      .sort((a, b) => String(b.fechaDeteccion).localeCompare(String(a.fechaDeteccion)));
    const colsGestion = [
      { t: 'Caso', k: 'id' },
      { t: 'Colaborador', v: c => nombreDe(c.empleado) },
      { t: 'Área', v: c => empDe(c.empleado).area },
      { t: 'Turno', v: c => empDe(c.empleado).turno },
      { t: 'Detección', v: c => fmt(c.fechaDeteccion) },
      { t: 'Días abierto', v: c => c.fechaCierre ? diffDias(c.fechaDeteccion, c.fechaCierre) : diffDias(c.fechaDeteccion, hoyISO()) },
      { t: 'Próxima valoración', v: c => c.proximaValoracion ? fmt(c.proximaValoracion) : '—' },
      { t: 'Cierre', v: c => c.fechaCierre ? fmt(c.fechaCierre) : '—' },
      { t: 'Estatus', v: c => nombreCat(CAT.estatusCaso, c.estatus) }
    ];
    const cols = clinico
      ? colsGestion.slice(0, 5).concat([{ t: 'Motivo', k: 'motivo' }], colsGestion.slice(5))
      : colsGestion;

    main.innerHTML =
      cab(clinico ? 'Casos de seguimiento' : 'Estatus de casos',
          lista.length + ' caso(s) · trazabilidad de la desviación hasta el alta',
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
      (clinico ? '' : AVISO_GESTION) +
      '<div class="filters"><div class="field" style="min-width:260px"><label>Estatus</label><select id="fs">' +
        opts([['', 'Todos']].concat(CAT.estatusCaso.map(e => [e.c, e.n])), fEstatus) + '</select></div></div>' +
      tabla(cols.slice(0, cols.length - 1).concat([
        { t: 'Estatus', html: c => chipEstatus(c.estatus) },
        { t: '', html: c => '<button class="btn sm" data-caso="' + esc(c.id) + '">Abrir</button>' }
      ]), lista, { vacio: 'Sin casos con ese filtro.' });

    ZX.pie(main, clinico
      ? 'Cada caso conserva la trazabilidad completa: detección, valoración, indicaciones, estudios posteriores y alta.'
      : 'Esta vista muestra el estatus y los tiempos del seguimiento; el motivo clínico y la valoración médica no se despliegan para este perfil.');
    $('#fs').addEventListener('change', e => { fEstatus = e.target.value; listaCasos(); });
    $('#csv').addEventListener('click', () => descargarCSV('Casos_Seguimiento_' + hoyISO() + '.csv', cols, lista));
    bindCasos();
  }

  /* ---------- Ficha del caso ---------- */
  function fichaCaso(id) {
    const c = D.casos.find(x => x.id === id);
    if (!c) { casoSel = null; return render(); }
    const e = empDe(c.empleado);
    const r = D.res.find(x => x.id === c.resultado);
    const cerrado = c.estatus === 'alta_cierre' || c.estatus === 'no_requiere';

    /* Línea de tiempo de los cinco estatus */
    const orden = ['pendiente_valoracion', 'en_seguimiento', 'pendiente_valoracion_posterior', 'alta_cierre'];
    const idx = orden.indexOf(c.estatus);
    const flow = (c.estatus === 'no_requiere'
      ? [{ n: 'No requiere seguimiento', cls: 'done', ico: '✓' }]
      : orden.map((o, i) => {
          /* Con el caso cerrado, toda la ruta queda como recorrida */
          const hecho = cerrado || i < idx;
          return {
            n: nombreCat(CAT.estatusCaso, o),
            cls: hecho ? 'done' : i === idx ? 'now' : '',
            ico: hecho ? '✓' : (i + 1)
          };
        })
      ).map(f => '<div class="flow-i ' + f.cls + '"><div class="flow-dot">' + esc(f.ico) + '</div>' +
        '<div class="flow-tx"><b>' + esc(f.n) + '</b></div></div>').join('');

    main.innerHTML =
      cab('Caso ' + c.id, nombreDe(c.empleado) + ' · ' + (e.puesto || '') + ' · ' + (e.area || '') + ' · turno ' + (e.turno || '—'),
          (clinico && !cerrado ? '<button class="btn" id="avanzar">Registrar seguimiento</button>' : '') +
          (clinico && !cerrado ? '<button class="btn ok" id="alta">Alta / cierre</button>' : '') +
          '<button class="btn gh" id="volver">← Volver</button>') +
      '<div style="margin-bottom:14px">' + chipEstatus(c.estatus) +
        '<span class="page-sub" style="margin-left:9px">Detectado el ' + esc(fmt(c.fechaDeteccion)) +
        ' · ' + (c.fechaCierre ? 'cerrado el ' + esc(fmt(c.fechaCierre)) : diffDias(c.fechaDeteccion, hoyISO()) + ' días abierto') + '</span></div>' +
      (clinico ? '' : AVISO_GESTION) +

      '<div class="grid g2">' +
        '<div class="card"><div class="card-t">Identificación</div><div class="frow">' +
          ro('Número de empleado', e.id) + ro('Nombre', e.nombre) + ro('Puesto', e.puesto) +
          ro('Área', e.area) + ro('Turno', e.turno) + ro('Fecha de ingreso', fmt(e.ingreso)) +
        '</div></div>' +
        '<div class="card"><div class="card-t">Origen del caso</div><div class="frow">' +
          ro('Fecha de detección', fmt(c.fechaDeteccion)) +
          (clinico ? ro('Motivo', c.motivo) : ro('Motivo', 'Reservado al servicio médico')) +
          (r && clinico ? ro('Análisis', r.analisis) + ro('Resultado', r.resultado) + ro('Parámetro', r.parametro) : '') +
          ro('Abierto por', nombreDe(c.abiertoPor)) +
        '</div></div>' +
      '</div>' +

      '<div class="grid g2">' +
        '<div class="card"><div class="card-t">Ruta del caso</div><div class="flow">' + flow + '</div></div>' +
        '<div class="card"><div class="card-t">Seguimiento médico</div>' +
          (clinico
            ? '<div class="frow">' +
                ro('Valoración médica', c.valoracion) + ro('Fecha de cita', c.fechaCita ? fmt(c.fechaCita) : '—') +
                ro('Indicaciones / tratamiento', c.indicaciones) + ro('Estudios posteriores', c.estudiosPosteriores) +
                ro('Próxima valoración', c.proximaValoracion ? fmt(c.proximaValoracion) : '—') +
                ro('Fecha de alta / cierre', c.fechaCierre ? fmt(c.fechaCierre) : '—') +
              '</div>' +
              (c.restriccion ? '<div class="field"><label>Restricción laboral derivada</label>' +
                '<div style="font-size:13px;font-weight:600;color:var(--wnt)">' + esc(c.restriccion) + '</div></div>' : '')
            : '<div class="frow">' +
                ro('Próxima valoración', c.proximaValoracion ? fmt(c.proximaValoracion) : '—') +
                ro('Fecha de alta / cierre', c.fechaCierre ? fmt(c.fechaCierre) : '—') +
                ro('Restricción laboral vigente', c.restriccion || 'Ninguna') +
              '</div>' +
              '<p style="font-size:11.5px;color:var(--tx2)">La valoración, las indicaciones y los estudios son información ' +
              'clínica y no se muestran a este perfil.</p>') +
        '</div>' +
      '</div>' +

      '<h2 class="sec-t">Bitácora del caso</h2>' +
      tabla([
        { t: 'Fecha', v: n => fmt(n.fecha) }, { t: 'Registró', v: n => nombreDe(n.autor) },
        { t: 'Nota', k: 'nota' }
      ], (c.notas || []).slice().reverse(), { vacio: 'Sin notas registradas.' }) +
      (clinico && !cerrado
        ? '<div class="btn-row" style="margin-top:12px"><button class="btn gh" id="nota">＋ Nota de seguimiento</button></div>'
        : '');

    ZX.pie(main, 'La ruta del caso sigue los cinco estatus definidos en la propuesta: pendiente de valoración, en seguimiento, pendiente de valoración posterior, alta/cierre y no requiere seguimiento.');
    $('#volver').addEventListener('click', () => { casoSel = null; render(); });
    const a = $('#avanzar'); if (a) a.addEventListener('click', () => popupSeguimiento(c));
    const al = $('#alta'); if (al) al.addEventListener('click', () => popupAlta(c));
    const nt = $('#nota'); if (nt) nt.addEventListener('click', () => popupNota(c));
  }

  function popupSeguimiento(c) {
    modal({
      titulo: 'Registrar seguimiento · ' + c.id, ancho: 'lg',
      cuerpo:
        '<div class="field"><label for="estatusS">Estatus del caso</label><select id="estatusS">' +
          CAT.estatusCaso.map(e => '<option value="' + esc(e.c) + '"' + (e.c === c.estatus ? ' selected' : '') + '>' +
            esc(e.n) + '</option>').join('') +
        '</select></div>' +
        txtL('valoracionS', 'Valoración médica', c.valoracion) +
        '<div class="frow">' +
          txt('citaS', 'Fecha de cita', c.fechaCita, 'date') +
          txt('proximaS', 'Próxima valoración', c.proximaValoracion, 'date') +
        '</div>' +
        txtL('indicacionesS', 'Indicaciones / tratamiento', c.indicaciones) +
        txtL('estudiosS', 'Estudios o valoraciones posteriores', c.estudiosPosteriores) +
        txtL('restriccionS', 'Restricción laboral derivada (la ve Seguridad Industrial)', c.restriccion) +
        '<p class="hint" style="font-size:11px;color:var(--tx3)">La restricción es lo único de este caso que verán ' +
        'Seguridad Industrial y el jefe del área: descríbela como medida operativa, sin la causa clínica.</p>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            try {
              await API.analisis.actualizarCaso(c.id, {
                estatus: $('#estatusS', b).value,
                valoracion: $('#valoracionS', b).value.trim(),
                fechaCita: $('#citaS', b).value,
                proximaValoracion: $('#proximaS', b).value,
                indicaciones: $('#indicacionesS', b).value.trim(),
                estudiosPosteriores: $('#estudiosS', b).value.trim(),
                restriccion: $('#restriccionS', b).value.trim()
              }, sesion.id);
              cerrarModal(); toast('Seguimiento actualizado.', 'ok');
              await recargar(); render();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupAlta(c) {
    modal({
      titulo: 'Alta médica y cierre · ' + c.id,
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">El cierre deja el caso en estatus ' +
        '<b>Alta / cierre</b> y lo saca de los pendientes. La información se conserva en el expediente.</p>' +
        txt('fechaAlta', 'Fecha de alta / cierre', hoyISO(), 'date') +
        txtL('notaAlta', 'Nota de alta', '') +
        '<div class="chk"><input type="checkbox" id="quitarRestr"' + (c.restriccion ? ' checked' : '') + '>' +
        '<span>Levantar la restricción laboral derivada de este caso</span></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Dar de alta y cerrar', clase: 'ok', accion: async (b) => {
            try {
              const campos = {
                estatus: 'alta_cierre', fechaCierre: $('#fechaAlta', b).value, proximaValoracion: ''
              };
              if ($('#quitarRestr', b).checked) campos.restriccion = '';
              await API.analisis.actualizarCaso(c.id, campos, sesion.id);
              const n = $('#notaAlta', b).value.trim();
              if (n) await API.analisis.notaCaso(c.id, n, sesion.id);
              cerrarModal(); toast('Caso cerrado con alta médica.', 'ok');
              await recargar(); render();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupNota(c) {
    modal({
      titulo: 'Nota de seguimiento · ' + c.id,
      cuerpo: txtL('notaC', 'Nota', ''),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Agregar', accion: async (b) => {
            const n = $('#notaC', b).value.trim();
            if (!n) return toast('Escribe la nota.', 'wa');
            try {
              await API.analisis.notaCaso(c.id, n, sesion.id);
              cerrarModal(); toast('Nota agregada.', 'ok'); await recargar(); render();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ===================== REPORTE DE GESTIÓN ===================== */
  function reporte() {
    const a = activos();
    const evaluados = new Set(D.prog.filter(p => p.estado === 'realizado').map(p => p.empleado));
    const desviaciones = D.res.filter(r => r.valoracion === 'desviacion');
    const validados = D.res.filter(r => r.valoracion !== 'pendiente_validacion');
    const cerrados = D.casos.filter(c => c.estatus === 'alta_cierre');
    const diasCierre = cerrados.map(c => diffDias(c.fechaDeteccion, c.fechaCierre));
    const promCierre = diasCierre.length ? Math.round(diasCierre.reduce((x, y) => x + y, 0) / diasCierre.length) : null;

    /* Corte por área: sólo conteos, nunca resultados individuales */
    const areas = {};
    a.forEach(e => {
      const kk = e.area || '—';
      if (!areas[kk]) areas[kk] = { area: kk, personas: 0, evaluados: 0, casos: 0, abiertos: 0 };
      areas[kk].personas++;
      if (evaluados.has(e.id)) areas[kk].evaluados++;
    });
    D.casos.forEach(c => {
      const e = empDe(c.empleado); const kk = e.area || '—';
      if (!areas[kk]) return;
      areas[kk].casos++;
      if (c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere') areas[kk].abiertos++;
    });
    const filasArea = Object.keys(areas).map(kk => {
      const g = areas[kk];
      g.cobertura = g.personas ? Math.round(g.evaluados / g.personas * 100) : 0;
      return g;
    }).sort((x, y) => x.cobertura - y.cobertura);

    const cols = [
      { t: 'Área', k: 'area' }, { t: 'Colaboradores', k: 'personas' }, { t: 'Evaluados', k: 'evaluados' },
      { t: 'Cobertura', v: g => g.cobertura + '%' }, { t: 'Casos', k: 'casos' }, { t: 'Casos abiertos', k: 'abiertos' }
    ];

    main.innerHTML =
      cab('Reporte de gestión — Etapa 1', 'Corte al ' + fmtLargo(hoyISO()),
          '<button class="btn gh" id="csv">⬇ CSV</button><button class="btn gh" id="print">🖨️ Imprimir</button>') +
      '<div class="priv">📊 <div><b>Reporte agregado.</b> Contiene conteos y tiempos por área, sin resultados ni ' +
      'diagnósticos individuales. Es el entregable de gestión previsto para la Etapa 1.</div></div>' +
      '<div class="grid g4">' +
        k('Cobertura de evaluación', Math.round(evaluados.size / Math.max(1, a.length) * 100) + '%',
          evaluados.size + ' de ' + a.length + ' colaboradores') +
        k('Tasa de desviación', validados.length ? Math.round(desviaciones.length / validados.length * 100) + '%' : '—',
          desviaciones.length + ' de ' + validados.length + ' resultados validados',
          desviaciones.length ? 'wn' : 'gn') +
        k('Casos cerrados', cerrados.length + ' de ' + D.casos.length,
          D.casos.length ? Math.round(cerrados.length / D.casos.length * 100) + '% del total' : 'Sin casos', 'gn') +
        k('Días promedio a cierre', promCierre == null ? '—' : promCierre,
          'Desde la detección hasta el alta', promCierre != null && promCierre > 45 ? 'dn' : 'gn') +
      '</div>' +
      '<h2 class="sec-t">Cobertura y casos por área</h2>' +
      tabla(cols, filasArea, { vacio: 'Sin datos.' }) +
      '<h2 class="sec-t">Casos por estatus</h2>' +
      tabla([
        { t: 'Estatus', v: e => e.n }, { t: 'Casos', v: e => e.total },
        { t: '% del total', v: e => D.casos.length ? Math.round(e.total / D.casos.length * 100) + '%' : '0%' }
      ], CAT.estatusCaso.map(e => ({ n: e.n, total: D.casos.filter(c => c.estatus === e.c).length })), {}) +
      '<div class="nota"><b>Cómo leer este reporte.</b> La cobertura mide avance del programa, no salud: un área con 100% ' +
      'de cobertura y varias desviaciones está mejor controlada que una con 40% de cobertura y ninguna. En áreas con pocos ' +
      'colaboradores, evita difundir el conteo de casos: puede identificar a una persona.</div>';

    ZX.pie(main, 'Fuente: programación, resultados validados y casos de seguimiento del propio portal. Sin captura manual paralela.');
    $('#csv').addEventListener('click', () => descargarCSV('Reporte_Etapa1_' + hoyISO() + '.csv', cols, filasArea));
    $('#print').addEventListener('click', () => window.print());
  }

  /* ===================== helpers ===================== */
  function bindCasos() {
    $$('[data-caso]').forEach(b => b.addEventListener('click', () => { casoSel = b.dataset.caso; render(); }));
  }
  function marcarVista(v) {
    $$('.sb-item[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === v));
  }
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
           '<div style="font-size:13px;font-weight:600;padding:6px 0;word-break:break-word">' +
           esc(v === 0 ? '0' : (v || '—')) + '</div></div>';
  }
  function txt(id, l, v, tipo) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<input id="' + esc(id) + '" type="' + (tipo || 'text') + '" maxlength="120" value="' + esc(v || '') + '"></div>';
  }
  function txtL(id, l, v) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<textarea id="' + esc(id) + '" maxlength="500">' + esc(v || '') + '</textarea></div>';
  }
  function selc(id, l, pares, v) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><select id="' + esc(id) + '">' +
      pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(v) ? ' selected' : '') + '>' +
        esc(p[1]) + '</option>').join('') + '</select></div>';
  }
  function selEmp(id, v) {
    return '<div class="field"><label for="' + esc(id) + '">Colaborador</label><select id="' + esc(id) + '">' +
      activos().map(e => '<option value="' + esc(e.id) + '"' + (e.id === v ? ' selected' : '') + '>' +
        esc(e.id + ' — ' + e.nombre) + '</option>').join('') + '</select></div>';
  }
  function opts(pares, sel) {
    return pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(sel) ? ' selected' : '') + '>' +
      esc(p[1]) + '</option>').join('');
  }
})();

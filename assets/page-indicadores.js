/* ============================================================
   Portal RRHH — Tablero de indicadores de salud ocupacional
   ------------------------------------------------------------
   Entregable 2 de la propuesta de Expediente Médico Electrónico
   + Etapa 1 + totales del servicio médico y de aptitud.
   ⚠ Sólo información AGREGADA. Todo se calcula en la base de datos
   (función indicadores_salud): la pantalla recibe únicamente totales,
   nunca filas, nombres ni diagnósticos, por lo que sirve igual a
   Salud Ocupacional, Seguridad Industrial, RRHH y Administración.
   Los grupos de menos de 5 personas llegan ocultos.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, hoyISO, tabla, descargarCSV } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;

  const sesion = ZX.requiereSesion('indicadores');
  if (!sesion) return;

  const vistas = [
    { id: 'tablero', nombre: 'Indicadores', ico: '📈' },
    { id: 'etapa1', nombre: 'Etapa 1 · Análisis', ico: '🧪' },
    { id: 'servicio', nombre: 'Servicio médico', ico: '🩺' },
    { id: 'aptitud', nombre: 'Aptitud', ico: '🦺' },
    { id: 'motivos', nombre: 'Motivos de consulta', ico: '🩹' },
    { id: 'tendencias', nombre: 'Departamento y turno', ico: '🏭' },
    { id: 'ficha', nombre: 'Fichas de cálculo', ico: '🧮' }
  ];
  const shell = ZX.montarShell('indicadores', '', vistas);
  const main = shell.main;

  const ANIO = String(new Date().getFullYear());
  let anio = ANIO;
  let R = null, IND = null;

  let vista = 'tablero';
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await cargar(); render(); });

  async function cargar() {
    R = await API.indicadores.salud(+anio);
    calcular();
  }

  const pct = (a, b) => b ? +(a / b * 100).toFixed(1) : 0;
  const plural = (n, uno, muchos) => n === 1 ? uno : muchos;
  const nombreMotivo = cod => CAT.motivosConsulta.find(x => x.c === cod) || { c: cod, n: 'Sin catalogar', g: 'Otro' };

  function motivos() {
    const total = R.consultas.total;
    return (R.consultas.por_motivo || []).map(m => {
      const c = nombreMotivo(m.cod);
      return { cod: m.cod, nombre: c.n, grupo: c.g, n: m.n, pct: pct(m.n, total) };
    });
  }
  const grupoTop = () => (R.grupos || []).find(g => !g.oculto);

  function calcular() {
    const n = Math.max(1, R.plantilla);
    const c = R.consultas, rt = R.riesgos, ic = R.incapacidades, pr = R.programa, vg = R.vigilancia;
    const top = motivos()[0] || { nombre: 'Sin consultas en el periodo', n: 0, pct: 0 };
    const g = grupoTop();
    IND = {
      activos: R.plantilla,
      lista: [
        { id: 1, concepto: 'Número de consultas médicas', nombre: 'Tasa de atención médica',
          valor: pct(c.total, n), unidad: '%', num: c.total, den: n,
          formula: 'Consultas realizadas ÷ colaboradores activos × 100',
          fuente: 'Expediente médico electrónico · registro de consultas · maestro de personal',
          detalle: c.total + ' ' + plural(c.total, 'consulta', 'consultas') + ' entre ' + n + ' colaboradores activos', sentido: 'neutro' },
        { id: 2, concepto: 'Principales motivos de atención', nombre: 'Distribución porcentual de motivos de consulta',
          valor: top.pct, unidad: '%', num: top.n, den: c.total,
          formula: 'Consultas por motivo ÷ total de consultas × 100',
          fuente: 'Expediente médico · catálogo de motivos de consulta',
          detalle: 'Motivo más frecuente: ' + top.nombre, sentido: 'neutro' },
        { id: 3, concepto: 'Accidentes de trabajo', nombre: 'Tasa de incidencia de accidentes de trabajo',
          valor: pct(rt.accidentes, n), unidad: '%', num: rt.accidentes, den: n,
          formula: 'Accidentes de trabajo registrados ÷ promedio de colaboradores × 100',
          fuente: 'Expediente médico · registro de accidentes · Seguridad Industrial',
          detalle: rt.accidentes + ' ' + plural(rt.accidentes, 'accidente', 'accidentes') + ' en ' + anio, sentido: 'menor_mejor' },
        { id: 4, concepto: 'Incapacidades', nombre: 'Índice de días de incapacidad',
          valor: +(ic.dias / n).toFixed(2), unidad: 'días/colaborador', num: ic.dias, den: n,
          formula: 'Total de días de incapacidad ÷ promedio de colaboradores',
          fuente: 'Expediente médico · incapacidades · RH / nómina',
          detalle: ic.dias + ' días perdidos en ' + ic.total + ' ' + plural(ic.total, 'incapacidad', 'incapacidades'), sentido: 'menor_mejor' },
        { id: 5, concepto: 'Casos en seguimiento', nombre: 'Porcentaje de casos médicos en seguimiento',
          valor: pct(vg.casos_abiertos, vg.casos), unidad: '%', num: vg.casos_abiertos, den: vg.casos,
          formula: 'Casos abiertos en seguimiento ÷ total de casos registrados × 100',
          fuente: 'Expediente médico · agenda y registros de seguimiento',
          detalle: vg.casos_abiertos + ' abiertos de ' + vg.casos + ' casos', sentido: 'menor_mejor' },
        { id: 6, concepto: 'Evaluaciones médicas pendientes', nombre: 'Cumplimiento de evaluaciones médicas',
          valor: pct(pr.realizadas, pr.programadas), unidad: '%', num: pr.realizadas, den: pr.programadas,
          formula: 'Evaluaciones realizadas ÷ evaluaciones programadas × 100',
          fuente: 'Expediente médico · calendario de evaluaciones · RH',
          detalle: pr.vencidas + ' vencidas sin realizar', sentido: 'mayor_mejor' },
        { id: 7, concepto: 'Exámenes periódicos pendientes', nombre: 'Cumplimiento de exámenes médicos periódicos',
          valor: pct(pr.periodicos_realizados, pr.periodicos), unidad: '%', num: pr.periodicos_realizados, den: pr.periodicos,
          formula: 'Exámenes periódicos realizados ÷ programados × 100',
          fuente: 'Expediente médico · programa de vigilancia médica',
          detalle: pr.periodicos + ' exámenes periódicos en el programa', sentido: 'mayor_mejor' },
        { id: 8, concepto: 'Restricciones laborales vigentes', nombre: 'Colaboradores con restricciones laborales vigentes',
          valor: vg.con_restricciones, unidad: plural(vg.con_restricciones, 'colaborador', 'colaboradores'),
          num: vg.con_restricciones, den: n,
          formula: 'Conteo de colaboradores con restricción vigente al corte',
          fuente: 'Expediente médico · dictámenes de aptitud · Salud Ocupacional',
          detalle: pct(vg.con_restricciones, n) + '% de la plantilla activa', sentido: 'neutro' },
        { id: 9, concepto: 'Indicadores de salud ocupacional', nombre: 'Índice de frecuencia de eventos de salud ocupacional',
          valor: pct(rt.eventos, n), unidad: '%', num: rt.eventos, den: n,
          formula: 'Eventos de salud ocupacional registrados ÷ colaboradores × 100',
          fuente: 'Expediente médico · accidentes · enfermedades de trabajo · Seguridad Industrial',
          detalle: rt.eventos + ' ' + plural(rt.eventos, 'evento', 'eventos') + ' (accidentes, incidentes y enfermedades de trabajo)', sentido: 'menor_mejor' },
        { id: 10, concepto: 'Tendencias por departamento/turno', nombre: 'Tasa de eventos de salud por departamento y turno',
          valor: g ? g.tasa : 0, unidad: '%', num: g ? g.eventos : 0, den: g ? g.personas : 0,
          formula: 'Eventos de salud en el departamento/turno ÷ colaboradores del departamento/turno × 100',
          fuente: 'Expediente médico · maestro de personal (departamento y turno) · Seguridad Industrial',
          detalle: g ? 'Mayor tasa: ' + g.departamento + ' · ' + g.turno : 'Sin grupos con 5 o más personas', sentido: 'menor_mejor' }
      ]
    };
  }

  function render() { if (!R) return; ({ tablero, etapa1, servicio, aptitud, motivos: vistaMotivos, tendencias: vistaTendencias, ficha }[vista] || tablero)(); }

  const AVISO_AGREGADO =
    '<div class="priv">📊 <div><b>Información agregada.</b> Este tablero no muestra nombres, diagnósticos, expedientes ni datos clínicos ' +
    'individuales: los totales se calculan en la base de datos. Los grupos de menos de ' + 5 + ' personas se ocultan para que ninguna cifra ' +
    'permita identificar a alguien, conforme al criterio de confidencialidad de la NOM-035-STPS y a la propuesta de expediente médico electrónico.</div></div>';

  /* ---------------------- TABLERO ---------------------- */
  function tablero() {
    main.innerHTML =
      cab('Indicadores de salud ocupacional', 'Ejercicio ' + anio + ' · ' + IND.activos + ' colaboradores activos',
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO + filtroAnio() +
      '<div class="grid g3">' + IND.lista.map(tarjeta).join('') + '</div>';
    ZX.pie(main, 'Cada indicador muestra su fórmula y las cifras que la alimentan. El periodo es el año calendario seleccionado; los indicadores de cumplimiento consideran el programa completo.');
    bindAnio();
    $('#csv').addEventListener('click', () => descargarCSV('Indicadores_Salud_Ocupacional_' + anio + '.csv', [
      { t: 'Concepto', k: 'concepto' }, { t: 'Indicador', k: 'nombre' }, { t: 'Valor', k: 'valor' },
      { t: 'Unidad', k: 'unidad' }, { t: 'Numerador', k: 'num' }, { t: 'Denominador', k: 'den' },
      { t: 'Fórmula', k: 'formula' }, { t: 'Fuente', k: 'fuente' }
    ], IND.lista));
  }

  function tarjeta(i) {
    const clase = i.sentido === 'mayor_mejor' ? (i.valor >= 90 ? 'gn' : i.valor >= 70 ? 'wn' : 'dn')
                : i.sentido === 'menor_mejor' ? (i.valor === 0 ? 'gn' : i.valor <= 10 ? 'wn' : 'dn') : '';
    return '<div class="card" style="display:flex;flex-direction:column;gap:6px">' +
      '<div class="kpi-l">' + esc(i.id + ' · ' + i.concepto) + '</div>' +
      '<div><span class="kpi-v ' + clase + '">' + esc(i.valor) + '</span> ' +
        '<span style="font-size:12px;color:var(--tx2)">' + esc(i.unidad) + '</span></div>' +
      '<b style="font-size:12.5px">' + esc(i.nombre) + '</b>' +
      '<div style="font-size:11.5px;color:var(--tx2)">' + esc(i.detalle) + '</div>' +
      '<div style="background:var(--c1);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:11px;color:var(--tx2)">' +
        '<b style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3)">Fórmula</b><br>' + esc(i.formula) +
        (i.den ? '<br><b>' + esc(i.num) + ' ÷ ' + esc(i.den) + '</b>' : '') +
      '</div></div>';
  }

  /* ---------------- ETAPA 1 · ANÁLISIS ---------------- */
  function etapa1() {
    const a = R.analisis, n = Math.max(1, R.plantilla);
    const abiertos = a.abiertos;
    const lista = [
      { id: 'E1-1', concepto: 'Cobertura de evaluación', nombre: 'Porcentaje de plantilla evaluada',
        valor: pct(a.evaluados, n), unidad: '%', num: a.evaluados, den: n,
        formula: 'Colaboradores con evaluación realizada ÷ plantilla activa × 100',
        fuente: 'Programación de análisis · maestro de personal',
        detalle: a.evaluados + ' de ' + n + ' colaboradores activos', sentido: 'mayor_mejor' },
      { id: 'E1-2', concepto: 'Resultados validados', nombre: 'Avance de validación médica',
        valor: pct(a.validados, a.resultados), unidad: '%', num: a.validados, den: a.resultados,
        formula: 'Resultados validados ÷ resultados registrados × 100',
        fuente: 'Registro de resultados de análisis',
        detalle: (a.resultados - a.validados) + ' pendientes de validación', sentido: 'mayor_mejor' },
      { id: 'E1-3', concepto: 'Desviaciones detectadas', nombre: 'Tasa de desviación',
        valor: pct(a.desviaciones, a.validados), unidad: '%', num: a.desviaciones, den: a.validados,
        formula: 'Resultados con desviación ÷ resultados validados × 100',
        fuente: 'Validación médica de resultados',
        detalle: a.desviaciones + ' desviaciones sobre ' + a.validados + ' validados', sentido: 'menor_mejor' },
      { id: 'E1-4', concepto: 'Casos en seguimiento', nombre: 'Porcentaje de casos abiertos',
        valor: pct(abiertos, a.casos), unidad: '%', num: abiertos, den: a.casos,
        formula: 'Casos abiertos ÷ total de casos registrados × 100',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: abiertos + ' abiertos de ' + a.casos + ' casos', sentido: 'menor_mejor' },
      { id: 'E1-5', concepto: 'Casos cerrados', nombre: 'Porcentaje de casos con alta médica',
        valor: pct(a.cerrados, a.casos), unidad: '%', num: a.cerrados, den: a.casos,
        formula: 'Casos en alta/cierre ÷ total de casos × 100',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: a.cerrados + ' casos cerrados', sentido: 'mayor_mejor' },
      { id: 'E1-6', concepto: 'Tiempo de resolución', nombre: 'Días promedio de la detección al alta',
        valor: a.dias_prom_cierre == null ? 0 : a.dias_prom_cierre, unidad: 'días', num: 0, den: 0,
        formula: 'Suma de días (detección → alta) ÷ casos cerrados',
        fuente: 'Casos de seguimiento cerrados',
        detalle: a.cerrados ? 'Sobre ' + a.cerrados + ' casos cerrados' : 'Aún sin casos cerrados', sentido: 'menor_mejor' },
      { id: 'E1-7', concepto: 'Valoraciones vencidas', nombre: 'Casos con control fuera de fecha',
        valor: a.fuera_de_fecha, unidad: a.fuera_de_fecha === 1 ? 'caso' : 'casos', num: a.fuera_de_fecha, den: abiertos,
        formula: 'Conteo de casos abiertos cuya próxima valoración ya pasó',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: abiertos ? 'De ' + abiertos + ' casos abiertos' : 'Sin casos abiertos', sentido: 'menor_mejor' }
    ];
    const porEstatus = a.por_estatus.map(e => ({ n: (CAT.estatusCaso.find(x => x.c === e.estatus) || { n: e.estatus }).n, total: e.n }));
    const cols = [
      { t: 'Departamento', k: 'departamento' }, { t: 'Colaboradores', k: 'personas' },
      { t: 'Evaluados', v: g => g.oculto ? '—' : g.evaluados }, { t: 'Cobertura', v: g => g.oculto ? '—' : g.cobertura + '%' },
      { t: 'Casos', v: g => g.oculto ? '—' : g.casos }, { t: 'Casos abiertos', v: g => g.oculto ? '—' : g.abiertos },
      { t: '', html: g => g.oculto ? '<span class="chip nt">Menos de 5 personas</span>' : '' }
    ];
    main.innerHTML =
      cab('Indicadores de la Etapa 1', 'Control y seguimiento de análisis clínicos · lineamiento SQF',
          '<button class="btn gh" id="csvE1">⬇ CSV</button><button class="btn gh" id="print">🖨️ Imprimir</button>') +
      AVISO_AGREGADO +
      '<div class="grid g3">' + lista.map(tarjeta).join('') + '</div>' +
      '<h2 class="sec-t">Casos por estatus</h2>' +
      tabla([
        { t: 'Estatus', v: e => e.n }, { t: 'Casos', v: e => e.total },
        { t: '% del total', v: e => a.casos ? Math.round(e.total / a.casos * 100) + '%' : '0%' }
      ], porEstatus, {}) +
      '<h2 class="sec-t">Cobertura y casos por departamento</h2>' +
      tabla(cols, a.por_departamento, { vacio: 'Sin datos.' }) +
      '<div class="nota"><b>Cómo leer el reporte por departamento.</b> La cobertura mide avance del programa, no salud: un departamento con 100% ' +
      'de cobertura y varias desviaciones está mejor controlado que uno con 40% de cobertura y ninguna. Los departamentos con menos de 5 ' +
      'colaboradores se muestran sin cifras.</div>' +
      '<div class="nota"><b>Meta de la Etapa 1.</b> Al término de las cuatro semanas debe poder responderse: quiénes fueron evaluados, quiénes están ' +
      'pendientes, qué desviaciones se detectaron, cuántas están en seguimiento y cuáles ya se cerraron.</div>';
    ZX.pie(main, 'Los indicadores de la Etapa 1 se alimentan de la programación, los resultados validados y los casos de seguimiento del propio portal. Corte al ' + ZX.fmt(R.corte) + '.');
    $('#csvE1').addEventListener('click', () => descargarCSV('Indicadores_Etapa1_' + hoyISO() + '.csv', [
      { t: 'Clave', k: 'id' }, { t: 'Concepto', k: 'concepto' }, { t: 'Indicador', k: 'nombre' },
      { t: 'Valor', k: 'valor' }, { t: 'Unidad', k: 'unidad' }, { t: 'Numerador', k: 'num' },
      { t: 'Denominador', k: 'den' }, { t: 'Fórmula', k: 'formula' }, { t: 'Fuente', k: 'fuente' }
    ], lista));
    $('#print').addEventListener('click', () => window.print());
  }

  /* ---------------- SERVICIO MÉDICO ---------------- */
  function servicio() {
    const p = R.programa, ic = R.incapacidades, rt = R.riesgos, vg = R.vigilancia, vc = R.vacunacion;
    const cumpl = p.programadas ? Math.round(p.realizadas / p.programadas * 100) : null;
    const cobertura = Math.round(vc.vacunados / Math.max(1, R.plantilla) * 100);
    const bloques = [
      ['Programa de exámenes', [
        k('Programadas', p.programadas, 'En el programa de vigilancia'),
        k('Realizadas', p.realizadas, 'Con evaluación asociada'),
        k('Vencidas', p.vencidas, 'Fuera de fecha', p.vencidas ? 'dn' : 'gn'),
        k('Cumplimiento', cumpl == null ? '—' : cumpl + '%', 'Realizadas ÷ programadas', cumpl == null ? '' : (cumpl >= 90 ? 'gn' : cumpl >= 70 ? 'wn' : 'dn'))]],
      ['Ausentismo médico (' + anio + ')', [
        k('Incapacidades', ic.total, 'Expedidas en el año'),
        k('Días perdidos', ic.dias, 'Días naturales en el año', ic.dias > 60 ? 'dn' : ''),
        k('Vigentes hoy', ic.vigentes, 'Colaboradores ausentes', ic.vigentes ? 'wn' : 'gn'),
        k('Por riesgo de trabajo', ic.por_riesgo, 'Del total del año')]],
      ['Riesgos de trabajo (' + anio + ')', [
        k('Eventos', rt.eventos, 'Registrados'),
        k('Accidentes', rt.accidentes, 'Con lesión', rt.accidentes ? 'dn' : 'gn'),
        k('Días perdidos', rt.dias_perdidos, 'Acumulados en el año'),
        k('Sin cerrar', rt.sin_cerrar, 'Requieren seguimiento', rt.sin_cerrar ? 'wn' : 'gn')]],
      ['Atención y Control de Salud', [
        k('Colaboradores en programa', vg.en_programa, 'Con vigilancia asignada'),
        k('Valoraciones próximas', vg.proximas, 'En los siguientes 30 días', vg.proximas ? 'wn' : 'gn'),
        k('Casos abiertos', vg.casos_abiertos, 'En seguimiento activo', vg.casos_abiertos ? 'wn' : 'gn'),
        k('Con restricciones', vg.con_restricciones, 'Restricción laboral vigente')]],
      ['Campañas y vacunación', [
        k('Campañas activas', vc.campanas_activas, 'En curso hoy'),
        k('Aplicaciones', vc.aplicaciones, 'Registradas en total'),
        k('Dosis vencidas', vc.dosis_vencidas, 'Esquemas incompletos', vc.dosis_vencidas ? 'dn' : 'gn'),
        k('Cobertura', cobertura + '%', 'Colaboradores con al menos una aplicación')]]
    ];
    main.innerHTML =
      cab('Servicio médico', 'Totales del servicio médico · ejercicio ' + anio, '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO + filtroAnio() +
      bloques.map(b => '<h2 class="sec-t">' + esc(b[0]) + '</h2><div class="grid g4">' + b[1].join('') + '</div>').join('');
    ZX.pie(main, 'Totales al ' + ZX.fmt(R.corte) + '. El detalle con nombres de cada sección está en Servicio médico y sólo lo ve Salud Ocupacional. Programa, vigilancia y vacunación no dependen del ejercicio; ausentismo y riesgos sí.');
    bindAnio();
    $('#csv').addEventListener('click', () => {
      const filas = []; bloques.forEach(b => b[1].forEach(h => {
        const m = /kpi-l">([^<]*)<\/div><div class="kpi-v[^"]*">([^<]*)</.exec(h); filas.push({ seccion: b[0], indicador: m[1], valor: m[2] }); }));
      descargarCSV('Servicio_Medico_Totales_' + anio + '.csv', [{ t: 'Sección', k: 'seccion' }, { t: 'Indicador', k: 'indicador' }, { t: 'Valor', k: 'valor' }], filas);
    });
  }

  /* ---------------- APTITUD ---------------- */
  function aptitud() {
    const a = R.aptitud;
    const cuadro = [
      { seccion: 'Aptitud', indicador: 'Aptos', valor: a.aptos }, { seccion: 'Aptitud', indicador: 'Con restricciones', valor: a.con_restricciones },
      { seccion: 'Aptitud', indicador: 'Dictamen vencido', valor: a.vencidos }, { seccion: 'Aptitud', indicador: 'Sin evaluación', valor: a.sin_evaluacion }];
    main.innerHTML =
      cab('Aptitud del personal', R.plantilla + ' colaboradores activos', '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO +
      '<div class="grid g4">' +
        k('Aptos', a.aptos, 'Sin restricciones', 'gn') +
        k('Con restricciones', a.con_restricciones, 'Requieren ajuste en el puesto', a.con_restricciones ? 'wn' : 'gn') +
        k('Dictamen vencido', a.vencidos, 'Requieren nueva valoración', a.vencidos ? 'dn' : 'gn') +
        k('Sin evaluación', a.sin_evaluacion, 'Nunca valorados', a.sin_evaluacion ? 'wn' : 'gn') +
      '</div>' +
      '<div class="nota">Aquí sólo hay totales. Quién tiene cada dictamen o restricción se consulta en <b>Aptitud y restricciones</b>, para los perfiles que tienen acceso a esa pantalla.</div>';
    ZX.pie(main, 'Cada persona cuenta con su dictamen más reciente. «Dictamen vencido» es el que ya pasó su vigencia; «Con restricciones» sale de la vigilancia de salud ocupacional.');
    $('#csv').addEventListener('click', () => descargarCSV('Aptitud_Totales_' + hoyISO() + '.csv', [{ t: 'Sección', k: 'seccion' }, { t: 'Indicador', k: 'indicador' }, { t: 'Valor', k: 'valor' }], cuadro));
  }

  /* ------------------ MOTIVOS DE CONSULTA ------------------ */
  function vistaMotivos() {
    const lista = motivos();
    const max = Math.max(1, ...lista.map(m => m.n));
    const porGrupo = {};
    lista.forEach(m => { porGrupo[m.grupo] = (porGrupo[m.grupo] || 0) + m.n; });
    const total = lista.reduce((a, m) => a + m.n, 0);
    main.innerHTML =
      cab('Motivos de consulta', 'Distribución porcentual · ' + anio, '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO + filtroAnio() +
      (lista.length
        ? '<div class="card"><div class="card-t">Consultas por motivo</div>' + lista.map(m =>
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
              '<div style="width:290px;font-size:12.5px;color:var(--tx2)">' + esc(m.cod + ' · ' + m.nombre) + '</div>' +
              '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
                '<div style="width:' + (m.n / max * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
              '<b style="width:70px;text-align:right;font-size:12.5px">' + m.n + ' · ' + m.pct + '%</b>' +
            '</div>').join('') + '</div>' +
          '<h2 class="sec-t">Por grupo de causa</h2>' +
          tabla([
            { t: 'Grupo', v: g => g.grupo }, { t: 'Consultas', v: g => g.n }, { t: '% del total', v: g => g.pct + '%' }
          ], Object.keys(porGrupo).map(g => ({ grupo: g, n: porGrupo[g], pct: pct(porGrupo[g], total) })).sort((a, b) => b.n - a.n), {})
        : '<div class="tbl-wrap"><div class="empty">Sin consultas registradas en ' + esc(anio) + '.</div></div>');
    ZX.pie(main, 'La clasificación proviene del catálogo cerrado de motivos de consulta que captura el médico. Las consultas marcadas como “M99 · Otro” deben revisarse periódicamente para mantener útil el catálogo.');
    bindAnio();
    $('#csv').addEventListener('click', () => descargarCSV('Motivos_Consulta_' + anio + '.csv',
      [{ t: 'Código', k: 'cod' }, { t: 'Motivo', k: 'nombre' }, { t: 'Grupo', k: 'grupo' },
       { t: 'Consultas', k: 'n' }, { t: '% del total', k: 'pct' }], lista));
  }

  /* ------------- DEPARTAMENTO Y TURNO (con eventos por departamento) ------------- */
  function vistaTendencias() {
    const lista = R.grupos;
    const ocultos = lista.filter(g => g.oculto).length;
    const cols = [
      { t: 'Departamento', k: 'departamento' }, { t: 'Turno', k: 'turno' }, { t: 'Colaboradores', k: 'personas' },
      { t: 'Eventos de salud', v: g => g.oculto ? '—' : g.eventos }, { t: 'Días de incapacidad', v: g => g.oculto ? '—' : g.dias_incapacidad },
      { t: 'Consultas', v: g => g.oculto ? '—' : g.consultas }, { t: 'Con restricción', v: g => g.oculto ? '—' : g.con_restriccion },
      { t: 'Tasa de eventos', v: g => g.oculto ? '—' : g.tasa + '%' },
      { t: '', html: g => g.oculto ? '<span class="chip nt">Menos de 5 personas</span>' : '' }
    ];
    main.innerHTML =
      cab('Departamento y turno', 'Ejercicio ' + anio, '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO + filtroAnio() +
      tabla(cols, lista, { vacio: 'Sin datos para el periodo.' }) +
      '<div class="nota" style="margin-top:16px"><b>Sobre el tamaño de los grupos.</b> ' + (ocultos ? ocultos + ' ' + plural(ocultos, 'grupo tiene', 'grupos tienen') + ' menos de 5 colaboradores y se muestra sin cifras. ' : '') +
      'Cuando un departamento o turno tiene muy pocas personas, la tasa dejaría de ser un dato agregado y podría identificar a alguien.</div>';
    ZX.pie(main, 'Departamento y turno se toman del maestro de personal. En el modelo final estos campos vendrán de IBIX, por lo que la calidad del indicador depende de que ese maestro esté completo; las personas sin turno aparecen agrupadas como «—».');
    bindAnio();
    $('#csv').addEventListener('click', () => descargarCSV('Departamento_Turno_' + anio + '.csv', cols.slice(0, 8), lista));
  }

  /* ------------------ FICHAS DE CÁLCULO ------------------ */
  function ficha() {
    main.innerHTML =
      cab('Fichas de cálculo', 'Definición formal de cada indicador del Entregable 2') +
      tabla([
        { t: '#', k: 'id' }, { t: 'Concepto', k: 'concepto' }, { t: 'Nombre formal', k: 'nombre' },
        { t: 'Fórmula', k: 'formula' }, { t: 'Unidad', k: 'unidad' },
        { t: 'Valor actual', v: i => i.valor + ' ' + i.unidad },
        { t: 'Fuente de datos', k: 'fuente' }
      ], IND.lista, {}) +
      '<div class="nota"><b>Trazabilidad del cálculo.</b> Todos los indicadores se alimentan del propio expediente médico ' +
      'electrónico y del maestro de personal, sin captura manual paralela. Los dos indicadores de cumplimiento requieren que el ' +
      'programa de exámenes esté cargado: sin evaluaciones programadas no existe denominador y el indicador no puede calcularse.</div>';
    ZX.pie(main, 'Las fórmulas corresponden a la matriz de indicadores de la propuesta de Expediente Médico Electrónico ZX (20 de agosto de 2026).');
  }

  /* ---------------------- helpers ---------------------- */
  function filtroAnio() {
    const anios = [];
    for (let i = 0; i < 4; i++) anios.push(String(+ANIO - i));
    return '<div class="filters"><div class="field"><label>Ejercicio</label><select id="fa">' +
      anios.map(a => '<option value="' + a + '"' + (a === anio ? ' selected' : '') + '>' + a + '</option>').join('') +
      '</select></div></div>';
  }
  function bindAnio() {
    const fa = $('#fa');
    if (fa) fa.addEventListener('change', async e => { anio = e.target.value; ZX.cargando(main); await cargar(); render(); });
  }
  function k(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) +
           '</div><div class="kpi-d">' + esc(d || '') + '</div></div>';
  }
  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
})();

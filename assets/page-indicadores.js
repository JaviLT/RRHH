/* ============================================================
   Portal Zubex — Tablero de indicadores de salud ocupacional
   ------------------------------------------------------------
   Entregable 2 de la propuesta de Expediente Médico Electrónico.
   ⚠ Sólo información AGREGADA. Esta pantalla no muestra
   diagnósticos ni datos clínicos individuales, aunque la
   consulten Salud Ocupacional, Seguridad Industrial o RH.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, fmt, hoyISO, tabla, descargarCSV, toast } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;

  const sesion = ZX.requiereSesion('indicadores');
  if (!sesion) return;

  const vistas = [
    { id: 'tablero', nombre: 'Indicadores', ico: '📈' },
    { id: 'etapa1', nombre: 'Etapa 1 · Análisis', ico: '🧪' },
    { id: 'motivos', nombre: 'Motivos de consulta', ico: '🩹' },
    { id: 'tendencias', nombre: 'Departamento y turno', ico: '🏭' },
    { id: 'ficha', nombre: 'Fichas de cálculo', ico: '🧮' }
  ];
  const shell = ZX.montarShell('indicadores', 'Tablero de salud ocupacional', vistas);
  const main = shell.main;

  const ANIO = String(new Date().getFullYear());
  let anio = ANIO;
  let D = null, IND = null;

  let vista = 'tablero';
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await cargar(); render(); });

  async function cargar() {
    const [emps, consultas, riesgos, incapacidades, programa, vacunas] = await Promise.all([
      API.empleados.lista(), API.medico.consultas(), API.medico.riesgos(),
      API.medico.incapacidades(), API.medico.programa(), API.medico.vacunas()
    ]);
    const vigilancia = await Promise.all(emps.map(e => API.medico.vigilancia(e.id)));
    const [progAnalisis, resAnalisis, casosAnalisis] = await Promise.all([
      API.analisis.programacion(), API.analisis.resultados(), API.analisis.casos()
    ]);
    D = { emps, consultas, riesgos, incapacidades, programa, vacunas, vigilancia,
          progAnalisis, resAnalisis, casosAnalisis };
    calcular();
  }

  const delAnio = (arr, campo) => arr.filter(x => String(x[campo] || '').slice(0, 4) === anio);

  function calcular() {
    const activos = D.emps.filter(e => e.estatus !== 'baja');
    const n = Math.max(1, activos.length);

    const consultas = delAnio(D.consultas, 'fecha');
    const riesgos = delAnio(D.riesgos, 'fecha');
    const accidentes = riesgos.filter(r => r.tipo === 'accidente');
    const incap = delAnio(D.incapacidades, 'inicio');
    const diasIncap = incap.reduce((a, i) => a + (i.dias || 0), 0);

    const casos = D.vigilancia.reduce((a, v) => a.concat(v.casos || []), []);
    const casosAbiertos = casos.filter(c => c.estado !== 'cerrado');

    const prog = D.programa;
    const progPeriodicos = prog.filter(p => p.tipo === 'periodico');
    const restricciones = D.vigilancia.filter(v => v.restricciones && v.restricciones.toLowerCase() !== 'ninguna');

    const pct = (a, b) => b ? +(a / b * 100).toFixed(1) : 0;

    IND = {
      activos: activos.length,
      lista: [
        { id: 1, concepto: 'Número de consultas médicas', nombre: 'Tasa de atención médica',
          valor: pct(consultas.length, n), unidad: '%', num: consultas.length, den: n,
          formula: 'Consultas realizadas ÷ colaboradores activos × 100',
          fuente: 'Expediente médico electrónico · registro de consultas · maestro de personal',
          detalle: consultas.length + ' ' + plural(consultas.length, 'consulta', 'consultas') + ' entre ' + n + ' colaboradores activos',
          sentido: 'neutro' },

        { id: 2, concepto: 'Principales motivos de atención', nombre: 'Distribución porcentual de motivos de consulta',
          valor: motivoTop().pct, unidad: '%', num: motivoTop().n, den: consultas.length,
          formula: 'Consultas por motivo ÷ total de consultas × 100',
          fuente: 'Expediente médico · catálogo de motivos de consulta',
          detalle: 'Motivo más frecuente: ' + motivoTop().nombre, sentido: 'neutro' },

        { id: 3, concepto: 'Accidentes de trabajo', nombre: 'Tasa de incidencia de accidentes de trabajo',
          valor: pct(accidentes.length, n), unidad: '%', num: accidentes.length, den: n,
          formula: 'Accidentes de trabajo registrados ÷ promedio de colaboradores × 100',
          fuente: 'Expediente médico · registro de accidentes · Seguridad Industrial',
          detalle: accidentes.length + ' ' + plural(accidentes.length, 'accidente', 'accidentes') + ' en ' + anio,
          sentido: 'menor_mejor' },

        { id: 4, concepto: 'Incapacidades', nombre: 'Índice de días de incapacidad',
          valor: +(diasIncap / n).toFixed(2), unidad: 'días/colaborador', num: diasIncap, den: n,
          formula: 'Total de días de incapacidad ÷ promedio de colaboradores',
          fuente: 'Expediente médico · incapacidades · RH / nómina',
          detalle: diasIncap + ' días perdidos en ' + incap.length + ' ' + plural(incap.length, 'incapacidad', 'incapacidades'),
          sentido: 'menor_mejor' },

        { id: 5, concepto: 'Casos en seguimiento', nombre: 'Porcentaje de casos médicos en seguimiento',
          valor: pct(casosAbiertos.length, casos.length), unidad: '%', num: casosAbiertos.length, den: casos.length,
          formula: 'Casos abiertos en seguimiento ÷ total de casos registrados × 100',
          fuente: 'Expediente médico · agenda y registros de seguimiento',
          detalle: casosAbiertos.length + ' abiertos de ' + casos.length + ' casos', sentido: 'menor_mejor' },

        { id: 6, concepto: 'Evaluaciones médicas pendientes', nombre: 'Cumplimiento de evaluaciones médicas',
          valor: pct(prog.filter(p => p.estado === 'realizada').length, prog.length), unidad: '%',
          num: prog.filter(p => p.estado === 'realizada').length, den: prog.length,
          formula: 'Evaluaciones realizadas ÷ evaluaciones programadas × 100',
          fuente: 'Expediente médico · calendario de evaluaciones · RH',
          detalle: prog.filter(p => p.estado === 'vencida').length + ' vencidas sin realizar', sentido: 'mayor_mejor' },

        { id: 7, concepto: 'Exámenes periódicos pendientes', nombre: 'Cumplimiento de exámenes médicos periódicos',
          valor: pct(progPeriodicos.filter(p => p.estado === 'realizada').length, progPeriodicos.length), unidad: '%',
          num: progPeriodicos.filter(p => p.estado === 'realizada').length, den: progPeriodicos.length,
          formula: 'Exámenes periódicos realizados ÷ programados × 100',
          fuente: 'Expediente médico · programa de vigilancia médica',
          detalle: progPeriodicos.length + ' exámenes periódicos en el programa', sentido: 'mayor_mejor' },

        { id: 8, concepto: 'Restricciones laborales vigentes', nombre: 'Colaboradores con restricciones laborales vigentes',
          valor: restricciones.length, unidad: plural(restricciones.length, 'colaborador', 'colaboradores'),
          num: restricciones.length, den: n,
          formula: 'Conteo de colaboradores con restricción vigente al corte',
          fuente: 'Expediente médico · dictámenes de aptitud · Salud Ocupacional',
          detalle: pct(restricciones.length, n) + '% de la plantilla activa', sentido: 'neutro' },

        { id: 9, concepto: 'Indicadores de salud ocupacional', nombre: 'Índice de frecuencia de eventos de salud ocupacional',
          valor: pct(riesgos.length, n), unidad: '%', num: riesgos.length, den: n,
          formula: 'Eventos de salud ocupacional registrados ÷ colaboradores × 100',
          fuente: 'Expediente médico · accidentes · enfermedades de trabajo · Seguridad Industrial',
          detalle: riesgos.length + ' ' + plural(riesgos.length, 'evento', 'eventos') + ' (accidentes, incidentes y enfermedades de trabajo)',
          sentido: 'menor_mejor' },

        { id: 10, concepto: 'Tendencias por departamento/turno', nombre: 'Tasa de eventos de salud por departamento y turno',
          valor: tendenciaTop().tasa, unidad: '%', num: tendenciaTop().eventos, den: tendenciaTop().personas,
          formula: 'Eventos de salud en el departamento/turno ÷ colaboradores del departamento/turno × 100',
          fuente: 'Expediente médico · maestro de personal (departamento y turno) · Seguridad Industrial',
          detalle: 'Mayor tasa: ' + tendenciaTop().etiqueta, sentido: 'menor_mejor' }
      ]
    };
  }

  function motivos() {
    const consultas = delAnio(D.consultas, 'fecha');
    const mapa = {};
    consultas.forEach(c => {
      const cod = c.motivoCod || 'M99';
      mapa[cod] = (mapa[cod] || 0) + 1;
    });
    return Object.keys(mapa).map(cod => {
      const m = CAT.motivosConsulta.find(x => x.c === cod) || { c: cod, n: 'Sin catalogar', g: 'Otro' };
      return { cod: cod, nombre: m.n, grupo: m.g, n: mapa[cod], pct: +(mapa[cod] / consultas.length * 100).toFixed(1) };
    }).sort((a, b) => b.n - a.n);
  }
  function motivoTop() {
    const m = motivos()[0];
    return m || { nombre: 'Sin consultas en el periodo', n: 0, pct: 0 };
  }

  function tendencias() {
    const grupos = {};
    D.emps.filter(e => e.estatus !== 'baja').forEach(e => {
      const key = (e.departamento || '—') + ' · ' + (e.turno || '—');
      if (!grupos[key]) grupos[key] = { etiqueta: key, departamento: e.departamento, turno: e.turno, personas: 0, eventos: 0, incap: 0, consultas: 0 };
      grupos[key].personas++;
    });
    delAnio(D.riesgos, 'fecha').forEach(r => {
      const e = D.emps.find(x => x.id === r.empleado); if (!e) return;
      const key = (e.departamento || '—') + ' · ' + (e.turno || '—');
      if (grupos[key]) grupos[key].eventos++;
    });
    delAnio(D.incapacidades, 'inicio').forEach(i => {
      const e = D.emps.find(x => x.id === i.empleado); if (!e) return;
      const key = (e.departamento || '—') + ' · ' + (e.turno || '—');
      if (grupos[key]) grupos[key].incap += i.dias || 0;
    });
    delAnio(D.consultas, 'fecha').forEach(c => {
      const e = D.emps.find(x => x.id === c.empleado); if (!e) return;
      const key = (e.departamento || '—') + ' · ' + (e.turno || '—');
      if (grupos[key]) grupos[key].consultas++;
    });
    return Object.keys(grupos).map(kk => {
      const g = grupos[kk];
      g.tasa = g.personas ? +(g.eventos / g.personas * 100).toFixed(1) : 0;
      return g;
    }).sort((a, b) => b.tasa - a.tasa);
  }
  function tendenciaTop() {
    const t = tendencias()[0];
    return t || { etiqueta: 'Sin datos', tasa: 0, eventos: 0, personas: 0 };
  }

  function render() { ({ tablero, etapa1, motivos: vistaMotivos, tendencias: vistaTendencias, ficha }[vista] || tablero)(); }

  /* ---------------- ETAPA 1 · Análisis clínicos ----------------
     Indicadores del alcance vigente (documento v3). Se calculan con la
     programación, los resultados validados y los casos de seguimiento. */
  function etapa1() {
    const CATx = window.ZX_CAT;
    const a = D.emps.filter(e => e.estatus !== 'baja');
    const n = Math.max(1, a.length);
    const evaluados = new Set(D.progAnalisis.filter(p => p.estado === 'realizado').map(p => p.empleado));
    const validados = D.resAnalisis.filter(r => r.valoracion !== 'pendiente_validacion');
    const desviaciones = D.resAnalisis.filter(r => r.valoracion === 'desviacion');
    const casos = D.casosAnalisis;
    const abiertos = casos.filter(c => c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere');
    const cerrados = casos.filter(c => c.estatus === 'alta_cierre');
    const dias = cerrados.map(c => ZX.diffDias(c.fechaDeteccion, c.fechaCierre));
    const prom = dias.length ? Math.round(dias.reduce((x, y) => x + y, 0) / dias.length) : null;
    const vencidas = casos.filter(c => c.proximaValoracion && c.proximaValoracion < hoyISO() &&
      c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere');
    const pct = (x, y) => y ? +(x / y * 100).toFixed(1) : 0;

    const lista = [
      { id: 'E1-1', concepto: 'Cobertura de evaluación', nombre: 'Porcentaje de plantilla evaluada',
        valor: pct(evaluados.size, n), unidad: '%', num: evaluados.size, den: n,
        formula: 'Colaboradores con evaluación realizada ÷ plantilla activa × 100',
        fuente: 'Programación de análisis · maestro de personal',
        detalle: evaluados.size + ' de ' + n + ' colaboradores activos', sentido: 'mayor_mejor' },
      { id: 'E1-2', concepto: 'Resultados validados', nombre: 'Avance de validación médica',
        valor: pct(validados.length, D.resAnalisis.length), unidad: '%',
        num: validados.length, den: D.resAnalisis.length,
        formula: 'Resultados validados ÷ resultados registrados × 100',
        fuente: 'Registro de resultados de análisis',
        detalle: (D.resAnalisis.length - validados.length) + ' pendientes de validación', sentido: 'mayor_mejor' },
      { id: 'E1-3', concepto: 'Desviaciones detectadas', nombre: 'Tasa de desviación',
        valor: pct(desviaciones.length, validados.length), unidad: '%',
        num: desviaciones.length, den: validados.length,
        formula: 'Resultados con desviación ÷ resultados validados × 100',
        fuente: 'Validación médica de resultados',
        detalle: desviaciones.length + ' desviaciones sobre ' + validados.length + ' validados', sentido: 'menor_mejor' },
      { id: 'E1-4', concepto: 'Casos en seguimiento', nombre: 'Porcentaje de casos abiertos',
        valor: pct(abiertos.length, casos.length), unidad: '%', num: abiertos.length, den: casos.length,
        formula: 'Casos abiertos ÷ total de casos registrados × 100',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: abiertos.length + ' abiertos de ' + casos.length + ' casos', sentido: 'menor_mejor' },
      { id: 'E1-5', concepto: 'Casos cerrados', nombre: 'Porcentaje de casos con alta médica',
        valor: pct(cerrados.length, casos.length), unidad: '%', num: cerrados.length, den: casos.length,
        formula: 'Casos en alta/cierre ÷ total de casos × 100',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: cerrados.length + ' casos cerrados', sentido: 'mayor_mejor' },
      { id: 'E1-6', concepto: 'Tiempo de resolución', nombre: 'Días promedio de la detección al alta',
        valor: prom == null ? 0 : prom, unidad: 'días', num: dias.reduce((x, y) => x + y, 0), den: dias.length,
        formula: 'Suma de días (detección → alta) ÷ casos cerrados',
        fuente: 'Casos de seguimiento cerrados',
        detalle: dias.length ? 'Sobre ' + dias.length + ' casos cerrados' : 'Aún sin casos cerrados', sentido: 'menor_mejor' },
      { id: 'E1-7', concepto: 'Valoraciones vencidas', nombre: 'Casos con control fuera de fecha',
        valor: vencidas.length, unidad: vencidas.length === 1 ? 'caso' : 'casos', num: vencidas.length, den: abiertos.length,
        formula: 'Conteo de casos abiertos cuya próxima valoración ya pasó',
        fuente: 'Casos de seguimiento de la Etapa 1',
        detalle: abiertos.length ? 'De ' + abiertos.length + ' casos abiertos' : 'Sin casos abiertos', sentido: 'menor_mejor' }
    ];

    const porEstatus = CATx.estatusCaso.map(e => ({ n: e.n, total: casos.filter(c => c.estatus === e.c).length }));

    main.innerHTML =
      cab('Indicadores de la Etapa 1', 'Control y seguimiento de análisis clínicos · lineamiento SQF',
          '<button class="btn gh" id="csvE1">⬇ CSV</button>') +
      AVISO_AGREGADO +
      '<div class="grid g3">' + lista.map(tarjeta).join('') + '</div>' +
      '<h2 class="sec-t">Casos por estatus</h2>' +
      tabla([
        { t: 'Estatus', v: e => e.n }, { t: 'Casos', v: e => e.total },
        { t: '% del total', v: e => casos.length ? Math.round(e.total / casos.length * 100) + '%' : '0%' }
      ], porEstatus, {}) +
      '<div class="nota"><b>Meta de la Etapa 1.</b> Al término de las cuatro semanas debe poder responderse, con estos ' +
      'indicadores: quiénes fueron evaluados, quiénes están pendientes, qué desviaciones se detectaron, cuántas están en ' +
      'seguimiento y cuáles ya se cerraron.</div>';

    ZX.pie(main, 'Los indicadores de la Etapa 1 se alimentan de la programación, los resultados validados y los casos de seguimiento del propio portal.');
    $('#csvE1').addEventListener('click', () => descargarCSV('Indicadores_Etapa1_' + hoyISO() + '.csv', [
      { t: 'Clave', k: 'id' }, { t: 'Concepto', k: 'concepto' }, { t: 'Indicador', k: 'nombre' },
      { t: 'Valor', k: 'valor' }, { t: 'Unidad', k: 'unidad' }, { t: 'Numerador', k: 'num' },
      { t: 'Denominador', k: 'den' }, { t: 'Fórmula', k: 'formula' }, { t: 'Fuente', k: 'fuente' }
    ], lista));
  }

  const AVISO_AGREGADO =
    '<div class="priv">📊 <div><b>Información agregada.</b> Este tablero no muestra diagnósticos, expedientes ni datos clínicos ' +
    'individuales. Los indicadores de restricciones, motivos de consulta y tendencias se presentan sólo al nivel necesario para la ' +
    'gestión, conforme al criterio de confidencialidad de la NOM-035-STPS y a la propuesta de expediente médico electrónico.</div></div>';

  /* ---------------------- TABLERO ---------------------- */
  function tablero() {
    main.innerHTML =
      cab('Indicadores de salud ocupacional', 'Ejercicio ' + anio + ' · ' + IND.activos + ' colaboradores activos',
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO +
      filtroAnio() +
      '<div class="grid g3">' + IND.lista.map(tarjeta).join('') + '</div>';

    ZX.pie(main, 'Cada indicador muestra su fórmula y las cifras que la alimentan. El periodo es el año calendario seleccionado; los indicadores de cumplimiento consideran el programa completo de evaluaciones, no sólo las del año.');
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

  /* ------------------ MOTIVOS DE CONSULTA ------------------ */
  function vistaMotivos() {
    const lista = motivos();
    const max = Math.max(1, ...lista.map(m => m.n));
    const porGrupo = {};
    lista.forEach(m => { porGrupo[m.grupo] = (porGrupo[m.grupo] || 0) + m.n; });

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
            { t: 'Grupo', v: g => g.grupo }, { t: 'Consultas', v: g => g.n },
            { t: '% del total', v: g => g.pct + '%' }
          ], Object.keys(porGrupo).map(g => ({
              grupo: g, n: porGrupo[g], pct: +(porGrupo[g] / lista.reduce((a, m) => a + m.n, 0) * 100).toFixed(1)
            })).sort((a, b) => b.n - a.n), {})
        : '<div class="tbl-wrap"><div class="empty">Sin consultas registradas en ' + esc(anio) + '.</div></div>');

    ZX.pie(main, 'La clasificación proviene del catálogo cerrado de motivos de consulta que captura el médico. Las consultas marcadas como “M99 · Otro” deben revisarse periódicamente para decidir si amerita ampliar el catálogo.');
    bindAnio();
    $('#csv').addEventListener('click', () => descargarCSV('Motivos_Consulta_' + anio + '.csv',
      [{ t: 'Código', k: 'cod' }, { t: 'Motivo', k: 'nombre' }, { t: 'Grupo', k: 'grupo' },
       { t: 'Consultas', k: 'n' }, { t: '% del total', k: 'pct' }], lista));
  }

  /* -------------------- ÁREA Y TURNO -------------------- */
  function vistaTendencias() {
    const lista = tendencias();
    const cols = [
      { t: 'Departamento', k: 'departamento' }, { t: 'Turno', k: 'turno' }, { t: 'Colaboradores', k: 'personas' },
      { t: 'Eventos de salud', k: 'eventos' }, { t: 'Días de incapacidad', k: 'incap' },
      { t: 'Consultas', k: 'consultas' }, { t: 'Tasa de eventos', v: g => g.tasa + '%' }
    ];
    main.innerHTML =
      cab('Tendencias por departamento y turno', 'Ejercicio ' + anio, '<button class="btn gh" id="csv">⬇ CSV</button>') +
      AVISO_AGREGADO + filtroAnio() +
      tabla(cols, lista, { vacio: 'Sin datos para el periodo.' }) +
      '<div class="nota" style="margin-top:16px"><b>Sobre el tamaño de los grupos.</b> Cuando un departamento o turno tiene muy pocos ' +
      'colaboradores, la tasa deja de ser un dato agregado y puede identificar a una persona concreta. Antes de publicar este ' +
      'tablero conviene definir un umbral mínimo de personas por grupo (por ejemplo 5) y ocultar los grupos que no lo alcancen.</div>';

    ZX.pie(main, 'Departamento y turno se toman del maestro de personal. En el modelo final estos campos vendrán de IBIX, por lo que la calidad del indicador depende de que ese maestro esté actualizado.');
    bindAnio();
    $('#csv').addEventListener('click', () => descargarCSV('Tendencias_Area_Turno_' + anio + '.csv', cols, lista));
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
    if (fa) fa.addEventListener('change', e => { anio = e.target.value; calcular(); render(); });
  }
  function plural(n2, uno, muchos) { return n2 === 1 ? uno : muchos; }
  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
})();

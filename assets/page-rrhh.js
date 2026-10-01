/* ============================================================
   Portal Zubex — Módulo Recursos Humanos
   Digitalización del formato RHF-34 "Movimiento de Personal"
   con flujo de firmas + expediente documental por colaborador.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, chip, fmt, fmtLargo, hoyISO, tabla, modal, cerrarModal, confirmar, descargarCSV } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;

  const sesion = ZX.requiereSesion('rrhh');
  if (!sesion) return;

  const vistas = [
    { id: 'tablero',   nombre: 'Tablero',              ico: '📊' },
    { id: 'movs',      nombre: 'Movimientos RHF-34',   ico: '📄' },
    { id: 'nuevo',     nombre: 'Nuevo movimiento',     ico: '➕' },
    { id: 'maestro',   nombre: 'Maestro de colaboradores', ico: '🧾' },
    { id: 'expedientes', nombre: 'Expedientes',        ico: '🗄️' }
  ];
  const shell = ZX.montarShell('rrhh', 'Recursos Humanos · Gestión documental', vistas);
  const main = shell.main;

  let D = { emps: [], movs: [], cats: { departamentos: [], areas: [], turnos: [] } };
  const empDe = id => D.emps.find(e => e.id === id) || {};
  const nombreDe = id => empDe(id).nombre || id || '—';

  async function recargar() {
    const [emps, movs, cats] = await Promise.all([API.empleados.lista(), API.rrhh.movimientos(), API.empleados.catalogos()]);
    D = { emps, movs, cats };
  }

  let vista = 'tablero';
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); });
  async function refrescar() { await recargar(); render(); }
  function render() { ({ tablero, movs: listaMovs, nuevo, maestro, expedientes }[vista] || tablero)(); }

  /* ================= MAESTRO DE COLABORADORES =================
     Datos que administra Relaciones Laborales: puesto, área, turno,
     antigüedad y estatus. En el modelo final estos campos llegarán
     desde IBIX y esta pantalla quedará sólo de consulta. */
  let qm = '', fArea = '', fTurno = '';
  function maestro() {
    const D2 = { AREAS: D.cats.areas, TURNOS: D.cats.turnos, DEPARTAMENTOS: D.cats.departamentos };
    const lista = D.emps.filter(e =>
      (!fArea || e.area === fArea) && (!fTurno || e.turno === fTurno) &&
      (!qm || (e.nombre + ' ' + e.id + ' ' + e.depto + ' ' + (e.puesto || '')).toLowerCase().indexOf(qm.toLowerCase()) >= 0));
    const sinTurno = D.emps.filter(e => !e.turno).length;
    const cols = [
      { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Puesto', k: 'puesto' },
      { t: 'Departamento', k: 'depto' }, { t: 'Área', k: 'area' }, { t: 'Turno', k: 'turno' },
      { t: 'Ingreso', v: e => fmt(e.ingreso) }, { t: 'Antigüedad', v: e => ZX.antiguedad(e.ingreso) + ' años' },
      { t: 'Estatus', k: 'estatus' }
    ];

    main.innerHTML =
      cab('Maestro de colaboradores', D.emps.length + ' registros · datos laborales que alimentan los indicadores',
          '<button class="btn gh" id="csv">⬇ CSV</button><button class="btn" id="ibix">⬆ Importar desde IBIX</button>') +
      '<div class="priv">🔄 <div><b>Origen de estos datos.</b> Hoy se capturan en el portal. El objetivo es que <b>IBIX</b> sea la ' +
      'fuente única de los datos laborales (puesto, área, turno, antigüedad y estatus) y que el portal los consuma de ahí. ' +
      'Mientras tanto, mantener el turno y el área actualizados es lo que hace confiable el indicador de tendencias por área y turno.</div></div>' +
      '<div class="grid g4">' +
        k('Colaboradores activos', D.emps.filter(e => e.estatus !== 'baja').length, 'En el registro de personal') +
        k('Áreas', new Set(D.emps.map(e => e.area).filter(Boolean)).size, 'Con personal asignado') +
        k('Turnos en uso', new Set(D.emps.map(e => e.turno).filter(Boolean)).size, 'Configurados') +
        k('Sin turno asignado', sinTurno, sinTurno ? 'Afectan los indicadores por turno' : 'Registro completo', sinTurno ? 'dn' : 'gn') +
      '</div>' +
      '<div class="filters" style="margin-top:14px">' +
        '<div class="field" style="min-width:230px"><label>Buscar</label>' +
          '<input id="qm" value="' + esc(qm) + '" placeholder="Nombre, número, puesto o departamento"></div>' +
        '<div class="field"><label>Área</label><select id="fa">' +
          opts([['', 'Todas']].concat(D2.AREAS.map(a => [a, a])), fArea) + '</select></div>' +
        '<div class="field"><label>Turno</label><select id="ft2">' +
          opts([['', 'Todos']].concat(D2.TURNOS.map(t => [t, t])), fTurno) + '</select></div>' +
      '</div>' +
      tabla(cols.slice(0, 8).concat([
        { t: 'Estatus', html: e => '<span class="chip ' + (e.estatus === 'baja' ? 'no' : 'ok') + '">' + esc(e.estatus || 'activo') + '</span>' },
        { t: '', html: e => '<button class="btn sm" data-edit="' + esc(e.id) + '">Editar</button>' }
      ]), lista, { vacio: 'Sin coincidencias.' });

    ZX.pie(main, 'Área y turno son datos maestros: los indicadores de salud ocupacional por área y turno se calculan con estos campos, no con lo que declara el colaborador en su historia clínica.');
    const qi = $('#qm');
    qi.addEventListener('input', () => { qm = qi.value; const p = qi.selectionStart; maestro(); const n = $('#qm'); n.focus(); n.setSelectionRange(p, p); });
    $('#fa').addEventListener('change', e => { fArea = e.target.value; maestro(); });
    $('#ft2').addEventListener('change', e => { fTurno = e.target.value; maestro(); });
    $('#csv').addEventListener('click', () => descargarCSV('Maestro_Colaboradores_' + hoyISO() + '.csv', cols, lista));
    $('#ibix').addEventListener('click', abrirImportadorIBIX);
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => popupMaestro(b.dataset.edit)));
  }

  /* ================= IMPORTAR DESDE IBIX =================
     Sube un CSV, reconoce encabezados por alias (cada exportación de
     IBIX puede nombrar sus columnas distinto), muestra una vista previa
     del mapeo y de los cambios antes de aplicar nada, y al confirmar
     llama a API.empleados.sincronizarIBIX — que nunca toca nivel/perfil:
     esos se asignan a mano en Administración después de importar. */
  const ALIAS_IBIX = {
    id:      ['nomina', 'noempleado', 'numeroempleado', 'numempleado', 'no', 'id', 'empleado', 'clave', 'numerodeempleado', 'nodeempleado'],
    nombre:  ['nombre', 'nombrecompleto', 'colaborador', 'nombredelcolaborador'],
    correo:  ['correo', 'email', 'correoelectronico', 'mail'],
    depto:   ['departamento', 'depto'],
    area:    ['area', 'planta'],
    turno:   ['turno'],
    puesto:  ['puesto', 'posicion', 'puestoactual', 'cargo'],
    jefe:    ['jefe', 'supervisor', 'jefedirecto', 'reportaa', 'nojefe', 'nominajefe'],
    ingreso: ['ingreso', 'fechaingreso', 'fechadeingreso', 'fechaalta'],
    estatus: ['estatus', 'status', 'situacion', 'activo']
  };
  /* Quita acentos, espacios y puntuación: "No. Empleado" y "Nº Empleado"
     terminan en la misma forma canónica que "no_empleado". Coincidencia
     exacta contra esa forma (no "contiene"), para no confundir columnas
     cortas como "no" con fragmentos de otras palabras. */
  const normalizar = h => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  function mapearEncabezados(headers) {
    const mapa = {}; // campo → encabezado original que hace match
    const usados = new Set();
    Object.keys(ALIAS_IBIX).forEach(campo => {
      const alias = ALIAS_IBIX[campo];
      const encontrado = headers.find(h => !usados.has(h) && alias.indexOf(normalizar(h)) >= 0);
      if (encontrado) { mapa[campo] = encontrado; usados.add(encontrado); }
    });
    return mapa;
  }

  function abrirImportadorIBIX() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,text/csv';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const lector = new FileReader();
      lector.onload = () => previsualizarImportacion(String(lector.result || ''), file.name);
      lector.onerror = () => toast('No se pudo leer el archivo.', 'no');
      lector.readAsText(file, 'UTF-8');
    });
    input.click();
  }

  function previsualizarImportacion(texto, nombreArchivo) {
    const { headers, filas } = ZX.leerCSV(texto);
    if (!headers.length) return toast('El archivo está vacío o no se pudo interpretar como CSV.', 'no');

    const mapa = mapearEncabezados(headers);
    const sinMapear = headers.filter(h => Object.values(mapa).indexOf(h) < 0);
    if (!mapa.id) {
      return toast('No encontré una columna de número de nómina en "' + nombreArchivo + '". Encabezados leídos: ' + headers.join(', '), 'no');
    }

    const filasMapeadas = filas.map(f => {
      const o = {};
      Object.keys(mapa).forEach(campo => { o[campo] = f[mapa[campo]]; });
      return o;
    });
    const conId = filasMapeadas.filter(f => f.id).length;

    const body = modal({
      titulo: 'Importar desde IBIX · ' + nombreArchivo,
      ancho: 'lg',
      cuerpo:
        '<p style="font-size:13px;margin-bottom:10px">' + filas.length + ' filas leídas, ' + conId + ' con número de nómina.</p>' +
        '<div class="field"><label>Columnas reconocidas</label>' +
          '<p style="font-size:12.5px">' + Object.keys(mapa).map(c => '<span class="chip ok" style="margin:2px">' + esc(c) + ' ← ' + esc(mapa[c]) + '</span>').join(' ') + '</p></div>' +
        (sinMapear.length ? '<div class="field"><label>Columnas del archivo que se ignorarán</label>' +
          '<p style="font-size:12.5px;color:var(--tx2)">' + esc(sinMapear.join(', ')) + '</p></div>' : '') +
        '<div class="priv" style="align-items:flex-start">🔄 <div>Esto <b>no toca nivel ni perfil</b> de nadie. Colaboradores nuevos entran con acceso ' +
          'mínimo (Empleado, sin perfil adicional) y contraseña temporal — asígnales su nivel y perfil después, en ' +
          '<a href="admin.html">Administración → Usuarios</a>.</div></div>' +
        '<div class="priv" style="align-items:flex-start">🚫 <div><b>Quien esté activo hoy y no aparezca en este archivo se suspenderá ' +
          'automáticamente</b> (no se elimina: conserva su expediente, sólo pierde el acceso). Si el archivo trae menos del ' +
          '90% de las personas activas actuales, la importación se cancela completa y no se toca a nadie — es la protección ' +
          'contra un archivo incompleto o a medio exportar.</div></div>' +
        '<div id="muestra" class="tbl-wrap" style="margin-top:10px"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Confirmar e importar', accion: async (b) => {
            try {
              const resumen = await API.empleados.sincronizarIBIX(filasMapeadas, sesion.id);
              cerrarModal();
              mostrarResultadoImportacion(resumen);
              await refrescar();
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });

    const muestra = filasMapeadas.slice(0, 5);
    $('#muestra', body).innerHTML = muestra.length ? tabla(
      Object.keys(mapa).map(c => ({ t: c, v: f => f[c] || '—' })), muestra, {}
    ) + '<p style="font-size:11.5px;color:var(--tx3);margin-top:4px">Muestra de las primeras 5 filas mapeadas, de ' + filasMapeadas.length + '.</p>' : '';
  }

  function mostrarResultadoImportacion(r) {
    const hayNuevos = r.nuevos.length > 0;
    modal({
      titulo: 'Importación completada',
      ancho: 'lg',
      cuerpo:
        '<div class="grid g4" style="margin-bottom:12px">' +
          k2('Nuevos', r.nuevos.length) + k2('Actualizados', r.actualizados.length) +
          k2('Suspendidos', r.suspendidos.length, r.suspendidos.length ? 'wn' : '') +
          k2('Sin cambios', r.sinCambios) +
        '</div>' +
        (r.errores.length ? '<div class="field"><label>Filas con error</label><p style="font-size:12.5px;color:var(--dnt)">' + esc(r.errores.join(' · ')) + '</p></div>' : '') +
        (r.suspendidos.length ? '<div class="priv" style="align-items:flex-start">🚫 <div><b>Se suspendió el acceso de ' + r.suspendidos.length +
          ' persona(s)</b> por ya no aparecer en el archivo de IBIX. Su expediente se conserva; si alguna suspensión no ' +
          'corresponde, reactívala manualmente en Administración → Usuarios.<br>' +
          r.suspendidos.map(n => esc(n)).join(' · ') + '</div></div>' : '') +
        (hayNuevos ? '<div class="priv" style="align-items:flex-start">🔑 <div><b>' + r.nuevos.length + ' colaborador(es) nuevo(s)</b> con contraseña ' +
          'temporal generada. Descárgala, entrégala por un medio controlado y <b>bórrala el mismo día</b> — igual que se ' +
          'documentó para Medico ZX. Todavía no tienen nivel ni perfil asignado: entra a Administración → Usuarios para dárselos.</div></div>' +
          '<div style="max-height:180px;overflow:auto;font-size:12.5px;margin-top:8px">' +
            r.nuevos.map(n => '<div>' + esc(n) + '</div>').join('') + '</div>' : '<p style="font-size:13px">Sin colaboradores nuevos en este archivo.</p>'),
      botones: hayNuevos ? [
        { txt: 'Cerrar', clase: 'gh' },
        { txt: '⬇ Descargar credenciales temporales', accion: () => {
            descargarCSV('Credenciales_Iniciales_IBIX_' + hoyISO() + '.csv',
              [{ t: 'Número', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Contraseña temporal', k: 'temporal' }],
              r.credenciales);
          } }
      ] : [{ txt: 'Cerrar', clase: 'gh' }]
    });
  }

  function k2(l, v, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) + '</div></div>';
  }

  function popupMaestro(id) {
    const D2 = { AREAS: D.cats.areas, TURNOS: D.cats.turnos, DEPARTAMENTOS: D.cats.departamentos };
    const e = empDe(id);
    modal({
      titulo: 'Datos laborales · ' + e.nombre,
      cuerpo:
        '<div class="frow">' +
          fldv('puestoM', 'Puesto', e.puesto) +
          selv('deptoM', 'Departamento', D2.DEPARTAMENTOS, e.depto) +
          selv('areaM', 'Área', D2.AREAS, e.area) +
          selv('turnoM', 'Turno', D2.TURNOS, e.turno) +
          fldv('ingresoM', 'Fecha de ingreso', e.ingreso, 'date') +
          selv('estatusM', 'Estatus', ['activo', 'baja'], e.estatus || 'activo') +
        '</div>' +
        '<p class="hint" style="font-size:11px;color:var(--tx3)">Estos campos son los que en el modelo final vendrán de IBIX.</p>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            try {
              await API.empleados.actualizar(id, {
                puesto: $('#puestoM', b).value.trim(), depto: $('#deptoM', b).value,
                area: $('#areaM', b).value, turno: $('#turnoM', b).value,
                ingreso: $('#ingresoM', b).value, estatus: $('#estatusM', b).value
              });
              await API.auditoria.registrar('maestro.actualizar', id, id, 'Actualización de datos laborales');
              cerrarModal(); toast('Datos actualizados.', 'ok'); await refrescar();
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
  }

  function fldv(id, l, v, tipo) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<input id="' + esc(id) + '" type="' + (tipo || 'text') + '" maxlength="120" value="' + esc(v || '') + '"></div>';
  }
  function selv(id, l, opciones, v) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><select id="' + esc(id) + '">' +
      opciones.map(o => '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
      '</select></div>';
  }

  /* ========================= TABLERO ========================= */
  function tablero() {
    const m = D.movs;
    const enFirma = m.filter(x => x.estado === 'en_firma');
    const borradores = m.filter(x => x.estado === 'borrador');
    const completados = m.filter(x => x.estado === 'completado');
    const porTipo = {};
    CAT.tiposMovimiento.forEach(t => { porTipo[t.c] = m.filter(x => x.tipo === t.c).length; });
    const maxT = Math.max(1, ...Object.values(porTipo));

    main.innerHTML =
      cab('Tablero de RRHH', 'Estado de la digitalización de movimientos de personal',
          '<button class="btn" id="new">＋ Nuevo movimiento</button>') +
      '<div class="grid g4">' +
        k('Movimientos totales', m.length, 'Registrados en el sistema') +
        k('En firma', enFirma.length, 'Esperando alguna aprobación', enFirma.length ? 'wn' : 'gn') +
        k('Borradores', borradores.length, 'Sin enviar a firma') +
        k('Completados', completados.length, 'Con las 4 firmas', 'gn') +
      '</div>' +
      '<h2 class="sec-t">Movimientos por tipo</h2>' +
      '<div class="card">' + CAT.tiposMovimiento.map(t =>
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:230px;font-size:12.5px;color:var(--tx2)">' + esc(t.c + ') ' + t.n) + '</div>' +
          '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
            '<div style="width:' + (porTipo[t.c] / maxT * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
          '<b style="width:28px;text-align:right;font-size:13px">' + porTipo[t.c] + '</b>' +
        '</div>').join('') + '</div>' +
      '<h2 class="sec-t">Requieren atención</h2>' +
      tabla([
        { t: 'Folio', k: 'folio' },
        { t: 'Tipo', v: x => x.tipo + ') ' + x.tipoNombre },
        { t: 'Colaborador', v: x => x.empleadoNombre },
        { t: 'Etapa actual', v: x => etapaActual(x) },
        { t: 'Aplicación', v: x => fmt(x.aplicacion) },
        { t: 'Estado', html: x => chip(x.estado) },
        { t: '', html: x => '<button class="btn sm" data-ver="' + esc(x.id) + '">Abrir</button>' }
      ], enFirma.concat(borradores), { vacio: 'Nada pendiente. Todo al corriente.' });

    ZX.pie(main, 'Basado en el formato RHF-34 rev. 00 "Movimiento de Personal". Las firmas requeridas por tipo de movimiento siguen la matriz del formato impreso: jefe directo, gerente de área, dirección general y Recursos Humanos.');
    $('#new').addEventListener('click', () => irA('nuevo'));
    bindVer();
  }

  /* ==================== LISTA DE MOVIMIENTOS ==================== */
  let fEstado = '', fTipo = '', q = '';
  function listaMovs() {
    const f = D.movs.filter(x =>
      (!fEstado || x.estado === fEstado) && (!fTipo || x.tipo === fTipo) &&
      (!q || (x.folio + ' ' + x.empleadoNombre + ' ' + x.depto).toLowerCase().indexOf(q.toLowerCase()) >= 0));

    const cols = [
      { t: 'Folio', k: 'folio' },
      { t: 'Tipo', v: x => x.tipo + ') ' + x.tipoNombre },
      { t: 'Colaborador', v: x => x.empleadoNombre },
      { t: 'Departamento', k: 'depto' },
      { t: 'Elaboración', v: x => fmt(x.elaboracion) },
      { t: 'Aplicación', v: x => fmt(x.aplicacion) },
      { t: 'Firmas', v: x => x.firmas.filter(s => s.estado === 'firmado').length + '/' + x.firmas.length },
      { t: 'Estado', v: x => x.estado }
    ];

    main.innerHTML =
      cab('Movimientos RHF-34', f.length + ' documento(s)',
        '<button class="btn gh" id="csv">⬇ CSV</button><button class="btn" id="new">＋ Nuevo</button>') +
      '<div class="filters">' +
        '<div class="field" style="min-width:230px"><label>Buscar</label><input id="q" value="' + esc(q) + '" placeholder="Folio, colaborador o departamento"></div>' +
        '<div class="field"><label>Tipo</label><select id="ft">' + opts([['', 'Todos']].concat(CAT.tiposMovimiento.map(t => [t.c, t.c + ') ' + t.n])), fTipo) + '</select></div>' +
        '<div class="field"><label>Estado</label><select id="fe">' + opts([['', 'Todos'], ['borrador', 'Borrador'], ['en_firma', 'En firma'], ['completado', 'Completado'], ['rechazado', 'Rechazado']], fEstado) + '</select></div>' +
      '</div>' +
      tabla(cols.slice(0, 7).concat([
        { t: 'Estado', html: x => chip(x.estado) },
        { t: '', html: x => '<button class="btn sm" data-ver="' + esc(x.id) + '">Abrir</button>' }
      ]), f, { vacio: 'Sin movimientos con esos filtros.' });

    ZX.pie(main, 'El expediente digital sustituye la copia impresa del RHF-34; el documento se considera formalizado cuando las cuatro etapas de firma están completas.');

    const qi = $('#q');
    qi.addEventListener('input', () => { q = qi.value; const p = qi.selectionStart; listaMovs(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $('#ft').addEventListener('change', e => { fTipo = e.target.value; listaMovs(); });
    $('#fe').addEventListener('change', e => { fEstado = e.target.value; listaMovs(); });
    $('#csv').addEventListener('click', () => descargarCSV('Movimientos_RHF34_' + hoyISO() + '.csv', cols, f));
    $('#new').addEventListener('click', () => irA('nuevo'));
    bindVer();
  }

  /* ==================== DETALLE + FIRMAS ==================== */
  function verMovimiento(id) {
    const m = D.movs.find(x => x.id === id);
    if (!m) return toast('Movimiento no encontrado.', 'no');

    const det = Object.keys(m.detalle || {}).map(kk =>
      ro(etiquetaDetalle(kk), m.detalle[kk])).join('');

    const flow = m.firmas.map((f, i) => {
      const previoOk = m.firmas.slice(0, i).every(x => x.estado === 'firmado');
      const cls = f.estado === 'firmado' ? 'done' : f.estado === 'rechazado' ? 'rej' : (previoOk && m.estado === 'en_firma' ? 'now' : '');
      const ico = f.estado === 'firmado' ? '✓' : f.estado === 'rechazado' ? '✕' : (i + 1);
      return '<div class="flow-i ' + cls + '"><div class="flow-dot">' + ico + '</div><div class="flow-tx">' +
        '<b>' + esc(f.rol) + '</b>' +
        '<span>' + (f.estado === 'pendiente'
          ? (cls === 'now' ? 'Etapa actual — esperando firma' : 'Pendiente')
          : esc(nombreDe(f.quien) + ' · ' + fmt(f.fecha) + (f.nota ? ' · “' + f.nota + '”' : ''))) + '</span>' +
        (cls === 'now' ? '<div class="btn-row" style="margin-top:7px">' +
          '<button class="btn ok sm" data-firmar="' + esc(f.rol) + '">Firmar</button>' +
          '<button class="btn no sm" data-rechazar="' + esc(f.rol) + '">Rechazar</button></div>' : '') +
        '</div></div>';
    }).join('');

    main.innerHTML =
      cab('Movimiento ' + m.folio, m.tipo + ') ' + m.tipoNombre + ' · ' + m.empleadoNombre,
        (m.estado === 'borrador' ? '<button class="btn" id="enviar">Enviar a firma</button>' : '') +
        '<button class="btn gh" id="imprimir">🖨️ Imprimir</button>' +
        '<button class="btn gh" id="volver">← Volver</button>') +
      '<div style="margin-bottom:14px">' + chip(m.estado) + '</div>' +
      '<div class="grid g2">' +
        '<div class="card"><div class="card-t">Datos generales</div><div class="frow">' +
          ro('Nº de empleado', m.noEmpleado) + ro('Nombre', m.empleadoNombre) + ro('Puesto', m.puesto) +
          ro('Dirección', m.direccion) + ro('Departamento', m.depto) + ro('División', m.division) +
          ro('Jefe al que reporta', m.jefeReporta) + ro('Tipo de personal', m.tipoPersonal) +
          ro('Fecha de elaboración', fmt(m.elaboracion)) + ro('Fecha de aplicación', fmt(m.aplicacion)) +
        '</div></div>' +
        '<div class="card"><div class="card-t">Detalle del movimiento</div><div class="frow">' + (det || '<p class="page-sub">Sin detalle capturado.</p>') + '</div>' +
          '<div class="field"><label>Comentarios</label><div style="font-size:13px">' + esc(m.comentarios || '—') + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="grid g2">' +
        '<div class="card"><div class="card-t">Flujo de firmas</div><div class="flow">' + flow + '</div></div>' +
        '<div class="card"><div class="card-t"><span>Documentos adjuntos</span>' +
          '<button class="btn gh sm no-print" id="adj">＋ Registrar</button></div>' +
          tabla([
            { t: 'Archivo', k: 'nombre' }, { t: 'Tamaño', k: 'tam' }, { t: 'Fecha', v: a => fmt(a.subido || a.fecha) }
          ], m.adjuntos || [], { vacio: 'Sin documentos adjuntos.' }) +
        '</div>' +
      '</div>';

    ZX.pie(main, 'Réplica digital del formato RHF-34 rev. 00. La firma electrónica registra usuario, fecha y comentario; para valor probatorio pleno debe respaldarse con e.firma o un proveedor de firma avanzada.');

    $('#volver').addEventListener('click', () => irA('movs'));
    $('#imprimir').addEventListener('click', () => window.print());
    const bEnv = $('#enviar');
    if (bEnv) bEnv.addEventListener('click', async () => {
      try { await API.rrhh.enviarAFirma(m.id); toast('Movimiento enviado a firma.', 'ok'); await recargar(); verMovimiento(m.id); }
      catch (e) { toast(e.message, 'no'); }
    });
    $('#adj').addEventListener('click', () => popupAdjunto(m.id));
    $$('[data-firmar]').forEach(b => b.addEventListener('click', () => popupFirma(m.id, b.dataset.firmar, 'firmar')));
    $$('[data-rechazar]').forEach(b => b.addEventListener('click', () => popupFirma(m.id, b.dataset.rechazar, 'rechazar')));
  }

  function popupFirma(id, rol, decision) {
    modal({
      titulo: (decision === 'firmar' ? 'Firmar' : 'Rechazar') + ' — ' + rol,
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">Firmarás como <b>' + esc(sesion.nombre) + '</b> con fecha de hoy. ' +
        'La acción queda registrada y no puede deshacerse desde el portal.</p>' +
        '<div class="field"><label for="nota">Comentario</label><textarea id="nota" maxlength="300" placeholder="Opcional"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: decision === 'firmar' ? 'Firmar' : 'Rechazar', clase: decision === 'firmar' ? 'ok' : 'no',
          accion: async (b) => {
            try {
              await API.rrhh.firmar(id, rol, sesion.id, decision, $('#nota', b).value);
              cerrarModal(); toast(decision === 'firmar' ? 'Firma registrada.' : 'Movimiento rechazado.', decision === 'firmar' ? 'ok' : 'wa');
              await recargar(); verMovimiento(id);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupAdjunto(id) {
    modal({
      titulo: 'Registrar documento',
      cuerpo:
        '<div class="priv">📎 <div>Por ahora sólo se registra el <b>metadato</b> del documento (nombre y tipo). ' +
        'La carga del archivo (con antivirus, validación de tipo y control de acceso) aún no está conectada.</div></div>' +
        '<div class="field"><label for="tipo">Tipo de documento</label><select id="tipo">' +
          CAT.tiposDoc.map(t => '<option>' + esc(t) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="nom">Nombre del archivo</label><input id="nom" maxlength="80" placeholder="movimiento_firmado.pdf"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Registrar', accion: async (b) => {
            const nom = $('#nom', b).value.trim();
            if (!nom) return toast('Escribe el nombre del archivo.', 'wa');
            const m = D.movs.find(x => x.id === id);
            m.adjuntos = m.adjuntos || [];
            m.adjuntos.push({ nombre: nom, tam: '—', subido: hoyISO(), tipo: $('#tipo', b).value });
            cerrarModal(); toast('Documento registrado.', 'ok'); verMovimiento(id);
          } }
      ]
    });
  }

  /* ==================== NUEVO MOVIMIENTO ==================== */
  function nuevo() {
    main.innerHTML =
      cab('Nuevo movimiento de personal', 'Formato RHF-34 rev. 00 · captura digital') +
      '<form id="f">' +
        '<fieldset><legend>Datos generales (sólo personal ZX)</legend>' +
          '<div class="frow">' +
            selEmp() +
            fld('aplicacion', 'Fecha de aplicación', 'date') +
            fld('direccion', 'Dirección') +
            fld('division', 'División') +
            fld('jefeReporta', 'Nombre del jefe al que reporta') +
            selc('tipoPersonal', 'Tipo de personal', ['Administrativo', 'No administrativo', 'Sindicalizado']) +
          '</div>' +
        '</fieldset>' +
        '<fieldset><legend>Tipo de movimiento</legend>' +
          '<div class="field"><label for="tipo">Selecciona el inciso del formato</label><select id="tipo">' +
            CAT.tiposMovimiento.map(t => '<option value="' + esc(t.c) + '">' + esc(t.c + ') ' + t.n) + '</option>').join('') +
          '</select></div>' +
          '<div id="dyn"></div>' +
        '</fieldset>' +
        '<fieldset><legend>Comentarios</legend>' +
          '<div class="field"><textarea id="comentarios" maxlength="500" placeholder="Justificación del movimiento"></textarea></div>' +
        '</fieldset>' +
        '<div class="btn-row">' +
          '<button class="btn gh" type="button" id="borrador">Guardar como borrador</button>' +
          '<button class="btn" type="submit">Guardar y enviar a firma</button>' +
        '</div>' +
      '</form>';

    ZX.pie(main, 'Los campos mostrados cambian según el inciso del formato (A a E), igual que en la versión impresa del RHF-34.');

    const dyn = () => { $('#dyn').innerHTML = camposPorTipo($('#tipo').value); };
    $('#tipo').addEventListener('change', dyn); dyn();
    $('#emp').addEventListener('change', autollenar); autollenar();
    $('#borrador').addEventListener('click', () => guardar('borrador'));
    $('#f').addEventListener('submit', e => { e.preventDefault(); guardar('en_firma'); });
  }

  function autollenar() {
    const e = empDe($('#emp').value);
    if (!e.id) return;
    $('#direccion').value = $('#direccion').value || 'Operaciones';
    $('#jefeReporta').value = nombreDe(e.jefe);
  }

  function camposPorTipo(t) {
    if (t === 'A') return '<div class="frow">' +
      selc('contrato', 'Tipo de contrato', ['Nueva creación', 'Contrato eventual']) +
      fld('tiempoRequerido', 'Tiempo requerido (contrato eventual)') +
      fld('puestoNombre', 'Nombre del puesto') +
      selc('fuente', 'Fuente de reclutamiento', ['Promoción interna', 'Externo']) + '</div>';
    if (t === 'B') return '<div class="frow">' +
      fld('deptoActual', 'Departamento actual') + fld('ccActual', 'Centro de costo actual') +
      fld('deptoNuevo', 'Departamento nuevo') + fld('ccNuevo', 'Centro de costo nuevo') + '</div>';
    if (t === 'C') return '<div class="frow">' +
      fld('puestoActual', 'Puesto actual') + fld('deptoActual', 'Departamento actual') +
      fld('puestoNuevo', 'Puesto nuevo') + fld('deptoNuevo', 'Departamento nuevo') + '</div>';
    if (t === 'D') return '<div class="priv">💼 <div>El detalle de sueldos es información confidencial. El portal sólo captura el <b>motivo</b>; los importes deben vivir en el sistema de nómina, no en el portal.</div></div>' +
      '<div class="frow">' + selc('motivoSueldo', 'Motivo', ['Promoción', 'Méritos', 'Ajuste']) +
      fld('efectivo', 'Fecha efectiva', 'date') + '</div>';
    return '<div class="frow">' +
      selc('motivoBaja', 'Motivo de baja', ['Terminación de contrato 90D', '4 faltas injustificadas en el mes', 'Renuncia voluntaria', 'Rescisión laboral']) +
      fld('ultimoDia', 'Último día laborado', 'date') + '</div>' +
      '<div class="field"><label for="detalleBaja">Detalle del motivo</label><textarea id="detalleBaja" maxlength="300"></textarea></div>';
  }

  async function guardar(estado) {
    const emp = empDe($('#emp').value);
    if (!emp.id) return toast('Selecciona al colaborador.', 'wa');
    const tipo = $('#tipo').value;
    const t = CAT.tiposMovimiento.find(x => x.c === tipo);
    const detalle = {};
    $$('#dyn [id]').forEach(el => { if (el.value) detalle[el.id] = el.value; });

    try {
      const m = await API.rrhh.crearMovimiento({
        tipo, tipoNombre: t.n, aplicacion: $('#aplicacion').value || hoyISO(), capturadoPor: sesion.id,
        empleado: emp.id, empleadoNombre: emp.nombre, noEmpleado: emp.id, puesto: emp.puesto,
        direccion: $('#direccion').value, depto: emp.depto, division: $('#division').value,
        jefeReporta: $('#jefeReporta').value, tipoPersonal: $('#tipoPersonal').value,
        detalle, comentarios: $('#comentarios').value, estado
      });
      toast(estado === 'borrador' ? 'Borrador guardado.' : 'Movimiento enviado a firma.', 'ok');
      await recargar(); verMovimiento(m.id);
    } catch (e) { toast(e.message, 'no'); }
  }

  /* ==================== EXPEDIENTES ==================== */
  let qe = '', empSel = null;
  function expedientes() {
    if (empSel) return verExpediente(empSel);
    const lista = D.emps.filter(e => !qe || (e.nombre + ' ' + e.id + ' ' + e.depto).toLowerCase().indexOf(qe.toLowerCase()) >= 0);
    main.innerHTML =
      cab('Expedientes documentales', D.emps.length + ' colaboradores') +
      '<div class="priv">🔐 <div>Este expediente contiene <b>documentación laboral</b>. Los datos clínicos viven en el módulo de servicio médico y no son visibles desde aquí, ni siquiera para Recursos Humanos.</div></div>' +
      '<div class="filters"><div class="field" style="min-width:280px"><label>Buscar</label>' +
        '<input id="q" value="' + esc(qe) + '" placeholder="Nombre, número o departamento"></div></div>' +
      tabla([
        { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Departamento', k: 'depto' },
        { t: 'Puesto', k: 'puesto' }, { t: 'Ingreso', v: e => fmt(e.ingreso) },
        { t: 'Movimientos', v: e => D.movs.filter(m => m.empleado === e.id).length },
        { t: '', html: e => '<button class="btn sm" data-ex="' + esc(e.id) + '">Abrir expediente</button>' }
      ], lista, { vacio: 'Sin coincidencias.' });
    ZX.pie(main, 'Conservación documental conforme a la LFT art. 804: los documentos laborales deben resguardarse durante el último año de la relación de trabajo más un año posterior.');

    const qi = $('#q');
    qi.addEventListener('input', () => { qe = qi.value; const p = qi.selectionStart; expedientes(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $$('[data-ex]').forEach(b => b.addEventListener('click', () => { empSel = b.dataset.ex; expedientes(); }));
  }

  async function verExpediente(id) {
    const e = empDe(id);
    const ex = await API.rrhh.expediente(id);
    const movs = D.movs.filter(m => m.empleado === id);
    const porVencer = ex.docs.filter(d => d.vence && d.vence <= ZX.sumaDias(hoyISO(), 90));

    main.innerHTML =
      cab('Expediente de ' + e.nombre, e.id + ' · ' + e.puesto + ' · ' + e.depto,
        '<button class="btn" id="add">＋ Registrar documento</button><button class="btn gh" id="back">← Volver</button>') +
      '<div class="grid g4">' +
        k('Documentos', ex.docs.length, 'En el expediente') +
        k('Movimientos RHF-34', movs.length, 'Histórico del colaborador') +
        k('Por vencer', porVencer.length, 'En los próximos 90 días', porVencer.length ? 'dn' : 'gn') +
        k('Antigüedad', ZX.antiguedad(e.ingreso) + ' años', 'Desde ' + fmt(e.ingreso)) +
      '</div>' +
      ZX.notaConservacion() +
      '<h2 class="sec-t">Documentos</h2>' +
      tabla([
        { t: 'Tipo', k: 'tipo' }, { t: 'Archivo', k: 'nombre' }, { t: 'Tamaño', k: 'tam' },
        { t: 'Fecha', v: d => fmt(d.fecha) },
        { t: 'Vigencia', html: d => !d.vence ? '<span class="chip nt">Sin vencimiento</span>'
            : (d.vence <= hoyISO() ? '<span class="chip no">Vencido ' + esc(fmt(d.vence)) + '</span>'
            : d.vence <= ZX.sumaDias(hoyISO(), 90) ? '<span class="chip wa">Vence ' + esc(fmt(d.vence)) + '</span>'
            : '<span class="chip ok">Vigente a ' + esc(fmt(d.vence)) + '</span>') }
      ], ex.docs, { vacio: 'Expediente sin documentos registrados.' }) +
      '<h2 class="sec-t">Movimientos de personal</h2>' +
      tabla([
        { t: 'Folio', k: 'folio' }, { t: 'Tipo', v: m => m.tipo + ') ' + m.tipoNombre },
        { t: 'Aplicación', v: m => fmt(m.aplicacion) },
        { t: 'Estado', html: m => chip(m.estado) },
        { t: '', html: m => '<button class="btn sm" data-ver="' + esc(m.id) + '">Abrir</button>' }
      ], movs, { vacio: 'Sin movimientos registrados.' });

    ZX.pie(main, 'La vigencia se calcula contra la fecha de hoy; se marcan en ámbar los documentos que vencen dentro de 90 días.');
    $('#back').addEventListener('click', () => { empSel = null; expedientes(); });
    $('#add').addEventListener('click', () => popupDoc(id));
    bindVer();
  }

  function popupDoc(empId) {
    modal({
      titulo: 'Registrar documento en el expediente',
      cuerpo:
        '<div class="priv">📎 <div>Por ahora sólo se registra el metadato del documento. La carga del archivo aún no está conectada.</div></div>' +
        '<div class="frow">' +
          '<div class="field"><label for="tipo">Tipo</label><select id="tipo">' + CAT.tiposDoc.map(t => '<option>' + esc(t) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label for="nom">Nombre del archivo</label><input id="nom" maxlength="80"></div>' +
          '<div class="field"><label for="vence">Vigencia (opcional)</label><input id="vence" type="date"></div>' +
        '</div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Registrar', accion: async (b) => {
            const nom = $('#nom', b).value.trim();
            if (!nom) return toast('Escribe el nombre del archivo.', 'wa');
            try {
              await API.rrhh.registrarDoc(empId, { tipo: $('#tipo', b).value, nombre: nom, tam: '—', vence: $('#vence', b).value });
              cerrarModal(); toast('Documento registrado.', 'ok'); verExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ========================= helpers ========================= */
  function etapaActual(m) {
    const f = m.firmas.find(x => x.estado === 'pendiente');
    return m.estado === 'borrador' ? 'Sin enviar' : (f ? f.rol : 'Completado');
  }
  function etiquetaDetalle(kk) {
    const map = {
      contrato: 'Tipo de contrato', tiempoRequerido: 'Tiempo requerido', puestoNombre: 'Nombre del puesto',
      fuente: 'Fuente de reclutamiento', deptoActual: 'Departamento actual', ccActual: 'Centro de costo actual',
      deptoNuevo: 'Departamento nuevo', ccNuevo: 'Centro de costo nuevo', puestoActual: 'Puesto actual',
      puestoNuevo: 'Puesto nuevo', motivoSueldo: 'Motivo', efectivo: 'Fecha efectiva',
      motivoBaja: 'Motivo de baja', ultimoDia: 'Último día laborado', detalleBaja: 'Detalle'
    };
    return map[kk] || kk;
  }
  function irA(v) {
    vista = v;
    $$('.sb-item[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === v));
    render();
  }
  function bindVer() { $$('[data-ver]').forEach(b => b.addEventListener('click', () => verMovimiento(b.dataset.ver))); }
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
  function fld(id, l, tipo) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<input id="' + esc(id) + '" type="' + (tipo || 'text') + '" maxlength="120"></div>';
  }
  function selc(id, l, opciones) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><select id="' + esc(id) + '">' +
      opciones.map(o => '<option>' + esc(o) + '</option>').join('') + '</select></div>';
  }
  function selEmp() {
    return '<div class="field"><label for="emp">Colaborador</label><select id="emp">' +
      D.emps.map(e => '<option value="' + esc(e.id) + '">' + esc(e.id + ' — ' + e.nombre) + '</option>').join('') + '</select></div>';
  }
  function opts(pares, sel) {
    return pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(sel) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('');
  }
})();

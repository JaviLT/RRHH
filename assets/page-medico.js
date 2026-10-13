/* ============================================================
   Portal RRHH — Módulo Servicio Médico (expediente ocupacional)
   ------------------------------------------------------------
   Secciones 1, 2 y 3 → las llena el COLABORADOR.
   Secciones 4 a 9    → exclusivas del SERVICIO MÉDICO.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, chip, fmt, fmtDT, fmtLargo, hoyISO, parse, edad, imc, tabla, modal, cerrarModal, confirmar, calendario, descargarCSV, sumaDias } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;

  /* Mismo código para dos módulos: «Doctor» (Pacientes y Agenda del médico) y «Servicio médico»
     (lo personal de cada empleado y, mientras se mueven, las demás vistas del médico). */
  const MODO_DOCTOR = window.ZX_MODO === 'doctor';
  const sesion = ZX.requiereSesion(MODO_DOCTOR ? 'doctor' : 'medico');
  if (!sesion) return;
  const soyMedico = ZX.esClinico(sesion);
  const NOTA_IND = ZX.puede(sesion, 'indicadores') ? ' Los totales de esta sección están ahora en Indicadores → Servicio médico.' : '';

  const vistas = MODO_DOCTOR
    ? [{ id: 'pendientes', nombre: 'Pendientes',           ico: '✅' },
       { id: 'pacientes',  nombre: 'Pacientes',            ico: '👥' },
       { id: 'agenda',     nombre: 'Agenda del médico',    ico: '🗓️' }]
    : soyMedico
    ? [{ id: 'programa',   nombre: 'Programa de exámenes', ico: '🗓️' },
       { id: 'riesgos',    nombre: 'Riesgos de trabajo',   ico: '⚠️' },
       { id: 'ausentismo', nombre: 'Ausentismo',           ico: '📉' },
       { id: 'vigilancias',nombre: 'Atención y Control de Salud', ico: '🔬' },
       { id: 'campanas',   nombre: 'Campañas y vacunación',ico: '💉' },
       { id: 'altas',      nombre: 'Alta y baja de expedientes', ico: '🗃️' },
       { id: 'ficha',      nombre: 'Mi historia clínica',  ico: '📝' },
       { id: 'citas',      nombre: 'Mis citas',            ico: '📅' }]
    : [{ id: 'ficha',      nombre: 'Mi historia clínica',  ico: '📝' },
       { id: 'expediente', nombre: 'Mi expediente',        ico: '📁' },
       { id: 'citas',      nombre: 'Mis citas',            ico: '📅' }];

  const shell = MODO_DOCTOR ? ZX.montarShell('doctor', 'Doctor', vistas)
                            : ZX.montarShell('medico', 'Servicio médico · expediente ocupacional', vistas);
  const main = shell.main;

  let D = { emps: [], citas: [], agenda: null, consultas: [], mio: null, evaluaciones: [], riesgos: [], incapacidades: [], docs: [], vigilancia: [] };
  const empDe = id => D.emps.find(e => e.id === id) || {};
  const nombreDe = id => empDe(id).nombre || id || '—';

  async function recargar() {
    const [emps, consultas, mio, evaluaciones, riesgos, incapacidades, docs, programa, vacunas, campanas, expedientes, consentimiento, citas, agenda] = await Promise.all([
      API.empleados.lista(), API.medico.consultas(), API.medico.cuestionario(sesion.id),
      API.medico.evaluaciones(), API.medico.riesgos(), API.medico.incapacidades(), [],
      API.medico.programa(), API.medico.vacunas(), API.medico.campanas(), API.medico.expedientes(),
      API.privacidad.consentimiento(sesion.id), API.citas.lista(), API.citas.agenda()
    ]);
    const [resAnalisis, casosAnalisis, historias, exigeConsentimiento] = await Promise.all([API.analisis.resultados(), API.analisis.casos(), API.medico.historiasResumen(), API.privacidad.consentimientoObligatorio()]);
    D = { emps, consultas, mio, evaluaciones, riesgos, incapacidades, docs, programa, vacunas, campanas, expedientes,
          resAnalisis, casosAnalisis, historias, exigeConsentimiento, consentimiento, citas, agenda };
  }

  let vista = vistas[0].id;
  const nav = ZX.bindVistas(v => { vista = v; pacienteSel = null; render(); });
  /* Enlace directo de la barra superior: medico.html#cita abre el formulario de agendar */
  const atenderHash = ZX.alHash(h => { if (h === 'cita') ZX.formularios.cita(); });
  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); atenderHash(); });
  document.addEventListener('zx:datos', async () => { try { await recargar(); render(); } catch (e) { toast(e.message, 'no'); } });   // un formulario de la barra superior terminó
  async function refrescar() { await recargar(); render(); }
  function render() {
    if (!D.agenda) return;                   // todavía cargando: arranque() pinta al terminar
    ({ ficha, expediente, pacientes, riesgos: riesgosGlobal, ausentismo, vigilancias,
       programa: programaGlobal, campanas: campanasGlobal, altas: altasGlobal, citas: misCitas, agenda: agendaMedico, pendientes }[vista] || ficha)();
  }

  const AVISO =
    '<div class="priv">🔒 <div><b>Aviso de privacidad.</b> La información de salud es un dato personal sensible (LFPDPPP art. 3, fr. VI). ' +
    'Sólo tú y el personal del servicio médico pueden verla; tu jefe y Recursos Humanos <b>no</b> tienen acceso a estos campos. ' +
    'Se usa exclusivamente para tu vigilancia de salud ocupacional (NOM-030-STPS).</div></div>';

  /* ===========================================================
     SECCIONES 1–3 · Cuestionario del colaborador
     =========================================================== */
  let puestosTmp = null;

  /* Formulario de la historia clínica: lo usa la propia persona (conBoton) y el médico dentro de una ventana. */
  function htmlFormHistoria(yo, c, mostrarGO, conBoton) {
    const g = c.goa || {};
    return '<form id="f">' +

      /* ---- 1. Identificación ---- */
      '<div class="card"><div class="card-t">Datos de identificación</div>' +
        '<div class="frow">' +
          ro('Número de empleado', yo.id) + ro('Nombre completo', yo.nombre) +
          ro('Puesto', yo.puesto) + ro('Dirección', yo.direccion) + ro('Departamento', yo.departamento) +
          ro('Fecha de ingreso a ZX', fmt(yo.ingreso)) + ro('Antigüedad', ZX.antiguedad(yo.ingreso) + ' años') +
        '</div>' +
        '<div class="frow">' +
          txt('curp', 'CURP', c.curp, 'text', 18) +
          txt('nacimiento', 'Fecha de nacimiento', c.nacimiento || yo.nacimiento, 'date') +
          ro('Edad', (c.nacimiento || yo.nacimiento) ? edad(c.nacimiento || yo.nacimiento) + ' años' : '—', 'edadVal') +
          sel('sexo', 'Sexo', [''].concat(CAT.sexos), c.sexo) +
          sel('jornada', 'Tipo de jornada', [''].concat(CAT.jornadas), c.jornada) +
        '</div>' +
        '<div class="frow">' +
          txt('contactoEmergencia', 'Contacto en caso de emergencia', c.contactoEmergencia) +
          txt('telefonoEmergencia', 'Teléfono de emergencia', c.telefonoEmergencia) +
        '</div>' +
      '</div>' +

      /* ---- 2. Información médica básica ---- */
      '<div class="card"><div class="card-t">Información médica básica</div>' +
        '<div class="frow">' +
          sel('tipoSanguineo', 'Tipo sanguíneo', [''].concat(CAT.tiposSanguineos), c.tipoSanguineo) +
          txt('alergias', 'Alergias (medicamentos, alimentos, otros)', c.alergias, 'text', 200) +
        '</div>' +
        area('antecedentesMedicos', 'Antecedentes médicos relevantes', c.antecedentesMedicos, 'Enfermedades previas, hospitalizaciones, fracturas…') +
        area('antecedentesQuirurgicos', 'Antecedentes quirúrgicos', c.antecedentesQuirurgicos, 'Cirugías y año en que se realizaron. Escribe "Ninguno" si no aplica.') +
        area('medicamentosHabituales', 'Medicamentos de uso habitual', c.medicamentosHabituales, 'Nombre, dosis y motivo. Escribe "Ninguno" si no aplica.') +
        multi('cronicas', 'Enfermedades crónicas relevantes', CAT.cronicas, c.cronicas) +
        multi('heredofamiliares', 'Antecedentes heredofamiliares (familia directa)', CAT.cronicas, c.heredofamiliares) +
        multi('consumo', '¿Consume alguno de los siguientes productos?', CAT.consumo, c.consumo) +
      '</div>' +

      /* ---- 3. Historia clínica ocupacional ---- */
      '<div class="card"><div class="card-t">Historia clínica ocupacional</div>' +
        '<label style="display:block;font-size:11.5px;font-weight:600;color:var(--tx2);margin-bottom:6px">Puestos desempeñados (anteriores y actual)</label>' +
        '<div id="puestos"></div>' +
        '<button type="button" class="btn gh sm" id="addPuesto" style="margin:4px 0 16px">＋ Agregar puesto</button>' +
        multi('riesgosExposicion', 'Factores de riesgo / exposición en tu puesto', CAT.riesgosExposicion, c.riesgosExposicion) +
        multi('epp', 'Equipo de protección personal que utilizas', CAT.epp, c.epp) +
        area('accidentes', 'Antecedentes de accidentes o enfermedades de trabajo', c.accidentes, 'En Zubex o en empleos anteriores. Escribe "No" si no aplica.') +
        '<div class="frow">' +
          txt('frecuenciaServicio', 'Veces que usaste el servicio médico en los últimos 4 meses', c.frecuenciaServicio, 'number') +
          sel('estadoSaludPercibido', '¿Cómo consideras tu estado de salud?', [''].concat(CAT.percepcionSalud), c.estadoSaludPercibido) +
        '</div>' +
      '</div>' +

      (mostrarGO
        ? '<div class="card"><div class="card-t">Antecedentes gineco-obstétricos <span class="chip nt">Opcional</span></div>' +
          '<p style="font-size:11.5px;color:var(--tx2);margin-bottom:12px">Puedes dejarlo en blanco y comentarlo directamente en consulta.</p>' +
          '<div class="frow">' +
            txt('go_menarca', 'Menarca (edad)', g.menarca) + txt('go_ritmo', 'Ritmo', g.ritmo) +
            txt('go_fum', 'Fecha de última regla', g.fum, 'date') + txt('go_gestas', 'Gestas', g.gestas) +
            txt('go_paras', 'Paras', g.paras) + txt('go_abortos', 'Abortos', g.abortos) +
            txt('go_cesareas', 'Cesáreas', g.cesareas) + txt('go_ivsa', 'Inicio de vida sexual activa', g.ivsa) +
            txt('go_anticonceptivo', 'Método anticonceptivo', g.anticonceptivo) +
          '</div></div>'
        : '') +

      (conBoton ? '<div class="btn-row"><button class="btn" type="submit">Guardar historia clínica</button></div>' : '') +
      '</form>';
  }

  function ficha() {
    /* Candado de consentimiento (nuevo, igual que en Medico ZX): sin
       consentimiento vigente no se muestra el formulario, se manda al
       aviso de privacidad. api.js repite esta validación al guardar,
       por si alguien llega al formulario de otra forma. */
    if (D.exigeConsentimiento && !D.consentimiento) {
      main.innerHTML =
        cab('Mi historia clínica', '') +
        '<div class="priv">🔒 <div><b>Necesitas otorgar tu consentimiento antes de continuar.</b> ' +
        'La captura de tu historia clínica requiere tu consentimiento expreso para el tratamiento de datos ' +
        'personales de salud (LFPDPPP art. 8). Ve a <a href="privacidad.html">Aviso de privacidad</a> para ' +
        'leerlo y otorgarlo; podrás volver aquí en cuanto lo hagas.</div></div>';
      return;
    }
    const yo = empDe(sesion.id);
    const c = D.mio || {};
    if (!puestosTmp) puestosTmp = (c.puestos && c.puestos.length ? JSON.parse(JSON.stringify(c.puestos)) : [filaPuestoVacia()]);
    const mostrarGO = (c.sexo || (yo.genero === 'F' ? 'Mujer' : 'Hombre')) === 'Mujer';

    main.innerHTML =
      cab('Mi historia clínica', c.actualizado ? 'Última actualización: ' + fmt(c.actualizado) : 'Aún no has llenado el cuestionario') +
      AVISO +
      htmlFormHistoria(yo, c, mostrarGO, true);

    ZX.pie(main, 'Las secciones 1 a 3 las declara el colaborador. Las evaluaciones, dictámenes, riesgos de trabajo, incapacidades y vigilancia los captura únicamente el servicio médico.');

    ligarFormHistoria(true);
  }

  function ligarFormHistoria(conSubmit) {
    pintaPuestos();
    $('#addPuesto').addEventListener('click', () => { leePuestos(); puestosTmp.push(filaPuestoVacia()); pintaPuestos(); });
    if (conSubmit) $('#f').addEventListener('submit', guardarFicha);
    const nac = $('#nacimiento');                                       // la edad se calcula al elegir la fecha de nacimiento
    if (nac) nac.addEventListener('input', () => { $('#edadVal').textContent = nac.value ? edad(nac.value) + ' años' : '—'; });
    ['cronicas', 'heredofamiliares', 'consumo', 'riesgosExposicion', 'epp'].forEach(ligarNinguna);
  }

  /* Si se marca "Ninguna/Ninguno", las demás opciones del grupo se desmarcan y se bloquean. */
  function ligarNinguna(grupo) {
    const cajas = $$('[data-g="' + grupo + '"]');
    const ning = cajas.find(c => /^ningun[oa]$/i.test(c.value));
    if (!ning) return;
    const aplicar = () => cajas.forEach(c => { if (c !== ning) { if (ning.checked) c.checked = false; c.disabled = ning.checked; } });
    ning.addEventListener('change', aplicar);
    aplicar();
  }

  /* Antigüedad en un puesto, calculada con las fechas Desde y Hasta (sin Hasta = puesto actual, hasta hoy). */
  function antigPuesto(desde, hasta) {
    if (!desde) return '—';
    const d = ZX.parse(desde), h = hasta ? ZX.parse(hasta) : new Date();
    if (isNaN(d) || isNaN(h)) return '—';
    if (h < d) return 'Revisa las fechas';
    let m = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
    if (h.getDate() < d.getDate()) m--;
    if (m < 1) return 'Menos de 1 mes';
    const a = Math.floor(m / 12), r = m % 12;
    return [a ? a + (a === 1 ? ' año' : ' años') : '', r ? r + (r === 1 ? ' mes' : ' meses') : ''].filter(Boolean).join(' ');
  }

  function filaPuestoVacia() { return { puesto: '', empresa: 'Zubex', desde: '', hasta: '', antiguedad: '' }; }

  function pintaPuestos() {
    $('#puestos').innerHTML = puestosTmp.map((p, i) =>
      '<div class="frow" data-p="' + i + '" style="align-items:end;border:1px solid var(--bd);border-radius:10px;padding:11px;margin-bottom:8px;background:var(--c1)">' +
        txt('p_puesto_' + i, 'Puesto', p.puesto) +
        sel('p_empresa_' + i, 'Empresa', ['Zubex', 'Otra empresa'], p.empresa) +
        txt('p_desde_' + i, 'Desde', p.desde, 'date') +
        txt('p_hasta_' + i, 'Hasta (vacío = actual)', p.hasta, 'date') +
        '<div class="field"><label>Antigüedad en el puesto</label><div id="p_antig_' + i + '" style="font-size:13px;font-weight:600;padding:9px 0">' + esc(antigPuesto(p.desde, p.hasta)) + '</div></div>' +
        '<div class="field"><label>&nbsp;</label><button type="button" class="btn gh sm" data-del="' + i + '">Quitar</button></div>' +
      '</div>').join('');
    puestosTmp.forEach((p, i) => ['p_desde_' + i, 'p_hasta_' + i].forEach(id => {
      const el = $('#' + id);
      if (el) el.addEventListener('input', () => { $('#p_antig_' + i).textContent = antigPuesto(val('p_desde_' + i), val('p_hasta_' + i)); });
    }));
    $$('#puestos [data-del]').forEach(b => b.addEventListener('click', () => {
      leePuestos();
      puestosTmp.splice(+b.dataset.del, 1);
      if (!puestosTmp.length) puestosTmp.push(filaPuestoVacia());
      pintaPuestos();
    }));
  }

  function leePuestos() {
    puestosTmp = puestosTmp.map((p, i) => ({
      puesto: val('p_puesto_' + i), empresa: val('p_empresa_' + i),
      desde: val('p_desde_' + i), hasta: val('p_hasta_' + i), antiguedad: antigPuesto(val('p_desde_' + i), val('p_hasta_' + i))
    }));
  }

  function leerFormHistoria() {
    leePuestos();
    const mostrarGO = val('sexo') === 'Mujer';
    const datos = {
      curp: val('curp').toUpperCase(), nacimiento: val('nacimiento') || null, sexo: val('sexo'),
      jornada: val('jornada'),
      contactoEmergencia: val('contactoEmergencia'), telefonoEmergencia: val('telefonoEmergencia'),
      tipoSanguineo: val('tipoSanguineo'), alergias: val('alergias'),
      antecedentesMedicos: val('antecedentesMedicos'), antecedentesQuirurgicos: val('antecedentesQuirurgicos'),
      medicamentosHabituales: val('medicamentosHabituales'),
      cronicas: chks('cronicas'), heredofamiliares: chks('heredofamiliares'), consumo: chks('consumo'),
      puestos: puestosTmp.filter(p => p.puesto),
      riesgosExposicion: chks('riesgosExposicion'), epp: chks('epp'),
      accidentes: val('accidentes'),
      frecuenciaServicio: val('frecuenciaServicio'), estadoSaludPercibido: val('estadoSaludPercibido'),
      goa: mostrarGO ? {
        menarca: val('go_menarca'), ritmo: val('go_ritmo'), fum: val('go_fum'), gestas: val('go_gestas'),
        paras: val('go_paras'), abortos: val('go_abortos'), cesareas: val('go_cesareas'),
        ivsa: val('go_ivsa'), anticonceptivo: val('go_anticonceptivo')
      } : null
    };
    if (datos.curp && !/^[A-Z0-9]{18}$/.test(datos.curp)) { toast('La CURP debe tener 18 caracteres.', 'wa'); return null; }
    return datos;
  }

  async function guardarFicha(e) {
    e.preventDefault();
    const datos = leerFormHistoria(); if (!datos) return;
    try {
      await API.medico.guardarCuestionario(sesion.id, datos);
      toast('Historia clínica guardada.', 'ok');
      puestosTmp = null;
      await refrescar();
    } catch (ex) { toast(ex.message, 'no'); }
  }

  /* El médico modifica la historia de otra persona (por ejemplo, tras un cambio referido en consulta).
     La base exige el consentimiento vigente de la persona y deja el rastro en la bitácora. */
  async function editarHistoriaMedico(empId, encima) {
    const emp = empDe(empId);
    let consentimiento = true;
    try { if (D.exigeConsentimiento) consentimiento = await API.medico.tieneConsentimiento(empId); } catch (e) { /* de todos modos lo valida la base al guardar */ }
    if (!consentimiento) {
      modal({ encima: !!encima, titulo: 'Aún no se puede modificar',
        cuerpo: '<div class="priv">🔒 <div><b>' + esc(emp.nombre) + ' aún no ha otorgado su consentimiento vigente</b> para el tratamiento de sus datos de salud. ' +
          'Mientras no lo otorgue, el servicio médico no puede crear ni modificar su historia clínica. Pídele que entre al portal y lo otorgue en «Aviso de privacidad».</div></div>',
        botones: [{ txt: 'Entendido' }] });
      return;
    }
    let c; try { c = (await API.medico.cuestionario(empId)) || {}; } catch (e) { return toast(e.message, 'no'); }
    puestosTmp = (c.puestos && c.puestos.length) ? JSON.parse(JSON.stringify(c.puestos)) : [filaPuestoVacia()];
    const mostrarGO = (c.sexo || (emp.genero === 'F' ? 'Mujer' : 'Hombre')) === 'Mujer';
    const m = modal({
      encima: !!encima, ancho: 'lg', titulo: (c.actualizado ? 'Editar' : 'Crear') + ' historia clínica · ' + emp.nombre,
      alCerrar: () => { puestosTmp = null; },
      cuerpo: '<div class="priv">✏️ <div>Estás modificando la historia de <b>' + esc(emp.nombre) + '</b>. El cambio queda en la bitácora con tu nombre y el motivo que escribas.</div></div>' +
        htmlFormHistoria(emp, c, mostrarGO, false) +
        '<div class="field" style="margin-top:12px"><label for="motivoCambio">Motivo del cambio (obligatorio)</label>' +
        '<input id="motivoCambio" maxlength="160" placeholder="Ej. Cambio referido en la consulta del ' + esc(fmt(hoyISO())) + '"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar cambios', accion: async (b) => {
            const datos = leerFormHistoria(); if (!datos) return;
            const motivo = ($('#motivoCambio', b).value || '').trim();
            if (motivo.length < 5) return toast('Escribe el motivo del cambio (por ejemplo, «Cambio referido en consulta»).', 'wa');
            try {
              await API.medico.guardarCuestionarioMedico(empId, datos, motivo);
              cerrarModal(); toast('Historia clínica actualizada.', 'ok');
              if (encima) await recargar(); else { tabExp = 'ficha'; await volverExpediente(empId); }
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
    ligarFormHistoria(false);
    $('#f', m).addEventListener('submit', e => e.preventDefault());
  }

  /* ===========================================================
     EXPEDIENTE (propio o del paciente)
     =========================================================== */
  let pacienteSel = null, tabExp = 'ficha';

  function expediente() { verExpediente(sesion.id, false); }

  async function verExpediente(empId, esOtro) {
    pacienteSel = esOtro ? empId : null;
    const emp = empDe(empId);
    const [cue, vig] = await Promise.all([API.medico.cuestionario(empId), API.medico.vigilancia(empId)]);
    const cons = D.consultas.filter(c => c.empleado === empId).sort(desc('fecha'));
    const evals = D.evaluaciones.filter(x => x.empleado === empId).sort(desc('fecha'));
    const rts = D.riesgos.filter(x => x.empleado === empId).sort(desc('fecha'));
    const inc = D.incapacidades.filter(x => x.empleado === empId).sort(desc('inicio'));
    const docs = (await API.medico.documentos(empId)).sort(desc('nombre'));
    const vacs = D.vacunas.filter(x => x.empleado === empId).sort(desc('fecha'));
    const prog = D.programa.filter(x => x.empleado === empId).sort(desc('programada'));
    const exp = D.expedientes.find(x => x.empleado === empId) ||
      { empleado: empId, estado: 'sin_iniciar', alta: '', baja: '', motivoBaja: '', conservarHasta: '' };
    const log = esOtro ? await API.auditoria.lista({ afectado: empId }) : [];
    const analisis = D.resAnalisis.filter(x => x.empleado === empId).sort(desc('fechaResultado'));
    const casosAn = D.casosAnalisis.filter(x => x.empleado === empId).sort(desc('fechaDeteccion'));
    const ctx = { empId, emp, esOtro, cue: cue || {}, vig, cons, evals, rts, inc, docs, vacs, prog, exp, log,
                  analisis, casosAn };

    if (esOtro) API.auditoria.registrar('expediente.consultar', empId, empId, 'Apertura de expediente clínico');

    const tabs = [
      ['ficha', 'Ficha del colaborador'], ['eval', 'Evaluaciones'],
      ['cons', 'Consultas'], ['rt', 'Riesgos de trabajo'], ['inc', 'Incapacidades'],
      ['docs', 'Documentos'], ['vig', 'Atención y Control de Salud'], ['vac', 'Vacunación'],
      ['analisis', '🧪 Análisis clínicos']
    ];
    if (esOtro) tabs.push(['log', 'Historial de cambios']);

    main.innerHTML =
      cab(esOtro ? 'Expediente · ' + emp.nombre : 'Mi expediente',
          emp.id + ' · ' + emp.puesto + ' · ' + (emp.direccion || '') + ' · ' + (emp.departamento || '') + ' · turno ' + (emp.turno || '—') +
          ((ctx.cue.nacimiento || emp.nacimiento) ? ' · ' + edad(ctx.cue.nacimiento || emp.nacimiento) + ' años' : ''),
          (esOtro ? '<button class="btn" id="nueva">＋ Registrar consulta</button>' +
                    '<button class="btn gh" id="imprimir">🖨️ Imprimir</button>' +
                    '<button class="btn gh" id="volver">← ' + esc((vistas.find(v => v.id === vista) || { nombre: 'Volver' }).nombre) + '</button>' : '')) +
      '<div style="margin-bottom:14px">' + chipExpediente(exp) +
        (exp.estado === 'activo' && exp.alta ? '<span class="page-sub" style="margin-left:9px">Expediente activado el ' + esc(fmt(exp.alta)) + '</span>' : '') +
        (exp.estado === 'baja' ? '<span class="page-sub" style="margin-left:9px">Baja el ' + esc(fmt(exp.baja)) + ' · conservar hasta ' + esc(fmt(exp.conservarHasta)) + '</span>' : '') +
        (exp.estado === 'sin_iniciar' ? '<span class="page-sub" style="margin-left:9px">Recursos Humanos aún no activa este expediente</span>' : '') +
      '</div>' +
      AVISO +
      '<div class="tabs" style="margin-bottom:16px">' + tabs.map(t =>
        '<button class="tab' + (t[0] === tabExp ? ' on' : '') + '" data-tabx="' + t[0] + '">' + esc(t[1]) + '</button>').join('') + '</div>' +
      '<div id="tabc"></div>';

    $$('[data-tabx]').forEach(b => b.addEventListener('click', () => {
      tabExp = b.dataset.tabx;
      $$('[data-tabx]').forEach(x => x.classList.toggle('on', x.dataset.tabx === tabExp));
      pintaTab(ctx);
    }));
    if (esOtro) {
      $('#volver').addEventListener('click', () => { pacienteSel = null; render(); });
      $('#nueva').addEventListener('click', () => popupConsulta(empId));
      $('#imprimir').addEventListener('click', () => { API.auditoria.registrar('expediente.imprimir', empId, null, 'Impresión del expediente'); window.print(); });
    }
    pintaTab(ctx);
  }

  function pintaTab(ctx) {
    const c = $('#tabc');
    c.innerHTML = ({
      ficha: tabFicha, eval: tabEval, cons: tabCons,
      rt: tabRT, inc: tabInc, docs: tabDocs, vig: tabVig, vac: tabVac, log: tabLog, analisis: tabAnalisis
    }[tabExp] || tabFicha)(ctx);
    bindTab(ctx);
    bindDocs(c, ctx);
    ZX.pie(c, notaTab());
  }

  /* «Ver» abre el PDF en otra pestaña y «Descargar» lo baja. El enlace es temporal (10 min) y sólo lo entrega la base de datos
     a quien corresponde (el médico o la propia persona). La pestaña se abre ANTES de pedir el enlace para que el navegador no la bloquee. */
  function bindDocs(c, ctx) {
    const chkBaja = $('#verBaja', c);
    if (chkBaja) chkBaja.addEventListener('change', () => { verDocsBaja = chkBaja.checked; pintaTab(ctx); });
    $$('[data-repl]', c).forEach(b => b.addEventListener('click', () => popupSubirDocumento(ctx.empId, ctx.docs.find(d => d.id === b.dataset.repl))));
    $$('[data-elim]', c).forEach(b => b.addEventListener('click', () => popupEliminarDocumento(ctx.docs.find(d => d.id === b.dataset.elim), ctx.empId)));
    $$('[data-ver],[data-bajar]', c).forEach(b => b.addEventListener('click', async () => {
      const bajar = b.dataset.bajar !== undefined;
      const w = bajar ? null : window.open('', '_blank');
      try {
        if (ctx && ctx.esOtro) API.auditoria.registrar('documento.consultar', ctx.empId, null, (b.dataset.nom || '').slice(0, 120));
        const url = await API.medico.urlDocumento(bajar ? b.dataset.bajar : b.dataset.ver, bajar ? ((b.dataset.nom || 'documento').replace(/[^\p{L}\p{N} ._-]/gu, '').trim() || 'documento') + '.pdf' : undefined);
        if (bajar) { const a = document.createElement('a'); a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); }
        else if (w) w.location.href = url; else window.location.href = url;
      } catch (e) { if (w) w.close(); toast(e.message, 'no'); }
    }));
  }

  function notaTab() {
    return {
      ficha: 'Información declarada por el colaborador. El servicio médico puede complementarla en consulta, pero no la edita desde aquí.',
      eval: 'Evaluaciones y dictámenes de aptitud conforme a NOM-030-STPS. La vigencia se calcula contra la fecha de hoy.',
      cons: 'Consultas médicas del expediente: motivo, signos vitales, diagnóstico, tratamiento, evolución y referencias.',
      rt: 'Riesgos de trabajo con análisis de causa raíz en 8 disciplinas (8D) y seguimiento hasta la reincorporación.',
      inc: 'Incapacidades y ausentismo médico. Los días se cuentan como días naturales del periodo.',
      docs: 'Los PDF se guardan en un almacenamiento privado: sólo el servicio médico y la propia persona pueden abrirlos, con un enlace temporal. Registrar un documento nuevo desde esta pantalla todavía guarda sólo su nombre; la carga del archivo desde aquí aún no está conectada.',
      vig: 'Programa de vigilancia médica, recomendaciones y restricciones laborales vigentes, y casos en seguimiento.',
      vac: 'Esquema de vacunación y participación en campañas preventivas. La próxima dosis se calcula con el esquema del biológico aplicado.',
      log: 'Trazabilidad de las operaciones sobre este expediente. La escribe el servidor, no el navegador.',
      analisis: 'Resultados de los análisis clínicos periódicos (Etapa 1 · SQF) y seguimiento de las desviaciones detectadas.'
    }[tabExp];
  }

  function chipExpediente(exp) {
    const m = { activo: 'ok', baja: 'no', sin_iniciar: 'nt' };
    return '<span class="chip ' + (m[exp.estado] || 'nt') + '">Expediente: ' +
      esc(nombreCat(CAT.estadosExpediente, exp.estado)) + '</span>';
  }

  /* ---------- Tab 10: Vacunación ---------- */
  function tabVac(x) {
    const pendientes = x.vacs.filter(v => v.proximaDosis && v.proximaDosis <= hoyISO());
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="nuevaVac">＋ Registrar aplicación</button></div>' : '') +
      '<div class="grid g4" style="margin-bottom:14px">' +
        k('Aplicaciones', x.vacs.length, 'Registradas en el expediente') +
        k('Biológicos distintos', new Set(x.vacs.map(v => v.biologico)).size, 'Esquemas iniciados') +
        k('Dosis vencidas', pendientes.length, pendientes.length ? 'Requieren aplicación' : 'Esquema al corriente', pendientes.length ? 'dn' : 'gn') +
        k('Última aplicación', x.vacs[0] ? fmt(x.vacs[0].fecha) : '—', x.vacs[0] ? x.vacs[0].biologico : 'Sin registros') +
      '</div>' +
      tabla([
        { t: 'Biológico', k: 'biologico' }, { t: 'Dosis', k: 'dosis' },
        { t: 'Fecha', v: v => fmt(v.fecha) }, { t: 'Campaña', k: 'campana' },
        { t: 'Próxima dosis', html: v => !v.proximaDosis ? '<span class="chip nt">No aplica</span>'
            : v.proximaDosis <= hoyISO() ? '<span class="chip no">Vencida ' + esc(fmt(v.proximaDosis)) + '</span>'
            : '<span class="chip ok">' + esc(fmt(v.proximaDosis)) + '</span>' },
        { t: 'Aplicó', v: v => nombreDe(v.aplicadaPor) },
        { t: 'Observaciones', v: v => v.observaciones || '—' }
      ], x.vacs, { vacio: 'Sin aplicaciones registradas.' });
  }

  /* ---------- Tab: Análisis clínicos (Etapa 1) ----------
     El colaborador ve SUS PROPIOS resultados, como contempla la propuesta v3.
     Es su información: puede consultarla, no editarla. */
  function tabAnalisis(x) {
    const CATx = CAT;
    const desv = x.analisis.filter(r => r.valoracion === 'desviacion');
    const abiertos = x.casosAn.filter(c => c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere');
    const ultimo = x.analisis[0];
    const nombreEstatus = c => { const e = CATx.estatusCaso.find(v => v.c === c); return e ? e.n : c; };
    const chipEst = c => { const e = CATx.estatusCaso.find(v => v.c === c) || { chip: 'nt', n: c };
      return '<span class="chip ' + e.chip + '">' + esc(e.n) + '</span>'; };

    return (x.esOtro ? '' :
      '<div class="priv">🧪 <div><b>Tus resultados.</b> Aquí puedes consultar el resultado de tus análisis clínicos ' +
      'periódicos y el avance del seguimiento médico si se detectó alguna desviación. Si algo no te queda claro, ' +
      'agenda una cita con el servicio médico: esta pantalla no sustituye la valoración del médico.</div></div>') +
      '<div class="grid g4" style="margin-bottom:14px">' +
        k('Resultados registrados', x.analisis.length, 'En el histórico') +
        k('Última toma', ultimo ? fmt(ultimo.fechaToma) : '—', ultimo ? ultimo.analisis : 'Sin análisis registrados') +
        k('Desviaciones', desv.length, desv.length ? 'Con seguimiento médico' : 'Ningún resultado fuera de criterio',
          desv.length ? 'wn' : 'gn') +
        k('Casos abiertos', abiertos.length, abiertos.length ? 'En seguimiento' : 'Sin casos pendientes',
          abiertos.length ? 'wn' : 'gn') +
      '</div>' +
      tabla([
        { t: 'Análisis', k: 'analisis' },
        { t: 'Fecha de toma', v: r => fmt(r.fechaToma) },
        { t: 'Fecha de resultado', v: r => fmt(r.fechaResultado) },
        { t: 'Resultado', k: 'resultado' },
        { t: 'Parámetro / criterio', k: 'parametro' },
        { t: 'Valoración', html: r => '<span class="chip ' +
            (r.valoracion === 'desviacion' ? 'no' : r.valoracion === 'normal' ? 'ok' : 'wa') + '">' +
            esc(nombreCat(CATx.valoracionResultado, r.valoracion)) + '</span>' }
      ], x.analisis, { vacio: 'Aún no hay resultados de análisis clínicos en tu expediente.' }) +
      (x.casosAn.length
        ? '<h2 class="sec-t">Seguimiento de desviaciones</h2>' +
          x.casosAn.map(c =>
            '<div class="card"><div class="card-t"><span>Caso ' + esc(c.id) + ' · detectado el ' + esc(fmt(c.fechaDeteccion)) + '</span>' +
              chipEst(c.estatus) + '</div>' +
            '<div class="frow">' +
              ro('Motivo', c.motivo) +
              ro('Fecha de cita', c.fechaCita ? fmt(c.fechaCita) : 'Por programar') +
              ro('Indicaciones', c.indicaciones) +
              ro('Estudios posteriores', c.estudiosPosteriores) +
              ro('Próxima valoración', c.proximaValoracion ? fmt(c.proximaValoracion) : '—') +
              ro('Alta / cierre', c.fechaCierre ? fmt(c.fechaCierre) : 'Caso abierto') +
            '</div>' +
            (c.restriccion ? '<div class="field"><label>Restricción laboral vigente</label>' +
              '<div style="font-size:13px;font-weight:600;color:var(--wnt)">' + esc(c.restriccion) + '</div></div>' : '') +
            '</div>').join('')
        : '');
  }

  /* ---------- Tab: Historial de cambios ---------- */
  function tabLog(x) {
    return '<div class="priv">🧾 <div>La bitácora registra <b>quién</b> hizo <b>qué</b> y <b>cuándo</b> sobre este expediente. ' +
      'La escribe el servidor y no puede modificarse desde el portal. Cubre los cambios a la historia clínica, consultas, evaluaciones, riesgos, incapacidades, vacunas, documentos y seguimientos ' +
      '(sólo se guardan los <b>nombres de los campos</b> tocados, nunca su contenido clínico), además de las aperturas del expediente y de sus documentos, el acceso, el consentimiento y las solicitudes ARCO.</div></div>' +
      tabla([
        { t: 'Fecha y hora', v: l => fmtDT(l.fecha) }, { t: 'Usuario', v: l => nombreDe(l.usuario) },
        { t: 'Acción', v: l => ZX.etiquetaAccion(l.accion) }, { t: 'Registro', k: 'entidad' }, { t: 'Detalle', k: 'detalle' }
      ], x.log, { vacio: 'Sin movimientos registrados para este expediente.' });
  }

  /* ---------- Tab: Resumen ---------- */
  /* ---------- Tab: Ficha ---------- */
  function tabFicha(x) {
    const c = x.cue, e = x.emp;
    const quien = !c.actualizado ? '' : (c.actualizadoPor ? (String(c.actualizadoPor) === String(e.id) ? 'el propio colaborador' : 'Servicio médico') : 'carga inicial de registros');
    const cabecera = '<div class="btn-row" style="margin-bottom:12px;align-items:center">' +
      (c.actualizado ? '<span class="page-sub">Última actualización: <b>' + esc(fmt(c.actualizado)) + '</b> · ' + esc(quien) + '</span>' : '') +
      (x.esOtro ? '<button class="btn ac sm" data-act="editHistoria">' + (c.actualizado ? '✏️ Editar historia clínica' : '＋ Crear historia clínica') + '</button>' : '') + '</div>';
    if (!c.actualizado) return cabecera + '<div class="tbl-wrap"><div class="empty">El colaborador aún no ha llenado su historia clínica.</div></div>';
    return cabecera + '<div class="card"><div class="card-t">Datos de identificación</div><div class="frow">' +
        ro('Número de empleado', e.id) + ro('Nombre completo', e.nombre) + ro('Puesto', e.puesto) +
        ro('Dirección', e.direccion) + ro('Departamento', e.departamento) + ro('Fecha de ingreso', fmt(e.ingreso)) + ro('CURP', c.curp) +
        ro('Fecha de nacimiento', fmt(c.nacimiento || e.nacimiento)) + ro('Edad', (c.nacimiento || e.nacimiento) ? edad(c.nacimiento || e.nacimiento) + ' años' : '—') +
        ro('Sexo', c.sexo) + ro('Tipo de jornada', c.jornada) +
        ro('Contacto de emergencia', c.contactoEmergencia) + ro('Teléfono de emergencia', c.telefonoEmergencia) +
      '</div></div>' +
      '<div class="card"><div class="card-t">Información médica básica</div><div class="frow">' +
        ro('Tipo sanguíneo', c.tipoSanguineo) + ro('Alergias', c.alergias) +
        ro('Antecedentes médicos', c.antecedentesMedicos) + ro('Antecedentes quirúrgicos', c.antecedentesQuirurgicos) +
        ro('Medicamentos habituales', c.medicamentosHabituales) + ro('Enfermedades crónicas', (c.cronicas || []).join(', ')) +
        ro('Heredofamiliares', (c.heredofamiliares || []).join(', ')) + ro('Consumo', (c.consumo || []).join(', ')) +
      '</div></div>' +
      '<div class="card"><div class="card-t">Historia clínica ocupacional</div>' +
        tabla([
          { t: 'Puesto', k: 'puesto' }, { t: 'Empresa', k: 'empresa' },
          { t: 'Desde', v: p => fmt(p.desde) }, { t: 'Hasta', v: p => p.hasta ? fmt(p.hasta) : 'Actual' },
          { t: 'Antigüedad', v: p => antigPuesto(p.desde, p.hasta) }
        ], c.puestos || [], { vacio: 'Sin puestos capturados.' }) +
        '<div class="frow" style="margin-top:14px">' +
          ro('Factores de riesgo / exposición', (c.riesgosExposicion || []).join(', ')) +
          ro('Equipo de protección utilizado', (c.epp || []).join(', ')) +
          ro('Antecedentes de accidentes o enfermedades de trabajo', c.accidentes) +
          ro('Uso del servicio médico (últimos 4 meses)', c.frecuenciaServicio) +
          ro('Estado de salud percibido', c.estadoSaludPercibido) +
          ro('Última actualización', fmt(c.actualizado)) +
        '</div>' +
      '</div>' +
      (c.goa && Object.keys(c.goa).some(kk => c.goa[kk])
        ? '<div class="card"><div class="card-t">Antecedentes gineco-obstétricos</div><div class="frow">' +
          ro('Menarca', c.goa.menarca) + ro('Ritmo', c.goa.ritmo) + ro('FUM', c.goa.fum ? fmt(c.goa.fum) : '') +
          ro('Gestas', c.goa.gestas) + ro('Paras', c.goa.paras) + ro('Abortos', c.goa.abortos) +
          ro('Cesáreas', c.goa.cesareas) + ro('IVSA', c.goa.ivsa) + ro('Método anticonceptivo', c.goa.anticonceptivo) +
          '</div></div>' : '');
  }

  /* ---------- Tab 4: Evaluaciones ---------- */
  function tabEval(x) {
    const prog = x.prog || [];
    const realizadas = prog.filter(p => p.estado === 'realizada').length;
    const cumpl = prog.length ? Math.round(realizadas / prog.length * 100) : null;
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px">' +
        '<button class="btn" data-act="nuevaEval">＋ Nueva evaluación</button>' +
        '<button class="btn gh" data-act="programar">🗓️ Programar evaluación</button></div>' : '') +
      '<h3 style="margin-bottom:10px">Programa de evaluaciones</h3>' +
      '<div class="grid g4" style="margin-bottom:12px">' +
        k('Programadas', prog.length, 'En el programa de vigilancia') +
        k('Realizadas', realizadas, 'Con evaluación asociada') +
        k('Vencidas', prog.filter(p => p.estado === 'vencida').length, 'Fuera de fecha',
          prog.filter(p => p.estado === 'vencida').length ? 'dn' : 'gn') +
        k('Cumplimiento', cumpl == null ? '—' : cumpl + '%', 'Realizadas ÷ programadas',
          cumpl == null ? '' : (cumpl >= 90 ? 'gn' : cumpl >= 70 ? 'wn' : 'dn')) +
      '</div>' +
      tabla([
        { t: 'Tipo', v: p => nombreCat(CAT.tiposEvaluacion, p.tipo) },
        { t: 'Programa', k: 'programa' },
        { t: 'Fecha programada', v: p => fmt(p.programada) },
        { t: 'Estado', html: p => '<span class="chip ' + (p.estado === 'realizada' ? 'ok' : p.estado === 'vencida' ? 'no' : 'wa') + '">' + esc(p.estado) + '</span>' },
        { t: 'Evaluación', v: p => p.evaluacion || '—' }
      ], prog, { vacio: 'Sin evaluaciones programadas.' }) +
      '<h3 style="margin:20px 0 10px">Evaluaciones realizadas</h3>' +
      (x.evals.length ? x.evals.map(ev =>
        '<div class="card"><div class="card-t"><span>' + esc(nombreCat(CAT.tiposEvaluacion, ev.tipo)) + ' · ' + esc(fmtLargo(ev.fecha)) + '</span>' +
          chipDictamen(ev) + '</div>' +
        '<div class="frow">' + ro('Motivo', ev.motivo) + ro('Médico', nombreDe(ev.medico)) +
          ro('Vigencia del dictamen', ev.vigencia ? fmt(ev.vigencia) + (ev.vigencia < hoyISO() ? ' (vencido)' : '') : '—') +
        '</div>' +
        '<div class="field"><label>Hallazgos</label><div style="font-size:13px">' + esc(ev.hallazgos || '—') + '</div></div>' +
        (ev.restricciones ? '<div class="field"><label>Restricciones</label><div style="font-size:13px;color:var(--wnt)">' + esc(ev.restricciones) + '</div></div>' : '') +
        tabla([
          { t: 'Estudio', k: 'nombre' }, { t: 'Fecha', v: s => fmt(s.fecha) }, { t: 'Resultado', k: 'resultado' }
        ], ev.estudios || [], { vacio: 'Sin estudios de laboratorio o gabinete registrados.' }) +
        '</div>').join('')
      : '<div class="tbl-wrap"><div class="empty">Sin evaluaciones de salud registradas.</div></div>');
  }
  function chipDictamen(ev) {
    const m = { apto: 'ok', apto_con_restricciones: 'wa', no_apto: 'no', pendiente: 'nt' };
    return '<span class="chip ' + (m[ev.dictamen] || 'nt') + '">' + esc(nombreCat(CAT.dictamenes, ev.dictamen)) + '</span>';
  }

  /* ---------- Tab: Consultas ---------- */
  function tabCons(x) {
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="nuevaCons">＋ Registrar consulta</button></div>' : '') +
      (x.cons.length ? x.cons.map(tarjetaConsulta).join('')
        : '<div class="tbl-wrap"><div class="empty">Sin consultas registradas.</div></div>');
  }

  function tarjetaConsulta(c) {
    const s = c.somatometria || {};
    const ex = c.exploracion || {};
    const filas = CAT.exploracion.filter(kk => ex[kk]).map(kk =>
      '<tr><td style="width:180px;color:var(--tx2)">' + esc(CAT.exploracionLabel[kk]) + '</td><td>' + esc(ex[kk]) + '</td></tr>').join('');
    return '<div class="card">' +
      '<div class="card-t"><span>' + esc(fmtLargo(c.fecha)) + (c.hora ? ' · ' + esc(c.hora) : '') + '</span>' +
        '<span class="chip in">' + esc(c.id) + '</span></div>' +
      '<div class="frow" style="margin-bottom:12px">' +
        ro('Motivo de consulta', c.motivoCod
            ? nombreCat(CAT.motivosConsulta, c.motivoCod) + (c.motivo ? ' — ' + c.motivo : '')
            : c.motivo) +
        ro('Diagnóstico', c.diagnostico) +
        ro('Tratamiento / indicaciones', c.tratamiento) + ro('Evolución', c.evolucion) +
        ro('Referencia / interconsulta', c.referencia || 'No requiere') +
        ro('Estudios adicionales', c.estudios || 'Ninguno') +
        ro('Próxima cita', c.proximaCita ? fmt(c.proximaCita) : 'No programada') +
      '</div>' +
      '<label style="font-size:11.5px;font-weight:600;color:var(--tx2)">Signos vitales y somatometría</label>' +
      '<div class="grid g4" style="margin:8px 0 12px">' +
        mini('Estatura', s.estatura ? s.estatura + ' cm' : '—') + mini('Peso', s.peso ? s.peso + ' kg' : '—') +
        mini('T/A', s.ta || '—') + mini('F. cardiaca', s.fc ? s.fc + ' lpm' : '—') +
        mini('F. respiratoria', c.fr ? c.fr + ' rpm' : '—') + mini('Temperatura', c.temperatura ? c.temperatura + ' °C' : '—') +
        mini('SpO₂', c.spo2 ? c.spo2 + ' %' : '—') + mini('IMC', imc(s.peso, s.estatura) || '—') +
      '</div>' +
      (filas ? '<details><summary style="cursor:pointer;font-size:12.5px;font-weight:600;color:var(--zx-ac)">Ver exploración física</summary>' +
        '<div class="tbl-wrap" style="margin-top:10px"><table><tbody>' + filas + '</tbody></table></div></details>' : '') +
      '</div>';
  }

  /* ---------- Tab 6: Riesgos de trabajo ---------- */
  function tabRT(x) {
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="nuevoRT">＋ Registrar riesgo de trabajo</button></div>' : '') +
      (x.rts.length ? x.rts.map(fichaRiesgo).join('')
        : '<div class="tbl-wrap"><div class="empty">Sin accidentes, incidentes ni enfermedades de trabajo registrados.</div></div>');
  }

  function fichaRiesgo(r) {
    const esOtro = !!pacienteSel;
    const ocho = CAT.ochoD.map(d2 =>
      '<div class="flow-i ' + ((r.ochoD || {})[d2.c] ? 'done' : '') + '">' +
        '<div class="flow-dot">' + esc(d2.c.toUpperCase()) + '</div>' +
        '<div class="flow-tx"><b>' + esc(d2.n) + '</b><span>' + esc((r.ochoD || {})[d2.c] || 'Pendiente de documentar') + '</span></div></div>').join('');
    return '<div class="card">' +
      '<div class="card-t"><span>' + esc(nombreCat(CAT.tiposRiesgo, r.tipo)) + ' · ' + esc(fmtLargo(r.fecha)) + (r.hora ? ' ' + esc(r.hora) : '') + '</span>' +
        '<span>' + chipEstadoRT(r.estado) + ' <span class="chip in">' + esc(r.id) + '</span></span></div>' +
      '<div class="frow">' +
        ro('Área involucrada', r.area) + ro('Puesto involucrado', r.puesto) + ro('Mecanismo', r.mecanismo) +
        ro('Lesión', r.lesion) + ro('Días perdidos', r.diasPerdidos) + ro('Reportado al IMSS', r.reportadoIMSS ? 'Sí' : 'No') +
      '</div>' +
      '<div class="field"><label>Descripción del evento</label><div style="font-size:13px">' + esc(r.descripcion) + '</div></div>' +
      '<h3 style="margin:14px 0 10px">Análisis de causa raíz — 8 disciplinas</h3>' +
      '<div class="flow">' + ocho + '</div>' +
      '<h3 style="margin:14px 0 8px">Reincorporación laboral</h3>' +
      '<div class="frow">' + ro('Fecha de reincorporación', (r.reincorporacion || {}).fecha ? fmt(r.reincorporacion.fecha) : 'Pendiente') +
        ro('Condiciones', (r.reincorporacion || {}).condiciones) + '</div>' +
      '<h3 style="margin:14px 0 8px">Seguimiento</h3>' +
      tabla([{ t: 'Fecha', v: s => fmt(s.fecha) }, { t: 'Nota', k: 'nota' }], r.seguimiento || [], { vacio: 'Sin notas de seguimiento.' }) +
      (esOtro ? '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn gh sm" data-8d="' + esc(r.id) + '">Editar 8D</button>' +
        '<button class="btn gh sm" data-seg="' + esc(r.id) + '">＋ Nota de seguimiento</button>' +
        '<button class="btn gh sm" data-rein="' + esc(r.id) + '">Reincorporación / cierre</button></div>' : '') +
      '</div>';
  }
  function chipEstadoRT(e) {
    const m = { cerrado: ['ok', 'Cerrado'], en_seguimiento: ['wa', 'En seguimiento'], abierto: ['no', 'Abierto'] };
    const v = m[e] || ['nt', e];
    return '<span class="chip ' + v[0] + '">' + esc(v[1]) + '</span>';
  }

  /* ---------- Tab 7: Incapacidades ---------- */
  function tabInc(x) {
    const anio = String(new Date().getFullYear());
    const dias = x.inc.filter(v => v.inicio.slice(0, 4) === anio).reduce((a, v) => a + v.dias, 0);
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="nuevaInc">＋ Registrar incapacidad</button></div>' : '') +
      '<div class="grid g4" style="margin-bottom:14px">' +
        k('Incapacidades', x.inc.length, 'Histórico') +
        k('Días en ' + anio, dias, 'Días naturales', dias > 15 ? 'dn' : 'gn') +
        k('Por riesgo de trabajo', x.inc.filter(v => v.tipo === 'riesgo_trabajo').length, 'Del total histórico') +
        k('Vigentes', x.inc.filter(v => v.estado === 'vigente').length, 'A la fecha de hoy') +
      '</div>' +
      tabla([
        { t: 'Folio', k: 'folio' },
        { t: 'Tipo', v: v => nombreCat(CAT.tiposIncapacidad, v.tipo) },
        { t: 'Inicio', v: v => fmt(v.inicio) }, { t: 'Fin', v: v => fmt(v.fin) },
        { t: 'Días', k: 'dias' }, { t: 'Causa', k: 'causa' }, { t: 'Expedida por', k: 'expedidaPor' },
        { t: 'Estado', html: v => '<span class="chip ' + (v.estado === 'vigente' ? 'wa' : 'ok') + '">' + esc(v.estado === 'vigente' ? 'Vigente' : 'Concluida') + '</span>' },
        { t: 'Seguimiento', k: 'seguimiento' }
      ], x.inc, { vacio: 'Sin incapacidades registradas.' });
  }

  /* ---------- Tab 8: Documentos ---------- */
  let verDocsBaja = false;
  function tabDocs(x) {
    const vigentes = x.docs.filter(d => (d.estado || 'vigente') === 'vigente');
    const lista = (x.esOtro && verDocsBaja) ? x.docs : vigentes;
    const nBaja = x.docs.length - vigentes.length;
    const estadoChip = d => d.estado === 'reemplazado' ? ' <span class="chip nt">Reemplazado</span>' : d.estado === 'eliminado' ? ' <span class="chip no" title="' + esc(d.motivoBaja || '') + '">Eliminado</span>' : '';
    return ZX.notaConservacion() +
      (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="subirDoc">⬆ Subir documento</button></div>' : '') +
      (x.esOtro && nBaja ? '<label class="chk-linea"><input type="checkbox" id="verBaja"' + (verDocsBaja ? ' checked' : '') + '> Mostrar reemplazados y eliminados (' + nBaja + ')</label>' : '') +
      tabla([
        { t: 'Tipo', k: 'tipo' }, { t: 'Archivo', html: d2 => esc(d2.nombre) + estadoChip(d2) }, { t: 'Fecha', v: d2 => d2.fecha ? fmt(d2.fecha) : '—' },
        { t: 'Tamaño', k: 'tam' }, { t: 'Notas', v: d2 => d2.notas || '—' },
        { t: '', html: d2 => !d2.ruta ? '<span class="chip nt">Sin archivo</span>'
            : '<div class="btn-row"><button class="btn sm" data-ver="' + esc(d2.ruta) + '" data-nom="' + esc(d2.nombre) + '">Ver</button>' +
              '<button class="btn gh sm" data-bajar="' + esc(d2.ruta) + '" data-nom="' + esc(d2.nombre) + '">Descargar</button>' +
              (x.esOtro && (d2.estado || 'vigente') === 'vigente'
                ? '<button class="btn gh sm" data-repl="' + esc(d2.id) + '">Reemplazar</button><button class="btn gh sm" data-elim="' + esc(d2.id) + '">Eliminar</button>' : '') + '</div>' }
      ], lista, { vacio: 'Sin documentos ni evidencias registradas.', filaAttr: d2 => (d2.estado || 'vigente') !== 'vigente' ? 'class="doc-baja"' : '' });
  }

  /* ---------- Tab 9: Vigilancia ---------- */
  function tabVig(x) {
    const v = x.vig;
    const venc = v.proximaValoracion && v.proximaValoracion <= sumaDias(hoyISO(), 30);
    return (x.esOtro ? '<div class="btn-row" style="margin-bottom:14px">' +
        '<button class="btn" data-act="editVig">Editar programa</button>' +
        '<button class="btn gh" data-act="nuevoCaso">＋ Caso en seguimiento</button></div>' : '') +
      '<div class="card"><div class="card-t">Programa de vigilancia médica</div><div class="frow">' +
        ro('Programa aplicable', v.programa) + ro('Periodicidad', v.periodicidad) +
        ro('Próxima valoración', v.proximaValoracion ? fmt(v.proximaValoracion) + (venc ? ' ⚠' : '') : 'No programada') +
      '</div>' +
      '<div class="field"><label>Recomendaciones</label><div style="font-size:13px">' + esc(v.recomendaciones || '—') + '</div></div>' +
      '<div class="field"><label>Restricciones laborales</label><div style="font-size:13px;color:var(--wnt)">' + esc(v.restricciones || 'Ninguna') + '</div></div>' +
      '</div>' +
      '<h2 class="sec-t">Casos en seguimiento</h2>' +
      tabla([
        { t: 'Fecha', v: c => fmt(c.fecha) }, { t: 'Tema', k: 'tema' },
        { t: 'Estado', html: c => '<span class="chip ' + (c.estado === 'cerrado' ? 'ok' : 'wa') + '">' + esc(c.estado) + '</span>' },
        { t: 'Nota', k: 'nota' }
      ], v.casos || [], { vacio: 'Sin casos abiertos.' });
  }

  /* ---------- Acciones dentro de los tabs ---------- */
  function bindTab(ctx) {
    $$('[data-act]').forEach(b => b.addEventListener('click', () => ({
      nuevaCons: () => popupConsulta(ctx.empId),
      nuevaEval: () => popupEvaluacion(ctx.empId),
      nuevoRT: () => popupRiesgo(ctx.empId),
      nuevaInc: () => popupIncapacidad(ctx.empId),
      editHistoria: () => editarHistoriaMedico(ctx.empId),
      subirDoc: () => popupSubirDocumento(ctx.empId),
      editVig: () => popupVigilancia(ctx.empId, ctx.vig),
      nuevoCaso: () => popupCaso(ctx.empId),
      nuevaVac: () => popupVacuna(ctx.empId),
      programar: () => popupProgramar(ctx.empId)
    }[b.dataset.act] || function () {})()));
    $$('[data-8d]').forEach(b => b.addEventListener('click', () => popup8D(b.dataset['8d'], ctx)));
    $$('[data-seg]').forEach(b => b.addEventListener('click', () => popupSeguimiento(b.dataset.seg, ctx)));
    $$('[data-rein]').forEach(b => b.addEventListener('click', () => popupReincorporacion(b.dataset.rein, ctx)));
  }

  async function volverExpediente(empId) { await recargar(); verExpediente(empId, true); }

  /* ===========================================================
     VISTAS GLOBALES DEL MÉDICO
     =========================================================== */
  let busca = '', filtroHist = '';
  const MESES_HISTORIA = 12;               // una historia con más de 12 meses sin actualizarse se considera desactualizada
  function pacientes() {
    const mapaH = {}; (D.historias || []).forEach(h => { mapaH[h.empleado] = h; });
    const limite = new Date(); limite.setMonth(limite.getMonth() - MESES_HISTORIA);
    const estadoH = e => { const h = mapaH[e.id]; if (!h || !h.actualizado) return 'sin'; return new Date(h.actualizado) >= limite ? 'actualizada' : 'desactualizada'; };
    const cuenta = { actualizada: 0, desactualizada: 0, sin: 0 }; D.emps.forEach(e => { cuenta[estadoH(e)]++; });
    const lista = D.emps.filter(e => (!busca || ZX.coincide(e.nombre + ' ' + e.id + ' ' + (e.direccion || '') + ' ' + (e.departamento || ''), busca)) && (!filtroHist || estadoH(e) === filtroHist));
    main.innerHTML =
      cab('Pacientes', lista.length + (lista.length === D.emps.length ? '' : ' de ' + D.emps.length) + ' colaboradores con expediente ocupacional') +
      AVISO +
      '<div class="filters"><div class="field" style="min-width:290px"><label>Buscar por nombre, número o departamento</label>' +
        '<input id="q" value="' + esc(busca) + '" placeholder="Ej. nombre, nómina o departamento"></div>' +
        '<div class="field"><label>Historia clínica</label><select id="fh">' +
          opts([['', 'Todas'], ['actualizada', 'Actualizada (' + cuenta.actualizada + ')'], ['desactualizada', 'Desactualizada (' + cuenta.desactualizada + ')'], ['sin', 'Sin historia (' + cuenta.sin + ')']], filtroHist) +
        '</select></div></div>' +
      tabla([
        { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Departamento', k: 'departamento' },
        { t: 'Dictamen', html: e => { const ev = D.evaluaciones.filter(x => x.empleado === e.id).sort(desc('fecha'))[0];
            return ev ? chipDictamen(ev) : '<span class="chip nt">Sin evaluación</span>'; } },
        { t: 'Historia clínica', html: e => { const st = estadoH(e);
            return st === 'sin' ? '<span class="chip nt">Sin historia</span>'
              : '<span class="chip ' + (st === 'actualizada' ? 'ok' : 'wa') + '">' + (st === 'actualizada' ? 'Actualizada' : 'Desactualizada') + '</span> <span class="page-sub">' + esc(fmt(mapaH[e.id].actualizado)) + '</span>'; } },
        { t: 'Incap. vigente', html: e => D.incapacidades.some(i => i.empleado === e.id && i.estado === 'vigente')
            ? '<span class="chip no">Sí</span>' : '<span class="chip nt">No</span>' },
        { t: '', html: e => '<div class="btn-row"><button class="btn sm" data-exp="' + esc(e.id) + '">Expediente</button>' +
                            '<button class="btn ac sm" data-con="' + esc(e.id) + '">Consulta</button></div>' }
      ], lista, { vacio: 'Sin coincidencias.' });

    ZX.pie(main, 'Acceso restringido al personal del servicio médico. Cada apertura de expediente queda registrada en la bitácora de auditoría del servidor. «Actualizada» = historia clínica puesta al día en los últimos ' + MESES_HISTORIA + ' meses.');
    const q = $('#q');
    q.addEventListener('input', () => { busca = q.value; const p = q.selectionStart; pacientes(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $('#fh').addEventListener('change', e => { filtroHist = e.target.value; pacientes(); });
    $$('[data-exp]').forEach(b => b.addEventListener('click', () => { tabExp = 'ficha'; verExpediente(b.dataset.exp, true); }));
    $$('[data-con]').forEach(b => b.addEventListener('click', () => popupConsulta(b.dataset.con)));
  }

  /* ---------- Pendientes del médico (Doctor → Pendientes) ---------- */
  let pendSel = '';
  async function pendientes() {
    main.innerHTML = cab('Pendientes', 'Lo que requiere atención del servicio médico') + '<div class="empty">Cargando…</div>';
    let P;
    try { P = await API.medico.pendientes(); }
    catch (e) { main.innerHTML = cab('Pendientes', '') + '<div class="empty">No se pudieron cargar los pendientes: ' + esc(e.message) + '</div>'; return; }
    const CATS = [
      ['citas_hoy', 'Citas de hoy', 'Confirmadas, aún sin atender', ''],
      ['casos_vencidos', 'Casos con valoración vencida', 'Seguimiento atrasado', 'alto'],
      ['casos_sin_valorar', 'Casos por valorar', 'Desviaciones sin valoración médica', 'medio'],
      ['evaluaciones_vencidas', 'Exámenes programados vencidos', 'Programados y sin realizar', 'alto'],
      ['evaluaciones_por_vencer', 'Evaluaciones por vencer', 'Vencen en 30 días o ya vencieron', 'medio'],
      ['restricciones_por_revisar', 'Restricciones por revisar', 'Vencen en 30 días', 'medio'],
      ['vigilancia_por_valorar', 'Atención y Control de Salud', 'Valoraciones en los próximos 30 días', 'medio'],
      ['incapacidades_vigentes', 'Incapacidades vigentes', 'Personas ausentes hoy', ''],
      ['riesgos_abiertos', 'Riesgos de trabajo sin cerrar', 'Requieren seguimiento', 'medio']
    ];
    const total = CATS.reduce((n, c) => n + (P[c[0]] || []).length, 0);
    const H = P.historias || {}, hPend = (H.desactualizadas || 0) + (H.sin_historia || 0);
    if (!pendSel || !(P[pendSel] || []).length) { const primero = CATS.find(c => (P[c[0]] || []).length); pendSel = primero ? primero[0] : ''; }
    main.innerHTML =
      cab('Pendientes', total ? total + ' asuntos requieren atención' : 'Sin asuntos pendientes') +
      '<div class="pend-grid">' + CATS.map(c => { const n = (P[c[0]] || []).length;
        return '<button type="button" class="pend-card ' + (n ? c[3] : '') + (pendSel === c[0] ? ' on' : '') + '" data-pend="' + c[0] + '"' + (n ? '' : ' disabled style="opacity:.55;cursor:default"') + '>' +
          '<span class="pv' + (n ? '' : ' pend-ok') + '">' + (n || '✓') + '</span><span class="pl">' + esc(c[1]) + '</span><span class="pd">' + esc(c[2]) + '</span></button>'; }).join('') +
        '<div class="pend-card ' + (hPend ? 'medio' : '') + '" style="cursor:default"><span class="pv' + (hPend ? '' : ' pend-ok') + '">' + (hPend || '✓') + '</span><span class="pl">Historias clínicas por actualizar</span>' +
          '<span class="pd">' + (H.desactualizadas || 0) + ' desactualizadas · ' + (H.sin_historia || 0) + ' sin historia</span>' +
          '<span class="btn-row" style="margin-top:8px"><button class="btn gh sm" data-hist="desactualizada">Ver desactualizadas</button><button class="btn gh sm" data-hist="sin">Ver sin historia</button></span></div>' +
      '</div>' +
      (pendSel ? '<h2 class="card-t" style="margin:6px 0 10px">' + esc(CATS.find(c => c[0] === pendSel)[1]) + '</h2>' +
        tabla([
          { t: 'Colaborador', k: 'nombre' }, { t: 'Departamento', v: r => r.departamento || '—' }, { t: 'Detalle', k: 'detalle' },
          { t: '', html: r => '<div class="btn-row"><button class="btn sm" data-exp="' + esc(r.empleado) + '">Expediente</button>' + (pendSel === 'citas_hoy' ? '<button class="btn ac sm" data-con="' + esc(r.empleado) + '">Consulta</button>' : '') + '</div>' }
        ], P[pendSel] || [], { vacio: 'Nada pendiente en esta categoría.' }) :
        '<div class="empty">✓ No hay asuntos pendientes. Las historias clínicas por actualizar están arriba.</div>');
    ZX.pie(main, 'Calculado en el servidor al abrir esta pantalla. Los recordatorios por correo se agregarán al final, junto con los demás avisos del portal.');
    $$('[data-pend]').forEach(b => b.addEventListener('click', () => { pendSel = b.dataset.pend; pendientes(); }));
    $$('[data-hist]').forEach(b => b.addEventListener('click', () => { filtroHist = b.dataset.hist; busca = ''; nav.ir('pacientes'); }));
    $$('[data-exp]').forEach(b => b.addEventListener('click', () => { tabExp = 'ficha'; verExpediente(b.dataset.exp, true); }));
    $$('[data-con]').forEach(b => b.addEventListener('click', () => popupConsulta(b.dataset.con, { volver: true })));
  }

  let fTipoRT = '';
  function riesgosGlobal() {
    const lista = D.riesgos.filter(r => !fTipoRT || r.tipo === fTipoRT).sort(desc('fecha'));
    const anio = String(new Date().getFullYear());
    const delAnio = D.riesgos.filter(r => r.fecha.slice(0, 4) === anio);
    const cols = [
      { t: 'Folio', k: 'id' }, { t: 'Tipo', v: r => nombreCat(CAT.tiposRiesgo, r.tipo) },
      { t: 'Fecha', v: r => fmt(r.fecha) }, { t: 'Colaborador', v: r => nombreDe(r.empleado) },
      { t: 'Área', k: 'area' }, { t: 'Puesto', k: 'puesto' }, { t: 'Lesión', k: 'lesion' },
      { t: 'Días perdidos', k: 'diasPerdidos' }, { t: 'Estado', k: 'estado' }
    ];
    main.innerHTML =
      cab('Riesgos de trabajo', 'Accidentes, incidentes y enfermedades de trabajo',
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
            '<div class="filters" style="margin-top:14px"><div class="field"><label>Tipo</label><select id="ft">' +
        opts([['', 'Todos']].concat(CAT.tiposRiesgo.map(t => [t.c, t.n])), fTipoRT) + '</select></div></div>' +
      tabla(cols.slice(0, 8).concat([
        { t: 'Estado', html: r => chipEstadoRT(r.estado) },
        { t: '', html: r => '<button class="btn sm" data-abrir="' + esc(r.empleado) + '">Ver expediente</button>' }
      ]), lista, { vacio: 'Sin eventos registrados.' });

    ZX.pie(main, 'Todo accidente de trabajo debe reportarse al IMSS mediante el formato ST-7 dentro de las 24 horas siguientes. El análisis 8D documenta la causa raíz y las acciones correctivas.' + NOTA_IND);
    $('#ft').addEventListener('change', e => { fTipoRT = e.target.value; riesgosGlobal(); });
    $('#csv').addEventListener('click', () => descargarCSV('Riesgos_Trabajo_' + hoyISO() + '.csv', cols, lista));
    $$('[data-abrir]').forEach(b => b.addEventListener('click', () => { tabExp = 'rt'; verExpediente(b.dataset.abrir, true); }));
  }

  function ausentismo() {
    const anio = String(new Date().getFullYear());
    const lista = D.incapacidades.sort(desc('inicio'));
    const delAnio = lista.filter(i => i.inicio.slice(0, 4) === anio);
    const dias = delAnio.reduce((a, i) => a + i.dias, 0);
    const porTipo = CAT.tiposIncapacidad.map(t => ({ t: t.n, n: delAnio.filter(i => i.tipo === t.c).reduce((a, i) => a + i.dias, 0) }));
    const max = Math.max(1, ...porTipo.map(p => p.n));
    const cols = [
      { t: 'Folio', k: 'folio' }, { t: 'Colaborador', v: i => nombreDe(i.empleado) },
      { t: 'Tipo', v: i => nombreCat(CAT.tiposIncapacidad, i.tipo) },
      { t: 'Inicio', v: i => fmt(i.inicio) }, { t: 'Fin', v: i => fmt(i.fin) },
      { t: 'Días', k: 'dias' }, { t: 'Causa', k: 'causa' }, { t: 'Estado', k: 'estado' }
    ];
    main.innerHTML =
      cab('Ausentismo médico', 'Incapacidades y días perdidos', '<button class="btn gh" id="csv">⬇ CSV</button>') +
            '<h2 class="sec-t">Días perdidos por tipo (' + anio + ')</h2>' +
      '<div class="card">' + porTipo.map(p =>
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:230px;font-size:12.5px;color:var(--tx2)">' + esc(p.t) + '</div>' +
          '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
            '<div style="width:' + (p.n / max * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
          '<b style="width:34px;text-align:right;font-size:13px">' + p.n + '</b></div>').join('') + '</div>' +
      '<h2 class="sec-t">Detalle</h2>' +
      tabla(cols.slice(0, 7).concat([
        { t: 'Estado', html: i => '<span class="chip ' + (i.estado === 'vigente' ? 'wa' : 'ok') + '">' + esc(i.estado) + '</span>' },
        { t: '', html: i => '<button class="btn sm" data-abrir="' + esc(i.empleado) + '">Expediente</button>' }
      ]), lista, { vacio: 'Sin incapacidades registradas.' });

    ZX.pie(main, 'Los días se cuentan como días naturales del periodo de la incapacidad, según el certificado expedido por el IMSS.' + NOTA_IND);
    $('#csv').addEventListener('click', () => descargarCSV('Ausentismo_' + hoyISO() + '.csv', cols, lista));
    $$('[data-abrir]').forEach(b => b.addEventListener('click', () => { tabExp = 'inc'; verExpediente(b.dataset.abrir, true); }));
  }

  async function vigilancias() {
    const todos = await Promise.all(D.emps.map(e => API.medico.vigilancia(e.id)));
    const filas = todos.map((v, i) => Object.assign({}, v, { nombre: D.emps[i].nombre, departamento: D.emps[i].departamento, id: D.emps[i].id }))
      .filter(v => v.programa || v.proximaValoracion)
      .sort((a, b) => String(a.proximaValoracion).localeCompare(String(b.proximaValoracion)));
    const vencen = filas.filter(v => v.proximaValoracion && v.proximaValoracion <= sumaDias(hoyISO(), 30));
    const casos = filas.reduce((a, v) => a + (v.casos || []).filter(c => c.estado !== 'cerrado').length, 0);

    main.innerHTML =
      cab('Atención y Control de Salud', 'Programas, restricciones y casos en seguimiento') +
            '<h2 class="sec-t">Programas activos</h2>' +
      tabla([
        { t: 'Nº', k: 'id' }, { t: 'Colaborador', k: 'nombre' }, { t: 'Departamento', k: 'departamento' },
        { t: 'Programa', k: 'programa' }, { t: 'Periodicidad', k: 'periodicidad' },
        { t: 'Próxima valoración', html: v => !v.proximaValoracion ? '—'
            : v.proximaValoracion <= hoyISO() ? '<span class="chip no">Vencida ' + esc(fmt(v.proximaValoracion)) + '</span>'
            : v.proximaValoracion <= sumaDias(hoyISO(), 30) ? '<span class="chip wa">' + esc(fmt(v.proximaValoracion)) + '</span>'
            : '<span class="chip ok">' + esc(fmt(v.proximaValoracion)) + '</span>' },
        { t: 'Restricciones', v: v => v.restricciones || 'Ninguna' },
        { t: 'Casos abiertos', v: v => (v.casos || []).filter(c => c.estado !== 'cerrado').length },
        { t: '', html: v => '<button class="btn sm" data-abrir="' + esc(v.id) + '">Expediente</button>' }
      ], filas, { vacio: 'Sin programas de vigilancia asignados.' });

    ZX.pie(main, 'La periodicidad de la vigilancia depende del agente de exposición del puesto (NOM-011 ruido, NOM-010 químicos, NOM-024 vibraciones, entre otras).' + NOTA_IND);
    $$('[data-abrir]').forEach(b => b.addEventListener('click', () => { tabExp = 'vig'; verExpediente(b.dataset.abrir, true); }));
  }

  /* ===========================================================
     POPUPS DEL MÉDICO
     =========================================================== */
  function popupConsulta(empId, opc) {
    opc = opc || {};
    const emp = empDe(empId);
    let proxima = null, guardada = false;        // cita agendada desde esta consulta
    const cuerpoConsulta = modal({
      titulo: 'Registrar consulta · ' + emp.nombre, ancho: 'lg',
      alCerrar: () => { if (proxima && !guardada) API.citas.cancelar(proxima.id).catch(() => {}); },   // sin guardar la consulta no se deja la cita apartada
      cuerpo:
        '<fieldset><legend>Motivo</legend>' +
          '<div class="frow">' +
            selc('motivoCod', 'Motivo de consulta (catálogo)', CAT.motivosConsulta.map(m => [m.c, m.c + ' · ' + m.n])) +
            txt('motivo', 'Detalle del motivo', '', 'text', 200) +
            txt('hora', 'Hora', new Date().toTimeString().slice(0, 5), 'time') +
          '</div>' +
          '<p class="hint" style="font-size:11px;color:var(--tx3)">El catálogo alimenta el indicador de distribución de motivos de consulta. ' +
          'Usa “M99 · Otro” sólo cuando ninguna categoría aplique.</p></fieldset>' +
        '<fieldset><legend>Signos vitales y somatometría</legend><div class="frow">' +
          txt('estatura', 'Estatura (cm)', '', 'number') + txt('peso', 'Peso (kg)', '', 'number') +
          txt('ta', 'Tensión arterial', '') + txt('fc', 'Frecuencia cardiaca (lpm)', '', 'number') +
          txt('fr', 'Frecuencia respiratoria (rpm)', '', 'number') + txt('temperatura', 'Temperatura (°C)', '', 'number') +
          txt('spo2', 'Saturación O₂ (%)', '', 'number') +
        '</div></fieldset>' +
        '<fieldset><legend>Exploración física</legend><div class="frow">' +
          CAT.exploracion.map(kk => txt('ex_' + kk, CAT.exploracionLabel[kk], '')).join('') +
        '</div></fieldset>' +
        '<fieldset><legend>Resolución</legend>' +
          area('dx', 'Diagnóstico', '') + area('tx', 'Tratamiento / indicaciones', '') +
          area('evolucion', 'Evolución', '', 'Estado del paciente y respuesta al tratamiento') +
          '<div class="frow">' + txt('referencia', 'Referencia / interconsulta', '', 'text', 200) +
            txt('estudios', 'Estudios adicionales solicitados', '') +
            '<div class="field"><label>Próxima cita</label><div id="pcBox"></div></div></div>' +
        '</fieldset>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Editar historia clínica', clase: 'gh', accion: () => editarHistoriaMedico(empId, true) },
        { txt: 'Guardar consulta', accion: async (b) => {
            const motivo = $('#motivo', b).value.trim();
            const ex = {}; CAT.exploracion.forEach(kk => { ex[kk] = $('#ex_' + kk, b).value.trim(); });
            try {
              await API.medico.registrarConsulta({
                empleado: empId, medico: sesion.id, hora: $('#hora', b).value,
                motivoCod: $('#motivoCod', b).value,
                motivo: motivo || nombreCat(CAT.motivosConsulta, $('#motivoCod', b).value),
                somatometria: {
                  estatura: +$('#estatura', b).value || null, peso: +$('#peso', b).value || null,
                  ta: $('#ta', b).value.trim(), fc: +$('#fc', b).value || null
                },
                fr: +$('#fr', b).value || null, temperatura: +$('#temperatura', b).value || null, spo2: +$('#spo2', b).value || null,
                exploracion: ex,
                diagnostico: $('#dx', b).value.trim(), tratamiento: $('#tx', b).value.trim(),
                evolucion: $('#evolucion', b).value.trim(), referencia: $('#referencia', b).value.trim(),
                estudios: $('#estudios', b).value.trim(), proximaCita: proxima ? proxima.fecha : null
              });
              guardada = true; cerrarModal(); toast('Consulta agregada al expediente.', 'ok');
              /* la cita de hoy de esta persona queda atendida (sin tocar la que se agendó como próxima) */
              for (const c of D.citas.filter(c => c.empleado === empId && c.fecha === hoyISO() && c.estado === 'confirmada' && (!proxima || c.id !== proxima.id))) {
                try { await API.citas.marcarAtendida(c.id); } catch (e) { /* no bloquea la consulta */ }
              }
              if (opc.volver) await refrescar(); else { tabExp = 'cons'; await volverExpediente(empId); }
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    /* «Próxima cita»: abre el formulario de cita médica ENCIMA de la consulta, con la persona ya fijada */
    const pcBox = $('#pcBox', cuerpoConsulta);
    const abrirCita = () => ZX.formularios.cita({
      empleado: empId, nombre: emp.nombre, motivo: 'Seguimiento', encima: true, reemplaza: proxima ? proxima.id : null,
      alAgendar: async (nueva) => {
        if (proxima) { try { await API.citas.cancelar(proxima.id); } catch (e) { /* ya no existía */ } }   // «Cambiar» libera la anterior
        proxima = nueva; pintaProxima();
      }
    });
    function pintaProxima() {
      pcBox.innerHTML = proxima
        ? '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>' + esc(fmt(proxima.fecha) + ' · ' + proxima.hora + ' h') + '</b>' +
          '<button type="button" class="btn gh sm" id="pcCambiar">Cambiar</button><button type="button" class="btn gh sm" id="pcQuitar">Quitar</button></div>'
        : '<button type="button" class="btn gh" id="pcAgendar">📅 Agendar próxima cita</button>';
      const a = $('#pcAgendar', pcBox), c = $('#pcCambiar', pcBox), q = $('#pcQuitar', pcBox);
      if (a) a.addEventListener('click', abrirCita);
      if (c) c.addEventListener('click', abrirCita);
      if (q) q.addEventListener('click', async () => {
        try { await API.citas.cancelar(proxima.id); proxima = null; pintaProxima(); toast('Cita cancelada.', 'ok'); } catch (e) { toast(e.message, 'no'); }
      });
    }
    pintaProxima();
  }

  let estudiosTmp = [];
  function popupEvaluacion(empId) {
    estudiosTmp = [];
    const body = modal({
      titulo: 'Nueva evaluación de salud · ' + empDe(empId).nombre, ancho: 'lg',
      cuerpo:
        '<fieldset><legend>Evaluación</legend><div class="frow">' +
          selc('tipoEv', 'Tipo de evaluación', CAT.tiposEvaluacion.map(t => [t.c, t.n])) +
          txt('fechaEv', 'Fecha', hoyISO(), 'date') +
          txt('motivoEv', 'Motivo', '', 'text', 200) +
        '</div>' +
        area('hallazgos', 'Hallazgos clínicos', '') + '</fieldset>' +
        '<fieldset><legend>Estudios de laboratorio y gabinete</legend>' +
          '<div class="frow">' +
            selc('estNombre', 'Estudio', CAT.tiposEstudio.map(t => [t, t])) +
            txt('estFecha', 'Fecha', hoyISO(), 'date') +
            txt('estResultado', 'Resultado', '', 'text', 200) +
            '<div class="field"><label>&nbsp;</label><button type="button" class="btn gh sm" id="addEst">＋ Agregar</button></div>' +
          '</div><div id="lstEst"></div></fieldset>' +
        '<fieldset><legend>Dictamen de aptitud laboral</legend><div class="frow">' +
          selc('dictamen', 'Dictamen', CAT.dictamenes.map(t => [t.c, t.n])) +
          txt('vigencia', 'Vigencia del dictamen', sumaDias(hoyISO(), 365), 'date') +
        '</div>' + area('restricciones', 'Restricciones laborales (si aplica)', '') + '</fieldset>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar evaluación', accion: async (b) => {
            try {
              await API.medico.guardarEvaluacion({
                empleado: empId, medico: sesion.id, tipo: $('#tipoEv', b).value, fecha: $('#fechaEv', b).value,
                motivo: $('#motivoEv', b).value.trim(), hallazgos: $('#hallazgos', b).value.trim(),
                estudios: estudiosTmp.slice(), dictamen: $('#dictamen', b).value,
                restricciones: $('#restricciones', b).value.trim(), vigencia: $('#vigencia', b).value
              });
              cerrarModal(); toast('Evaluación registrada.', 'ok');
              tabExp = 'eval'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    const pinta = () => {
      $('#lstEst', body).innerHTML = tabla([
        { t: 'Estudio', k: 'nombre' }, { t: 'Fecha', v: s => fmt(s.fecha) }, { t: 'Resultado', k: 'resultado' }
      ], estudiosTmp, { vacio: 'Aún no agregas estudios.' });
    };
    $('#addEst', body).addEventListener('click', () => {
      estudiosTmp.push({ nombre: $('#estNombre', body).value, fecha: $('#estFecha', body).value, resultado: $('#estResultado', body).value.trim() });
      $('#estResultado', body).value = '';
      pinta();
    });
    pinta();
  }

  function popupRiesgo(empId) {
    const emp = empDe(empId);
    modal({
      titulo: 'Registrar riesgo de trabajo · ' + emp.nombre, ancho: 'lg',
      cuerpo:
        '<fieldset><legend>Evento</legend><div class="frow">' +
          selc('tipoRT', 'Tipo', CAT.tiposRiesgo.map(t => [t.c, t.n])) +
          txt('fechaRT', 'Fecha', hoyISO(), 'date') + txt('horaRT', 'Hora', '', 'time') +
          txt('areaRT', 'Área involucrada', emp.departamento) + txt('puestoRT', 'Puesto involucrado', emp.puesto) +
          txt('mecanismo', 'Mecanismo de lesión', '') +
        '</div>' +
        area('descripcionRT', 'Descripción del evento', '') +
        '<div class="frow">' + txt('lesion', 'Lesión resultante', '', 'text', 200) +
          txt('diasPerdidos', 'Días perdidos', '0', 'number') +
          selc('imss', '¿Reportado al IMSS (ST-7)?', [['si', 'Sí'], ['no', 'No']]) + '</div></fieldset>' +
        '<fieldset><legend>Análisis de causa raíz — 8 disciplinas</legend>' +
          CAT.ochoD.map(d2 => area('o_' + d2.c, d2.n, '')).join('') + '</fieldset>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            const desc2 = $('#descripcionRT', b).value.trim();
            if (!desc2) return toast('Describe el evento.', 'wa');
            const ochoD = {}; CAT.ochoD.forEach(d2 => { ochoD[d2.c] = $('#o_' + d2.c, b).value.trim(); });
            try {
              await API.medico.guardarRiesgo({
                empleado: empId, tipo: $('#tipoRT', b).value, fecha: $('#fechaRT', b).value, hora: $('#horaRT', b).value,
                area: $('#areaRT', b).value, puesto: $('#puestoRT', b).value, mecanismo: $('#mecanismo', b).value,
                descripcion: desc2, lesion: $('#lesion', b).value, diasPerdidos: +$('#diasPerdidos', b).value || 0,
                reportadoIMSS: $('#imss', b).value === 'si', ochoD,
                estado: CAT.ochoD.every(d2 => ochoD[d2.c]) ? 'cerrado' : 'abierto'
              });
              cerrarModal(); toast('Riesgo de trabajo registrado.', 'ok');
              tabExp = 'rt'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popup8D(id, ctx) {
    const r = D.riesgos.find(x => x.id === id) || {};
    const o = r.ochoD || {};
    modal({
      titulo: 'Análisis 8D · ' + id, ancho: 'lg',
      cuerpo: CAT.ochoD.map(d2 => area('e_' + d2.c, d2.n, o[d2.c])).join('') +
        '<div class="field"><label for="estadoRT">Estado del caso</label><select id="estadoRT">' +
          [['abierto', 'Abierto'], ['en_seguimiento', 'En seguimiento'], ['cerrado', 'Cerrado']].map(p =>
            '<option value="' + p[0] + '"' + (r.estado === p[0] ? ' selected' : '') + '>' + p[1] + '</option>').join('') +
        '</select></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            const ochoD = {}; CAT.ochoD.forEach(d2 => { ochoD[d2.c] = $('#e_' + d2.c, b).value.trim(); });
            try {
              await API.medico.actualizarRiesgo(id, { ochoD, estado: $('#estadoRT', b).value });
              cerrarModal(); toast('Análisis actualizado.', 'ok');
              await volverExpediente(ctx.empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupSeguimiento(id, ctx) {
    modal({
      titulo: 'Nota de seguimiento · ' + id,
      cuerpo: area('nota', 'Nota clínica de seguimiento', '', 'Evolución, curaciones, cambios de indicación…'),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Agregar', accion: async (b) => {
            const n = $('#nota', b).value.trim();
            if (!n) return toast('Escribe la nota.', 'wa');
            try { await API.medico.agregarSeguimiento(id, n); cerrarModal(); toast('Nota agregada.', 'ok'); await volverExpediente(ctx.empId); }
            catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupReincorporacion(id, ctx) {
    const r = D.riesgos.find(x => x.id === id) || {};
    const re = r.reincorporacion || {};
    modal({
      titulo: 'Reincorporación laboral · ' + id,
      cuerpo:
        '<div class="frow">' + txt('freinc', 'Fecha de reincorporación', re.fecha || hoyISO(), 'date') +
        selc('estadoRT2', 'Estado del caso', [['en_seguimiento', 'En seguimiento'], ['cerrado', 'Cerrado']]) + '</div>' +
        area('cond', 'Condiciones y restricciones de reincorporación', re.condiciones),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            try {
              await API.medico.actualizarRiesgo(id, {
                reincorporacion: { fecha: $('#freinc', b).value, condiciones: $('#cond', b).value.trim() },
                estado: $('#estadoRT2', b).value
              });
              cerrarModal(); toast('Reincorporación registrada.', 'ok'); await volverExpediente(ctx.empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupIncapacidad(empId) {
    const body = modal({
      titulo: 'Registrar incapacidad · ' + empDe(empId).nombre,
      cuerpo:
        '<div class="frow">' +
          selc('tipoInc', 'Tipo de incapacidad', CAT.tiposIncapacidad.map(t => [t.c, t.n])) +
          txt('folioInc', 'Folio del certificado', '') +
          txt('inicioInc', 'Inicio', hoyISO(), 'date') + txt('finInc', 'Fin', hoyISO(), 'date') +
          txt('diasInc', 'Días', '1', 'number') +
          selc('expedida', 'Expedida por', [['IMSS', 'IMSS'], ['Médico de empresa', 'Médico de empresa'], ['Particular', 'Particular']]) +
        '</div>' +
        txtF('causaInc', 'Causa / diagnóstico') +
        area('segInc', 'Seguimiento', '', 'Plan de reincorporación, valoraciones pendientes…'),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            const ini = $('#inicioInc', b).value, fin = $('#finInc', b).value;
            if (!ini || !fin || fin < ini) return toast('Revisa el periodo de la incapacidad.', 'wa');
            try {
              await API.medico.guardarIncapacidad({
                empleado: empId, tipo: $('#tipoInc', b).value, folio: $('#folioInc', b).value.trim(),
                inicio: ini, fin: fin, dias: +$('#diasInc', b).value || ZX.diffDias(ini, fin),
                causa: $('#causaInc', b).value.trim(), expedidaPor: $('#expedida', b).value,
                estado: fin >= hoyISO() ? 'vigente' : 'concluida', seguimiento: $('#segInc', b).value.trim()
              });
              cerrarModal(); toast('Incapacidad registrada.', 'ok');
              tabExp = 'inc'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    const calc = () => {
      const i = $('#inicioInc', body).value, f = $('#finInc', body).value;
      if (i && f && f >= i) $('#diasInc', body).value = ZX.diffDias(i, f);
    };
    $('#inicioInc', body).addEventListener('change', calc);
    $('#finInc', body).addEventListener('change', calc);
  }

  /* Subir (o reemplazar) un documento: PDF, JPG o PNG de hasta 20 MB. Se valida el contenido real del archivo. */
  function popupSubirDocumento(empId, reemplaza) {
    let archivo = null;
    const m = modal({
      titulo: reemplaza ? 'Reemplazar documento' : 'Subir documento', ancho: 'lg',
      cuerpo:
        (reemplaza ? '<div class="priv">♻️ <div>Se reemplazará <b>' + esc(reemplaza.nombre) + '</b>. El archivo anterior se conserva marcado como «reemplazado».</div></div>' : '') +
        '<div class="drop" id="dz"><b>Arrastra el archivo aquí o haz clic para elegirlo</b><span class="page-sub">PDF, JPG o PNG · máximo 20 MB</span></div>' +
        '<input id="docFile" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden>' +
        '<div id="docSel" class="page-sub" style="margin:-4px 0 12px"></div>' +
        '<div class="frow">' +
          selc('tipoDoc', 'Tipo de documento', CAT.tiposDocMedico.map(t => [t, t]), reemplaza ? reemplaza.tipo : undefined) +
          txt('nomDoc', 'Nombre que se mostrará', reemplaza ? reemplaza.nombre : '') +
          txt('fechaDoc', 'Fecha del documento', hoyISO(), 'date') +
        '</div>' + txtF('notasDoc', 'Notas'),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: reemplaza ? 'Reemplazar' : 'Subir', accion: async (b) => {
            if (!archivo) return toast('Elige un archivo.', 'wa');
            const n = $('#nomDoc', b).value.trim();
            if (!n) return toast('Escribe el nombre del documento.', 'wa');
            const meta = { tipo: $('#tipoDoc', b).value, nombre: n, fecha: $('#fechaDoc', b).value, notas: $('#notasDoc', b).value.trim() };
            const btn = b.closest('.modal').querySelector('.mo-foot .btn:last-child'); if (btn) { btn.disabled = true; btn.textContent = 'Subiendo…'; }
            try {
              if (reemplaza) await API.medico.reemplazarDocumento(reemplaza, archivo, meta); else await API.medico.subirDocumento(empId, archivo, meta);
              cerrarModal(); toast(reemplaza ? 'Documento reemplazado.' : 'Documento subido.', 'ok');
              tabExp = 'docs'; await volverExpediente(empId);
            } catch (ex) { toast(ex.message, 'no'); if (btn) { btn.disabled = false; btn.textContent = reemplaza ? 'Reemplazar' : 'Subir'; } }
          } }
      ]
    });
    const dz = $('#dz', m), inp = $('#docFile', m);
    const elegir = f => { archivo = f; $('#docSel', m).textContent = f ? f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB' : ''; if (f && !$('#nomDoc', m).value) $('#nomDoc', m).value = f.name.replace(/\.[A-Za-z0-9]+$/, ''); };
    dz.addEventListener('click', () => inp.click());
    inp.addEventListener('change', () => elegir(inp.files[0] || null));
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) elegir(e.dataTransfer.files[0]); });
  }

  /* Eliminar = baja lógica con motivo. El archivo se conserva como evidencia; la persona deja de verlo. */
  function popupEliminarDocumento(doc, empId) {
    if (!doc) return;
    modal({
      titulo: 'Eliminar documento',
      cuerpo: '<div class="priv">🗑️ <div>Vas a eliminar <b>' + esc(doc.nombre) + '</b>. Dejará de verse para la persona; el archivo se conserva como evidencia y la baja queda en la bitácora.</div></div>' +
        '<div class="field"><label for="motBaja">Motivo (obligatorio)</label><input id="motBaja" maxlength="160" placeholder="Ej. Documento cargado en el expediente equivocado"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Eliminar', accion: async (b) => {
            const mot = $('#motBaja', b).value.trim();
            if (mot.length < 5) return toast('Escribe el motivo.', 'wa');
            try { await API.medico.eliminarDocumento(doc.id, mot); cerrarModal(); toast('Documento eliminado.', 'ok'); tabExp = 'docs'; await volverExpediente(empId); }
            catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
  }
  function popupVigilancia(empId, v) {
    modal({
      titulo: 'Programa de vigilancia · ' + empDe(empId).nombre, ancho: 'lg',
      cuerpo:
        '<div class="frow">' +
          txt('programa', 'Programa o periodicidad de vigilancia aplicable', v.programa, 'text', 200) +
          selc('periodicidad', 'Periodicidad', CAT.periodicidades.map(p => [p, p]), v.periodicidad) +
          txt('proxVal', 'Fecha de próxima valoración', v.proximaValoracion || sumaDias(hoyISO(), 365), 'date') +
        '</div>' +
        area('recom', 'Recomendaciones', v.recomendaciones) +
        area('restr', 'Restricciones laborales', v.restricciones),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            try {
              await API.medico.guardarVigilancia(empId, {
                programa: $('#programa', b).value.trim(), periodicidad: $('#periodicidad', b).value,
                proximaValoracion: $('#proxVal', b).value, recomendaciones: $('#recom', b).value.trim(),
                restricciones: $('#restr', b).value.trim()
              });
              cerrarModal(); toast('Programa actualizado.', 'ok');
              tabExp = 'vig'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupCaso(empId) {
    modal({
      titulo: 'Caso en seguimiento',
      cuerpo: txtF('tema', 'Tema del caso') +
        '<div class="field"><label for="estadoCaso">Estado</label><select id="estadoCaso"><option value="abierto">Abierto</option><option value="cerrado">Cerrado</option></select></div>' +
        area('notaCaso', 'Nota', ''),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async (b) => {
            const t = $('#tema', b).value.trim();
            if (!t) return toast('Escribe el tema del caso.', 'wa');
            try {
              await API.medico.guardarCaso(empId, { tema: t, estado: $('#estadoCaso', b).value, nota: $('#notaCaso', b).value.trim() });
              cerrarModal(); toast('Caso registrado.', 'ok');
              tabExp = 'vig'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupVacuna(empId) {
    modal({
      titulo: 'Registrar aplicación · ' + empDe(empId).nombre,
      cuerpo:
        '<div class="frow">' +
          selc('biologico', 'Biológico', CAT.biologicos.map(b2 => [b2, b2])) +
          selc('dosisV', 'Dosis', CAT.dosis.map(b2 => [b2, b2])) +
          txt('fechaV', 'Fecha de aplicación', hoyISO(), 'date') +
          txt('campanaV', 'Campaña', '') +
          txt('proximaV', 'Próxima dosis (si aplica)', '', 'date') +
        '</div>' + area('obsV', 'Observaciones', ''),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Registrar', accion: async (b) => {
            try {
              await API.medico.guardarVacuna({
                empleado: empId, biologico: $('#biologico', b).value, dosis: $('#dosisV', b).value,
                fecha: $('#fechaV', b).value, campana: $('#campanaV', b).value.trim(),
                proximaDosis: $('#proximaV', b).value, aplicadaPor: sesion.id,
                observaciones: $('#obsV', b).value.trim()
              });
              cerrarModal(); toast('Aplicación registrada.', 'ok');
              tabExp = 'vac'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function popupProgramar(empId) {
    modal({
      titulo: 'Programar evaluación · ' + empDe(empId).nombre,
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">Una evaluación programada es el denominador del ' +
        'indicador de cumplimiento. Se marca como realizada automáticamente al registrar la evaluación correspondiente.</p>' +
        '<div class="frow">' +
          selc('tipoP', 'Tipo de evaluación', CAT.tiposEvaluacion.map(t => [t.c, t.n])) +
          txt('fechaP', 'Fecha programada', sumaDias(hoyISO(), 30), 'date') +
          txt('programaP', 'Programa de vigilancia', '') +
        '</div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Programar', accion: async (b) => {
            try {
              await API.medico.programar({
                empleado: empId, tipo: $('#tipoP', b).value,
                programada: $('#fechaP', b).value, programa: $('#programaP', b).value.trim()
              });
              cerrarModal(); toast('Evaluación programada.', 'ok');
              tabExp = 'eval'; await volverExpediente(empId);
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ===========================================================
     VISTAS GLOBALES NUEVAS
     =========================================================== */
  let fEstadoP = '';
  function programaGlobal() {
    const lista = D.programa.filter(p => !fEstadoP || p.estado === fEstadoP)
      .sort((a, b) => a.programada.localeCompare(b.programada));
    const realizadas = D.programa.filter(p => p.estado === 'realizada').length;
    const cumpl = D.programa.length ? Math.round(realizadas / D.programa.length * 100) : 0;
    const cols = [
      { t: 'Folio', k: 'id' }, { t: 'Colaborador', v: p => nombreDe(p.empleado) },
      { t: 'Departamento', v: p => empDe(p.empleado).departamento },
      { t: 'Tipo', v: p => nombreCat(CAT.tiposEvaluacion, p.tipo) },
      { t: 'Programa', k: 'programa' }, { t: 'Fecha programada', v: p => fmt(p.programada) },
      { t: 'Estado', k: 'estado' }
    ];
    main.innerHTML =
      cab('Programa de exámenes médicos', 'Evaluaciones programadas contra realizadas',
          '<button class="btn gh" id="csv">⬇ CSV</button>') +
            '<div class="filters" style="margin-top:14px"><div class="field"><label>Estado</label><select id="fe">' +
        opts([['', 'Todos'], ['programada', 'Programadas'], ['realizada', 'Realizadas'], ['vencida', 'Vencidas']], fEstadoP) +
      '</select></div></div>' +
      tabla(cols.slice(0, 6).concat([
        { t: 'Estado', html: p => '<span class="chip ' + (p.estado === 'realizada' ? 'ok' : p.estado === 'vencida' ? 'no' : 'wa') + '">' + esc(p.estado) + '</span>' },
        { t: '', html: p => '<button class="btn sm" data-abrir="' + esc(p.empleado) + '">Expediente</button>' }
      ]), lista, { vacio: 'Sin evaluaciones en el programa.' });

    ZX.pie(main, 'Este programa es el denominador de los indicadores "cumplimiento de evaluaciones médicas" y "cumplimiento de exámenes periódicos" del Entregable 2.' + NOTA_IND);
    $('#fe').addEventListener('change', e => { fEstadoP = e.target.value; programaGlobal(); });
    $('#csv').addEventListener('click', () => descargarCSV('Programa_Examenes_' + hoyISO() + '.csv', cols, lista));
    $$('[data-abrir]').forEach(b => b.addEventListener('click', () => { tabExp = 'eval'; verExpediente(b.dataset.abrir, true); }));
  }

  function campanasGlobal() {
    const vencidas = D.vacunas.filter(v => v.proximaDosis && v.proximaDosis <= hoyISO());
    const porBiologico = {};
    D.vacunas.forEach(v => { porBiologico[v.biologico] = (porBiologico[v.biologico] || 0) + 1; });
    const max = Math.max(1, ...Object.values(porBiologico));

    main.innerHTML =
      cab('Campañas y vacunación', 'Programa preventivo del servicio médico',
          '<button class="btn" id="nuevaC">＋ Nueva campaña</button>') +
            '<h2 class="sec-t">Campañas</h2>' +
      tabla([
        { t: 'Campaña', k: 'nombre' }, { t: 'Tipo', k: 'tipo' },
        { t: 'Periodo', v: c => fmt(c.inicio) + ' → ' + fmt(c.fin) },
        { t: 'Población objetivo', k: 'objetivo' }, { t: 'Aplicadas', k: 'aplicadas' },
        { t: 'Estado', html: c => '<span class="chip ' + (c.estado === 'concluida' ? 'ok' : c.estado === 'en_curso' ? 'in' : 'nt') + '">' +
            esc(nombreCat(CAT.estadosCampana, c.estado)) + '</span>' }
      ], D.campanas, { vacio: 'Sin campañas registradas.' }) +
      '<h2 class="sec-t">Aplicaciones por biológico</h2>' +
      '<div class="card">' + Object.keys(porBiologico).map(b2 =>
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:230px;font-size:12.5px;color:var(--tx2)">' + esc(b2) + '</div>' +
          '<div style="flex:1;background:var(--c2);border-radius:6px;height:20px;overflow:hidden">' +
            '<div style="width:' + (porBiologico[b2] / max * 100) + '%;height:100%;background:var(--zx-ac)"></div></div>' +
          '<b style="width:28px;text-align:right;font-size:13px">' + porBiologico[b2] + '</b></div>').join('') +
        (Object.keys(porBiologico).length ? '' : '<div class="empty">Sin aplicaciones registradas.</div>') + '</div>' +
      '<h2 class="sec-t">Dosis pendientes</h2>' +
      tabla([
        { t: 'Colaborador', v: v => nombreDe(v.empleado) }, { t: 'Departamento', v: v => empDe(v.empleado).departamento },
        { t: 'Biológico', k: 'biologico' }, { t: 'Última dosis', v: v => v.dosis + ' · ' + fmt(v.fecha) },
        { t: 'Vencida desde', v: v => fmt(v.proximaDosis) },
        { t: '', html: v => '<button class="btn sm" data-abrir="' + esc(v.empleado) + '">Expediente</button>' }
      ], vencidas, { vacio: 'Ningún esquema vencido.' });

    ZX.pie(main, 'La cobertura considera colaboradores con al menos una aplicación registrada en el portal; no incluye vacunación aplicada fuera de la empresa que no se haya reportado.' + NOTA_IND);
    $('#nuevaC').addEventListener('click', popupCampana);
    $$('[data-abrir]').forEach(b => b.addEventListener('click', () => { tabExp = 'vac'; verExpediente(b.dataset.abrir, true); }));
  }

  function popupCampana() {
    modal({
      titulo: 'Nueva campaña preventiva',
      cuerpo:
        '<div class="frow">' +
          txt('nomC', 'Nombre de la campaña', '') +
          selc('tipoC', 'Tipo', CAT.tiposCampana.map(t => [t, t])) +
          txt('iniC', 'Inicio', hoyISO(), 'date') + txt('finC', 'Fin', sumaDias(hoyISO(), 30), 'date') +
        '</div>' + txtF('objC', 'Población objetivo'),
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Crear', accion: async (b) => {
            const n = $('#nomC', b).value.trim();
            if (!n) return toast('Escribe el nombre de la campaña.', 'wa');
            try {
              await API.medico.guardarCampana({
                nombre: n, tipo: $('#tipoC', b).value, inicio: $('#iniC', b).value,
                fin: $('#finC', b).value, objetivo: $('#objC', b).value.trim(), estado: 'planeada'
              });
              cerrarModal(); toast('Campaña creada.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  function altasGlobal() {
    const filas = D.emps.map(e => {
      const x = D.expedientes.find(v => v.empleado === e.id) || { estado: 'sin_iniciar', alta: '', baja: '', conservarHasta: '' };
      return Object.assign({}, x, { id: e.id, nombre: e.nombre, departamento: e.departamento, puesto: e.puesto, ingreso: e.ingreso, estatusEmp: e.estatus });
    });
    main.innerHTML =
      cab('Alta y baja de expedientes', 'Etapas 1 y 9 del flujo: RH activa el expediente al ingreso y lo cierra al término de la relación laboral') +
      ZX.notaConservacion() +
      '<div class="grid g4">' +
        k('Activos', filas.filter(f => f.estado === 'activo').length, 'Expedientes en uso', 'gn') +
        k('Sin iniciar', filas.filter(f => f.estado === 'sin_iniciar').length, 'Pendientes de activar',
          filas.filter(f => f.estado === 'sin_iniciar').length ? 'wn' : 'gn') +
        k('En baja', filas.filter(f => f.estado === 'baja').length, 'En resguardo') +
        k('Colaboradores', D.emps.length, 'En el registro de personal') +
      '</div>' +
      '<div style="height:14px"></div>' +
      tabla([
        { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Departamento', k: 'departamento' },
        { t: 'Ingreso', v: f => fmt(f.ingreso) },
        { t: 'Expediente', html: f => chipExpediente(f) },
        { t: 'Alta', v: f => f.alta ? fmt(f.alta) : '—' },
        { t: 'Baja', v: f => f.baja ? fmt(f.baja) : '—' },
        { t: 'Conservar hasta', v: f => f.conservarHasta ? fmt(f.conservarHasta) : '—' },
        { t: '', html: f => f.estado === 'activo'
            ? '<button class="btn gh sm" data-baja="' + esc(f.id) + '">Dar de baja</button>'
            : f.estado === 'sin_iniciar' ? '<button class="btn sm" data-alta="' + esc(f.id) + '">Activar</button>' : '' }
      ], filas, { vacio: 'Sin colaboradores.' });

    ZX.pie(main, 'Dar de baja no borra el expediente: cambia su estatus, lo bloquea para captura y calcula la fecha de conservación propuesta. La depuración definitiva requiere la política documental que fijen Salud Ocupacional y Jurídico.');
    $$('[data-alta]').forEach(b => b.addEventListener('click', async () => {
      try { await API.medico.activarExpediente(b.dataset.alta, sesion.id); toast('Expediente activado.', 'ok'); await refrescar(); }
      catch (e) { toast(e.message, 'no'); }
    }));
    $$('[data-baja]').forEach(b => b.addEventListener('click', () => popupBaja(b.dataset.baja)));
  }

  function popupBaja(empId) {
    const cinco = ZX.sumaDias(hoyISO(), 365 * 5);
    modal({
      titulo: 'Dar de baja el expediente · ' + empDe(empId).nombre,
      cuerpo: ZX.notaConservacion() +
        '<div class="frow">' +
          selc('motivoB', 'Motivo de la baja', CAT.motivosBajaExp.map(m => [m, m])) +
          txt('conservar', 'Conservar el expediente hasta', cinco, 'date') +
        '</div>' +
        '<p class="hint" style="font-size:11px;color:var(--tx3)">La fecha propuesta aplica el plazo mayor (5 años del expediente clínico ' +
        'contados desde hoy). Ajústala cuando exista una política documental aprobada.</p>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Dar de baja', clase: 'no', accion: async (b) => {
            try {
              await API.medico.darBajaExpediente(empId, sesion.id, $('#motivoB', b).value, $('#conservar', b).value);
              cerrarModal(); toast('Expediente en estatus de baja.', 'ok'); await refrescar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
  }

  /* ========================= helpers ========================= */
  function interpIMC(i) { return i < 18.5 ? 'Bajo peso' : i < 25 ? 'Peso normal' : i < 30 ? 'Sobrepeso' : 'Obesidad'; }
  function nombreCat(cat, c) { const x = cat.find(v => v.c === c); return x ? x.n : (c || '—'); }
  function desc(campo) { return (a, b) => String(b[campo]).localeCompare(String(a[campo])); }
  /* ===========================================================
     CITAS — antes eran un módulo aparte; ahora viven aquí.
     Todos: Mis citas y el formulario para agendar (popup).
     Servicio médico: además, la agenda del día y de la semana.
     =========================================================== */
  function misCitas() {
    const c = D.citas.filter(x => x.empleado === sesion.id).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
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

    $('#nueva').addEventListener('click', ZX.formularios.cita);
    $$('[data-cancel]').forEach(b => b.addEventListener('click', () => {
      confirmar('Cancelar cita', '¿Seguro que quieres cancelar la cita ' + b.dataset.cancel + '? El horario quedará libre para alguien más.', async () => {
        try { await API.citas.cancelar(b.dataset.cancel, 'Cancelada por el colaborador'); toast('Cita cancelada.', 'ok'); await refrescar(); }
        catch (e) { toast(e.message, 'no'); }
      });
    }));
  }

  /* Agenda del servicio médico: citas del día y de los próximos 7 días */
  let diaAgenda = null;
  function agendaMedico() {
    if (!diaAgenda) diaAgenda = hoyISO();
    const dia = D.citas.filter(c => c.fecha === diaAgenda && c.estado !== 'cancelada').sort((a, b) => a.hora.localeCompare(b.hora));
    const semana = D.citas.filter(c => c.fecha >= hoyISO() && c.fecha <= sumaDias(hoyISO(), 6) && c.estado === 'confirmada');
    const cap = D.agenda.horarios.length;

    main.innerHTML =
      cab('Agenda del médico', fmtLargo(diaAgenda),
        '<div class="btn-row"><button class="btn gh sm" id="a">‹ Día anterior</button>' +
        '<button class="btn gh sm" id="h">Hoy</button><button class="btn gh sm" id="s">Día siguiente ›</button></div>') +
      '<div class="grid g4">' +
        k('Citas del día', dia.length, 'Confirmadas y atendidas') +
        k('Próximos 7 días', semana.length, 'Citas confirmadas') +
        k('Horarios del día', cap, 'Capacidad instalada') +
        k('Ocupación', cap ? Math.round(dia.length / cap * 100) + '%' : '—', 'Del día seleccionado', cap && (dia.length / cap) > 0.8 ? 'dn' : 'gn') +
      '</div>' +
      '<h2 class="sec-t">Citas del día</h2>' +
      tabla([
        { t: 'Hora', k: 'hora' },
        { t: 'Colaborador', v: c => nombreDe(c.empleado) },
        { t: 'Departamento', v: c => empDe(c.empleado).departamento || '' },
        { t: 'Motivo', k: 'motivo' },
        { t: 'Estado', html: c => chip(c.estado) },
        { t: '', html: c => c.estado === 'confirmada'
            ? '<button class="btn ac sm" data-con="' + esc(c.empleado) + '">Registrar consulta</button>' : '' }
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
    $$('[data-con]').forEach(b => b.addEventListener('click', () => popupConsulta(b.dataset.con, { volver: true })));
  }

  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
  function k(l, v, d2, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) +
           '</div><div class="kpi-d">' + esc(d2) + '</div></div>';
  }
  function mini(l, v) {
    return '<div style="background:var(--c1);border:1px solid var(--bd);border-radius:9px;padding:9px 11px">' +
           '<div class="kpi-l">' + esc(l) + '</div><div style="font-size:15px;font-weight:700">' + esc(v) + '</div></div>';
  }
  function ro(l, v, id) {
    return '<div class="field"><label>' + esc(l) + '</label>' +
           '<div' + (id ? ' id="' + id + '"' : '') + ' style="font-size:13px;font-weight:600;padding:6px 0;word-break:break-word">' +
           esc(v === 0 ? '0' : (v || '—')) + '</div></div>';
  }
  function txt(id, l, v, tipo, max) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<input id="' + esc(id) + '" type="' + (tipo || 'text') + '" maxlength="' + (max || 120) + '" value="' + esc(v == null ? '' : v) + '"></div>';
  }
  function txtF(id, l) { return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><input id="' + esc(id) + '" maxlength="200"></div>'; }
  function area(id, l, v, ph) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label>' +
           '<textarea id="' + esc(id) + '" maxlength="600" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea></div>';
  }
  function sel(id, l, opciones, v) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><select id="' + esc(id) + '">' +
      opciones.map(o => '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o || '— Selecciona —') + '</option>').join('') +
      '</select></div>';
  }
  function selc(id, l, pares, v) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(l) + '</label><select id="' + esc(id) + '">' +
      pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(v) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
      '</select></div>';
  }
  function opts(pares, selv) {
    return pares.map(p => '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(selv) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('');
  }
  function multi(name, l, opciones, vals) {
    const v = vals || [];
    return '<div class="field"><label>' + esc(l) + '</label><div class="frow" style="gap:4px 13px">' +
      opciones.map(o => '<label class="chk"><input type="checkbox" data-g="' + esc(name) + '" value="' + esc(o) + '"' +
        (v.indexOf(o) >= 0 ? ' checked' : '') + '><span>' + esc(o) + '</span></label>').join('') + '</div></div>';
  }
  const val = id => { const e = $('#' + id); return e ? e.value.trim() : ''; };
  const chks = g => $$('[data-g="' + g + '"]:checked').map(c => c.value);
})();

/* ============================================================
   Portal Zubex — Capa de acceso a datos (API)
   ------------------------------------------------------------
   Único punto del frontend que sabe de dónde vienen los datos.
   Hoy funciona en MODO DEMO (datos ficticios en memoria +
   localStorage). Para conectar el backend real:

     1. Cambiar ZX_API.config.modo = 'rest'
     2. Definir ZX_API.config.base = 'https://.../api'
     3. Borrar data.demo.js del HTML

   Todas las funciones son async y devuelven Promesas, por lo que
   la interfaz no cambia al migrar a servidor.

   ⚠ SEGURIDAD: las validaciones de permiso de este archivo son
   de UX. La autorización REAL debe hacerla el servidor en cada
   endpoint. Nunca confiar en el cliente.
   ============================================================ */
(function (global) {
  'use strict';

  const config = {
    modo: 'demo',              // 'demo' | 'rest'
    base: '/api',
    /* La versión del almacén cambia cuando cambia la forma de los datos.
       Al subirla, los navegadores que tengan datos de una versión anterior
       arrancan con la semilla nueva en lugar de quedarse con un almacén
       incompleto (usuarios o colecciones que aún no existían). */
    storageKey: 'zx_portal_demo_v4',
    sesionKey: 'zx_portal_sesion'
  };

  /* ---------------- Almacén demo ---------------- */
  let store = null;

  function semilla() {
    const D = global.ZX_DEMO;
    return {
      empleados: clonar(D.EMPLEADOS),
      credenciales: clonar(D.CREDENCIALES),
      solicitudes: clonar(D.SOLICITUDES),
      banco: clonar(D.BANCO_HORAS),
      cuestionarios: clonar(D.CUESTIONARIOS),
      consultas: clonar(D.CONSULTAS),
      agenda: clonar(D.AGENDA_MEDICO),
      citas: clonar(D.CITAS),
      movimientos: clonar(D.MOVIMIENTOS),
      expedientes: clonar(D.EXPEDIENTES),
      evaluaciones: clonar(D.EVALUACIONES),
      riesgos: clonar(D.RIESGOS),
      incapacidades: clonar(D.INCAPACIDADES),
      docsMedicos: clonar(D.DOCS_MEDICOS),
      vigilancia: clonar(D.VIGILANCIA),
      expedientesMed: clonar(D.EXPEDIENTES_MED),
      programaEval: clonar(D.PROGRAMA_EVAL),
      vacunas: clonar(D.VACUNAS),
      campanas: clonar(D.CAMPANAS),
      bitacora: clonar(D.BITACORA),
      programacionAnalisis: clonar(D.PROGRAMACION_ANALISIS),
      resultados: clonar(D.RESULTADOS_ANALISIS),
      casos: clonar(D.CASOS_ANALISIS),
      consentimientos: clonar(D.CONSENTIMIENTOS),
      solicitudesArco: clonar(D.SOLICITUDES_ARCO),
      perfiles: clonar(D.PERFILES)
    };
  }

  const clonar = (o) => JSON.parse(JSON.stringify(o));

  function cargar() {
    if (store) return store;
    try {
      const raw = localStorage.getItem(config.storageKey);
      store = raw ? JSON.parse(raw) : semilla();
    } catch (e) { store = semilla(); }

    /* Autorreparación: si el almacén guardado no trae alguna colección
       (porque se guardó con una versión anterior del portal), se rellena
       con la semilla en vez de dejar que la app falle al leerla.
       Limpiar los datos del navegador nunca debería ser un requisito. */
    const base = semilla();
    let reparado = false;
    Object.keys(base).forEach(k => {
      const v = store[k];
      const faltante = v === undefined || v === null ||
        (Array.isArray(base[k]) && (!Array.isArray(v) || v.length === 0));
      if (faltante) { store[k] = base[k]; reparado = true; }
    });
    /* Usuarios nuevos de la semilla que no existan en el almacén guardado */
    if (Array.isArray(store.empleados)) {
      base.empleados.forEach(e => {
        if (!store.empleados.some(x => x.id === e.id)) { store.empleados.push(e); reparado = true; }
      });
    }
    if (reparado) guardar();
    return store;
  }

  function guardar() {
    try { localStorage.setItem(config.storageKey, JSON.stringify(store)); }
    catch (e) { /* modo privado: los cambios sólo viven en memoria */ }
  }

  function reiniciar() {
    store = semilla();
    guardar();
  }

  /* Simula latencia de red para que la UI se pruebe con estados de carga */
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  async function demo(fn, ms) {
    await espera(ms == null ? 90 : ms);
    const r = fn(cargar());
    guardar();
    return clonar(r === undefined ? null : r);
  }

  async function rest(ruta, opts) {
    const res = await fetch(config.base + ruta, Object.assign({
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin'
    }, opts || {}));
    if (!res.ok) throw new Error('Error ' + res.status + ' en ' + ruta);
    return res.status === 204 ? null : res.json();
  }

  const esDemo = () => config.modo === 'demo';
  const nuevoId = (pre) => pre + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();

  /* ---------------- Bitácora de auditoría ----------------
     ⚠ En producción la bitácora la escribe el SERVIDOR dentro de la misma
     transacción de cada operación. Un registro escrito por el cliente no
     tiene valor probatorio: puede omitirse o falsificarse desde el navegador.
     Esta implementación existe sólo para que la pantalla de auditoría
     muestre movimientos reales durante la demostración. */
  function bitacora(accion, entidad, afectado, detalle) {
    if (!esDemo()) return;
    const s = cargar();
    const u = sesionActual();
    const ahora = new Date();
    s.bitacora.push({
      id: nuevoId('LG'),
      fecha: ahora.toISOString().slice(0, 10) + ' ' + ahora.toTimeString().slice(0, 5),
      usuario: u ? u.id : 'anónimo',
      accion: accion, entidad: entidad || '', afectado: afectado || '', detalle: detalle || ''
    });
    if (s.bitacora.length > 500) s.bitacora = s.bitacora.slice(-500);
    guardar();
  }

  /* ---------------- Sesión ---------------- */
  /* En producción esto lo sustituye un token httpOnly emitido por el
     servidor (o SSO de Microsoft Entra ID, que ya usa Zubex con PowerApps). */
  function sesionActual() {
    try {
      const raw = sessionStorage.getItem(config.sesionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function cerrarSesion() {
    try { sessionStorage.removeItem(config.sesionKey); } catch (e) {}
  }

  async function login(usuario, password) {
    if (!esDemo()) {
      const r = await rest('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
      sessionStorage.setItem(config.sesionKey, JSON.stringify(r.usuario));
      return r.usuario;
    }
    await espera(280);
    const u = String(usuario || '').trim().toUpperCase();
    const emp = cargar().empleados.find(e => e.id.toUpperCase() === u || e.correo.toLowerCase() === String(usuario).trim().toLowerCase());
    const cred = (cargar().credenciales || []).find(c => emp && c.id === emp.id);
    if (!emp || !cred || cred.hash !== 'demo::' + String(password || '')) {
      throw new Error('Usuario o contraseña incorrectos.');
    }
    if (emp.estatus === 'baja') {
      throw new Error('Este acceso está suspendido. Contacta a Recursos Humanos si crees que es un error.');
    }
    const sesion = {
      id: emp.id, nombre: emp.nombre, correo: emp.correo, depto: emp.depto,
      puesto: emp.puesto, nivel: emp.nivel, perfil: emp.perfil, inicio: new Date().toISOString()
    };
    sessionStorage.setItem(config.sesionKey, JSON.stringify(sesion));
    return sesion;
  }

  /* ---------------- Empleados ---------------- */
  const empleados = {
    lista: () => esDemo() ? demo(s => s.empleados) : rest('/empleados'),
    uno: (id) => esDemo() ? demo(s => s.empleados.find(e => e.id === id) || null) : rest('/empleados/' + id),
    equipo: (jefeId) => esDemo() ? demo(s => s.empleados.filter(e => e.jefe === jefeId)) : rest('/empleados?jefe=' + encodeURIComponent(jefeId)),
    actualizar: (id, campos) => esDemo() ? demo(s => {
      const e = s.empleados.find(x => x.id === id);
      if (!e) throw new Error('Empleado no encontrado');
      Object.assign(e, campos);
      return e;
    }) : rest('/empleados/' + id, { method: 'PATCH', body: JSON.stringify(campos) }),

    /* Sincronización desde IBIX (o cualquier maestro externo). `filas` ya
       viene mapeada a { id, nombre, correo, depto, area, turno, puesto,
       jefe, ingreso, estatus } — el mapeo de encabezados del CSV real lo
       hace la pantalla (page-rrhh.js), porque cada exportación nombra sus
       columnas distinto. Esta función NUNCA toca nivel ni perfil: esos
       campos no existen en IBIX y se asignan a mano en el portal. Un
       empleado nuevo entra con nivel 'empleado' y perfil 'ninguno' — el
       mínimo acceso posible — y con una contraseña temporal, igual que
       hacía el cargador de Medico ZX. */
    sincronizarIBIX: (filas, quien) => esDemo() ? demo(s => {
      const resumen = { nuevos: [], actualizados: [], sinCambios: 0, suspendidos: [], errores: [], credenciales: [] };
      const CAMPOS = ['nombre', 'correo', 'depto', 'area', 'turno', 'puesto', 'jefe', 'ingreso', 'estatus'];

      /* Seguro contra archivos incompletos: si el CSV trae menos del 90% de
         quienes hoy están activos, NO se toca nada. Sin esto, un archivo
         roto o a medio exportar suspendería a casi toda la planta por
         accidente — es el mismo tipo de candado que ya se documentó para
         Medico ZX con fechas ambiguas: negarse en vez de adivinar. */
      const activosAntes = s.empleados.filter(e => e.estatus !== 'baja');
      const idsEnArchivo = new Set(filas.map(f => String(f.id || '').trim().toUpperCase()).filter(Boolean));
      if (activosAntes.length > 0 && idsEnArchivo.size < activosAntes.length * 0.9) {
        throw new Error('El archivo trae ' + idsEnArchivo.size + ' de ' + activosAntes.length +
          ' personas activas (menos del 90%). No se aplicó ningún cambio — revisa el archivo antes de reintentar.');
      }

      filas.forEach((f, idx) => {
        const id = String(f.id || '').trim().toUpperCase();
        if (!id) { resumen.errores.push('Fila ' + (idx + 2) + ': sin número de nómina.'); return; }
        if (!f.nombre) { resumen.errores.push('Fila ' + (idx + 2) + ' (' + id + '): sin nombre.'); return; }

        const campos = {};
        CAMPOS.forEach(c => { if (f[c] !== undefined && f[c] !== '') campos[c] = f[c]; });
        if (campos.estatus) {
          const v = String(campos.estatus).toLowerCase();
          campos.estatus = (v.indexOf('baja') >= 0 || v.indexOf('inactiv') >= 0 || v === '0' || v === 'no') ? 'baja' : 'activo';
        }

        let e = s.empleados.find(x => x.id.toUpperCase() === id);
        if (!e) {
          e = Object.assign({
            id, nivel: 'empleado', perfil: 'ninguno', correo: '', depto: '', area: '', turno: '',
            puesto: '', jefe: null, ingreso: new Date().toISOString().slice(0, 10), estatus: 'activo', genero: '', nacimiento: '',
            dias: 0, diasPend: 0, pendActivos: false, horas: 0, horasDeber: 0
          }, campos);
          s.empleados.push(e);
          const temp = 'zx' + Math.random().toString(36).slice(2, 8);
          s.credenciales = s.credenciales || [];
          s.credenciales.push({ id, hash: 'demo::' + temp });
          resumen.nuevos.push(e.nombre + ' (' + id + ')');
          resumen.credenciales.push({ id, nombre: e.nombre, temporal: temp });
          bitacora('ibix.alta', id, id, 'Alta automática desde IBIX — nivel y perfil por asignar en Administración');
        } else {
          const huboCambio = Object.keys(campos).some(k => String(e[k] || '') !== String(campos[k] || ''));
          if (huboCambio) {
            Object.assign(e, campos);
            resumen.actualizados.push(e.nombre + ' (' + id + ')');
            bitacora('ibix.actualizar', id, id, 'Sincronizado desde IBIX');
          } else {
            resumen.sinCambios++;
          }
        }
      });

      /* Suspensión automática: quien seguía activo aquí y ya no aparece en
         el archivo (IBIX sólo entrega activos, según el script del usuario).
         Nunca se elimina — se suspende, igual que el botón manual de
         Administración: conserva expediente e historial, sólo cierra el
         acceso (ver login(), que ya revisa estatus === 'baja'). */
      s.empleados.forEach(e => {
        if (e.estatus !== 'baja' && !idsEnArchivo.has(e.id.toUpperCase())) {
          e.estatus = 'baja';
          resumen.suspendidos.push(e.nombre + ' (' + e.id + ')');
          bitacora('ibix.suspension_automatica', e.id, e.id, 'Ya no aparece en el archivo de IBIX — se suspendió el acceso, el expediente se conserva');
        }
      });

      return resumen;
    }) : rest('/empleados/sincronizar-ibix', { method: 'POST', body: JSON.stringify({ filas }) })
  };

  /* ---------------- Vacaciones y banco de horas ---------------- */
  const vacaciones = {
    solicitudes: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.solicitudes, filtro)) : rest('/vacaciones' + qs(filtro)),
    banco: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.banco, filtro)) : rest('/banco-horas' + qs(filtro)),

    solicitar: (datos) => esDemo() ? demo(s => {
      const emp = s.empleados.find(e => e.id === datos.empleado);
      if (!emp) throw new Error('Empleado no encontrado');
      const disp = emp.dias + (emp.pendActivos ? emp.diasPend : 0);
      if (datos.dias > disp) throw new Error('Los días solicitados (' + datos.dias + ') exceden tus días disponibles (' + disp + ').');
      const choque = s.solicitudes.some(x => x.empleado === datos.empleado && x.estado !== 'rechazada' &&
        !(datos.fin < x.inicio || datos.inicio > x.fin));
      if (choque) throw new Error('Ya tienes una solicitud registrada que se traslapa con esas fechas.');
      const nueva = Object.assign({
        id: nuevoId('V'), tipo: 'vacaciones', estado: 'pendiente', resolucion: '',
        aprobador: emp.jefe, creada: new Date().toISOString().slice(0, 10)
      }, datos);
      s.solicitudes.push(nueva);
      emp.dias -= datos.dias;           // se reserva el saldo al enviar
      return nueva;
    }) : rest('/vacaciones', { method: 'POST', body: JSON.stringify(datos) }),

    solicitarBanco: (datos) => esDemo() ? demo(s => {
      const emp = s.empleados.find(e => e.id === datos.empleado);
      if (!emp) throw new Error('Empleado no encontrado');
      if (datos.horas > emp.horas) throw new Error('Las horas solicitadas exceden tu banco disponible (' + emp.horas + ' h).');
      const nueva = Object.assign({
        id: nuevoId('B'), tipo: 'banco', estado: 'pendiente', resolucion: '',
        aprobador: emp.jefe, creada: new Date().toISOString().slice(0, 10)
      }, datos);
      s.banco.push(nueva);
      emp.horas -= datos.horas;
      return nueva;
    }) : rest('/banco-horas', { method: 'POST', body: JSON.stringify(datos) }),

    resolver: (id, tipo, estado, nota) => esDemo() ? demo(s => {
      const col = tipo === 'banco' ? s.banco : s.solicitudes;
      const r = col.find(x => x.id === id);
      if (!r) throw new Error('Solicitud no encontrada');
      if (r.estado !== 'pendiente') throw new Error('Esta solicitud ya fue resuelta.');
      r.estado = estado;
      r.resolucion = nota || '';
      r.resuelta = new Date().toISOString().slice(0, 10);
      if (estado === 'rechazada') {   // devolver saldo reservado
        const emp = s.empleados.find(e => e.id === r.empleado);
        if (emp) { if (tipo === 'banco') emp.horas += r.horas; else emp.dias += r.dias; }
      }
      return r;
    }) : rest('/' + (tipo === 'banco' ? 'banco-horas' : 'vacaciones') + '/' + id, {
      method: 'PATCH', body: JSON.stringify({ estado, nota })
    })
  };

  /* ---------------- Módulo médico ---------------- */
  const medico = {
    cuestionario: (empleadoId) => esDemo()
      ? demo(s => s.cuestionarios.find(c => c.empleado === empleadoId) || null)
      : rest('/medico/cuestionario/' + empleadoId),

    /* Candado de consentimiento (aprendido en Medico ZX, donde vive como
       disparador de PostgreSQL): sin consentimiento vigente no se puede
       capturar ni actualizar la historia clínica. Esta validación es de UX
       —igual que el resto del archivo— y debe repetirse en el servidor. */
    guardarCuestionario: (empleadoId, datos) => esDemo() ? demo(s => {
      const cons = s.consentimientos.find(c => c.empleado === empleadoId && c.vigente);
      if (!cons) throw new Error('Debes otorgar tu consentimiento en Aviso de privacidad antes de capturar tu historia clínica.');
      const i = s.cuestionarios.findIndex(c => c.empleado === empleadoId);
      const reg = Object.assign({ empleado: empleadoId }, datos, { actualizado: new Date().toISOString().slice(0, 10) });
      if (i >= 0) s.cuestionarios[i] = reg; else s.cuestionarios.push(reg);
      bitacora('cuestionario.guardar', empleadoId, empleadoId, 'Actualización de historia clínica');
      return reg;
    }) : rest('/medico/cuestionario/' + empleadoId, { method: 'PUT', body: JSON.stringify(datos) }),

    consultas: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.consultas.filter(c => c.empleado === empleadoId) : s.consultas)
      : rest('/medico/consultas' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    registrarConsulta: (datos) => esDemo() ? demo(s => {
      const c = Object.assign({ id: nuevoId('C'), fecha: new Date().toISOString().slice(0, 10) }, datos);
      s.consultas.push(c);
      const cita = s.citas.find(a => a.id === datos.citaId);
      if (cita) cita.estado = 'atendida';
      bitacora('consulta.registrar', c.id, datos.empleado, 'Alta de consulta médica');
      return c;
    }) : rest('/medico/consultas', { method: 'POST', body: JSON.stringify(datos) }),

    /* --- 4. Evaluaciones de salud y dictamen de aptitud --- */
    evaluaciones: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.evaluaciones.filter(x => x.empleado === empleadoId) : s.evaluaciones)
      : rest('/medico/evaluaciones' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    guardarEvaluacion: (datos) => esDemo() ? demo(s => {
      const e = Object.assign({ id: nuevoId('EV'), estudios: [] }, datos);
      s.evaluaciones.push(e);
      const pe = s.programaEval.filter(x => x.empleado === datos.empleado && x.tipo === datos.tipo && x.estado !== 'realizada')
        .sort((a, b) => a.programada.localeCompare(b.programada))[0];
      if (pe) { pe.estado = 'realizada'; pe.evaluacion = e.id; pe.realizada = datos.fecha; }
      bitacora('evaluacion.registrar', e.id, datos.empleado, 'Dictamen: ' + datos.dictamen);
      return e;
    }) : rest('/medico/evaluaciones', { method: 'POST', body: JSON.stringify(datos) }),

    /* --- 6. Riesgos de trabajo (accidentes, incidentes, enfermedad de trabajo) --- */
    riesgos: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.riesgos.filter(x => x.empleado === empleadoId) : s.riesgos)
      : rest('/medico/riesgos' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    guardarRiesgo: (datos) => esDemo() ? demo(s => {
      const r = Object.assign({ id: nuevoId('RT'), seguimiento: [], ochoD: {}, reincorporacion: { fecha: '', condiciones: '' } }, datos);
      s.riesgos.push(r);
      bitacora('riesgo.registrar', r.id, datos.empleado, datos.tipo);
      return r;
    }) : rest('/medico/riesgos', { method: 'POST', body: JSON.stringify(datos) }),

    actualizarRiesgo: (id, campos) => esDemo() ? demo(s => {
      const r = s.riesgos.find(x => x.id === id);
      if (!r) throw new Error('Registro no encontrado');
      Object.assign(r, campos);
      return r;
    }) : rest('/medico/riesgos/' + id, { method: 'PATCH', body: JSON.stringify(campos) }),

    agregarSeguimiento: (id, nota) => esDemo() ? demo(s => {
      const r = s.riesgos.find(x => x.id === id);
      if (!r) throw new Error('Registro no encontrado');
      r.seguimiento = r.seguimiento || [];
      r.seguimiento.push({ fecha: new Date().toISOString().slice(0, 10), nota });
      return r;
    }) : rest('/medico/riesgos/' + id + '/seguimiento', { method: 'POST', body: JSON.stringify({ nota }) }),

    /* --- 7. Incapacidades y ausentismo --- */
    incapacidades: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.incapacidades.filter(x => x.empleado === empleadoId) : s.incapacidades)
      : rest('/medico/incapacidades' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    guardarIncapacidad: (datos) => esDemo() ? demo(s => {
      const i = Object.assign({ id: nuevoId('IN'), estado: 'vigente' }, datos);
      s.incapacidades.push(i);
      bitacora('incapacidad.registrar', i.id, datos.empleado, i.dias + ' días · ' + i.tipo);
      return i;
    }) : rest('/medico/incapacidades', { method: 'POST', body: JSON.stringify(datos) }),

    /* --- 8. Documentos y evidencias --- */
    documentos: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.docsMedicos.filter(x => x.empleado === empleadoId) : s.docsMedicos)
      : rest('/medico/documentos?empleado=' + encodeURIComponent(empleadoId || '')),

    guardarDocumento: (datos) => esDemo() ? demo(s => {
      const d2 = Object.assign({ id: nuevoId('DM'), fecha: new Date().toISOString().slice(0, 10), tam: '—' }, datos);
      s.docsMedicos.push(d2);
      bitacora('documento.registrar', d2.id, datos.empleado, datos.tipo);
      return d2;
    }) : rest('/medico/documentos', { method: 'POST', body: JSON.stringify(datos) }),

    /* --- 9. Seguimiento de salud ocupacional --- */
    vigilancia: (empleadoId) => esDemo()
      ? demo(s => s.vigilancia.find(v => v.empleado === empleadoId) ||
          { empleado: empleadoId, programa: '', periodicidad: '', recomendaciones: '', restricciones: '', proximaValoracion: '', casos: [] })
      : rest('/medico/vigilancia/' + empleadoId),

    guardarVigilancia: (empleadoId, datos) => esDemo() ? demo(s => {
      const i = s.vigilancia.findIndex(v => v.empleado === empleadoId);
      const reg = Object.assign({ empleado: empleadoId, casos: [] }, i >= 0 ? s.vigilancia[i] : {}, datos);
      if (i >= 0) s.vigilancia[i] = reg; else s.vigilancia.push(reg);
      return reg;
    }) : rest('/medico/vigilancia/' + empleadoId, { method: 'PUT', body: JSON.stringify(datos) }),

    /* --- Ciclo de vida del expediente (alta / baja) --- */
    expedientes: () => esDemo() ? demo(s => s.expedientesMed) : rest('/medico/expedientes'),

    expediente: (empleadoId) => esDemo()
      ? demo(s => s.expedientesMed.find(x => x.empleado === empleadoId) ||
          { empleado: empleadoId, estado: 'sin_iniciar', alta: '', altaPor: '', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' })
      : rest('/medico/expedientes/' + empleadoId),

    activarExpediente: (empleadoId, quien) => esDemo() ? demo(s => {
      let e = s.expedientesMed.find(x => x.empleado === empleadoId);
      if (e && e.estado === 'activo') throw new Error('El expediente ya está activo.');
      if (!e) { e = { empleado: empleadoId }; s.expedientesMed.push(e); }
      Object.assign(e, {
        estado: 'activo', alta: new Date().toISOString().slice(0, 10), altaPor: quien,
        baja: '', bajaPor: '', motivoBaja: '', conservarHasta: ''
      });
      bitacora('expediente.alta', empleadoId, empleadoId, 'Expediente médico activado');
      return e;
    }) : rest('/medico/expedientes/' + empleadoId + '/alta', { method: 'POST' }),

    darBajaExpediente: (empleadoId, quien, motivo, conservarHasta) => esDemo() ? demo(s => {
      const e = s.expedientesMed.find(x => x.empleado === empleadoId);
      if (!e || e.estado !== 'activo') throw new Error('El expediente no está activo.');
      Object.assign(e, {
        estado: 'baja', baja: new Date().toISOString().slice(0, 10), bajaPor: quien,
        motivoBaja: motivo, conservarHasta: conservarHasta
      });
      const emp = s.empleados.find(x => x.id === empleadoId);
      if (emp) emp.estatus = 'baja';
      bitacora('expediente.baja', empleadoId, empleadoId, 'Baja: ' + motivo + ' · conservar hasta ' + conservarHasta);
      return e;
    }) : rest('/medico/expedientes/' + empleadoId + '/baja', { method: 'POST', body: JSON.stringify({ motivo, conservarHasta }) }),

    /* --- Programa de evaluaciones (programadas vs realizadas) --- */
    programa: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.programaEval.filter(x => x.empleado === empleadoId) : s.programaEval)
      : rest('/medico/programa' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    programar: (datos) => esDemo() ? demo(s => {
      const p = Object.assign({ id: nuevoId('PE'), estado: 'programada', evaluacion: '' }, datos);
      s.programaEval.push(p);
      bitacora('programa.crear', p.id, datos.empleado, datos.tipo + ' · ' + datos.programada);
      return p;
    }) : rest('/medico/programa', { method: 'POST', body: JSON.stringify(datos) }),

    /* --- Vacunación y campañas preventivas --- */
    vacunas: (empleadoId) => esDemo()
      ? demo(s => empleadoId ? s.vacunas.filter(x => x.empleado === empleadoId) : s.vacunas)
      : rest('/medico/vacunas' + (empleadoId ? '?empleado=' + encodeURIComponent(empleadoId) : '')),

    guardarVacuna: (datos) => esDemo() ? demo(s => {
      const v = Object.assign({ id: nuevoId('VA') }, datos);
      s.vacunas.push(v);
      bitacora('vacuna.registrar', v.id, datos.empleado, datos.biologico + ' · ' + datos.dosis);
      return v;
    }) : rest('/medico/vacunas', { method: 'POST', body: JSON.stringify(datos) }),

    campanas: () => esDemo() ? demo(s => s.campanas) : rest('/medico/campanas'),

    guardarCampana: (datos) => esDemo() ? demo(s => {
      const c = Object.assign({ id: nuevoId('CP'), aplicadas: 0 }, datos);
      s.campanas.unshift(c);
      bitacora('campana.crear', c.id, '', datos.nombre);
      return c;
    }) : rest('/medico/campanas', { method: 'POST', body: JSON.stringify(datos) }),

    guardarCaso: (empleadoId, caso) => esDemo() ? demo(s => {
      let v = s.vigilancia.find(x => x.empleado === empleadoId);
      if (!v) { v = { empleado: empleadoId, programa: '', periodicidad: '', recomendaciones: '', restricciones: '', proximaValoracion: '', casos: [] }; s.vigilancia.push(v); }
      v.casos = v.casos || [];
      v.casos.push(Object.assign({ fecha: new Date().toISOString().slice(0, 10), estado: 'abierto' }, caso));
      return v;
    }) : rest('/medico/vigilancia/' + empleadoId + '/casos', { method: 'POST', body: JSON.stringify(caso) })
  };

  /* ---------------- Citas ---------------- */
  const citas = {
    agenda: () => esDemo() ? demo(s => s.agenda) : rest('/citas/agenda'),
    lista: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.citas, filtro)) : rest('/citas' + qs(filtro)),

    disponibilidad: (fecha) => esDemo() ? demo(s => {
      const dia = new Date(fecha + 'T12:00:00').getDay();
      const habil = s.agenda.diasHabiles.indexOf(dia) >= 0;
      const bloqueo = s.agenda.bloqueos.find(b => b.fecha === fecha);
      const ocupadas = s.citas.filter(c => c.fecha === fecha && c.estado !== 'cancelada').map(c => c.hora);
      return {
        fecha, habil, bloqueo: bloqueo ? bloqueo.motivo : null,
        slots: s.agenda.horarios.map(h => ({ hora: h, libre: habil && !bloqueo && ocupadas.indexOf(h) < 0 }))
      };
    }) : rest('/citas/disponibilidad?fecha=' + encodeURIComponent(fecha)),

    agendar: (datos) => esDemo() ? demo(s => {
      const ocupada = s.citas.some(c => c.fecha === datos.fecha && c.hora === datos.hora && c.estado !== 'cancelada');
      if (ocupada) throw new Error('Ese horario acaba de ocuparse. Elige otro.');
      const propia = s.citas.some(c => c.empleado === datos.empleado && c.fecha === datos.fecha && c.estado === 'confirmada');
      if (propia) throw new Error('Ya tienes una cita confirmada ese día.');
      const c = Object.assign({
        id: nuevoId('A'), medico: s.agenda.medico, estado: 'confirmada',
        creada: new Date().toISOString().slice(0, 10)
      }, datos);
      s.citas.push(c);
      return c;
    }) : rest('/citas', { method: 'POST', body: JSON.stringify(datos) }),

    cancelar: (id, motivo) => esDemo() ? demo(s => {
      const c = s.citas.find(x => x.id === id);
      if (!c) throw new Error('Cita no encontrada');
      c.estado = 'cancelada';
      c.motivoCancelacion = motivo || '';
      return c;
    }) : rest('/citas/' + id, { method: 'DELETE', body: JSON.stringify({ motivo }) })
  };

  /* ---------------- RRHH ---------------- */
  const rrhh = {
    movimientos: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.movimientos, filtro)) : rest('/rrhh/movimientos' + qs(filtro)),
    movimiento: (id) => esDemo() ? demo(s => s.movimientos.find(m => m.id === id) || null) : rest('/rrhh/movimientos/' + id),

    crearMovimiento: (datos) => esDemo() ? demo(s => {
      const n = s.movimientos.length + 4;
      const folio = 'RHF34-' + String(n).padStart(4, '0');
      const m = Object.assign({
        id: folio, folio, estado: datos.estado || 'borrador',
        elaboracion: new Date().toISOString().slice(0, 10),
        firmas: global.ZX_DEMO.CAT.firmasRHF34.map(r => ({ rol: r, quien: null, estado: 'pendiente', fecha: '', nota: '' })),
        adjuntos: []
      }, datos);
      s.movimientos.unshift(m);
      return m;
    }) : rest('/rrhh/movimientos', { method: 'POST', body: JSON.stringify(datos) }),

    firmar: (id, rolFirma, quien, decision, nota) => esDemo() ? demo(s => {
      const m = s.movimientos.find(x => x.id === id);
      if (!m) throw new Error('Movimiento no encontrado');
      const f = m.firmas.find(x => x.rol === rolFirma);
      if (!f) throw new Error('Etapa de firma no válida');
      if (f.estado !== 'pendiente') throw new Error('Esa etapa ya fue resuelta.');
      f.estado = decision === 'rechazar' ? 'rechazado' : 'firmado';
      f.quien = quien;
      f.fecha = new Date().toISOString().slice(0, 10);
      f.nota = nota || '';
      if (f.estado === 'rechazado') m.estado = 'rechazado';
      else m.estado = m.firmas.every(x => x.estado === 'firmado') ? 'completado' : 'en_firma';
      bitacora('movimiento.firmar', m.id, m.empleado, rolFirma + ': ' + f.estado);
      return m;
    }) : rest('/rrhh/movimientos/' + id + '/firmas', {
      method: 'POST', body: JSON.stringify({ rol: rolFirma, decision, nota })
    }),

    enviarAFirma: (id) => esDemo() ? demo(s => {
      const m = s.movimientos.find(x => x.id === id);
      if (!m) throw new Error('Movimiento no encontrado');
      m.estado = 'en_firma';
      return m;
    }) : rest('/rrhh/movimientos/' + id + '/enviar', { method: 'POST' }),

    expediente: (empleadoId) => esDemo()
      ? demo(s => s.expedientes.find(x => x.empleado === empleadoId) || { empleado: empleadoId, docs: [] })
      : rest('/rrhh/expedientes/' + empleadoId),

    registrarDoc: (empleadoId, doc) => esDemo() ? demo(s => {
      let ex = s.expedientes.find(x => x.empleado === empleadoId);
      if (!ex) { ex = { empleado: empleadoId, docs: [] }; s.expedientes.push(ex); }
      ex.docs.push(Object.assign({ fecha: new Date().toISOString().slice(0, 10) }, doc));
      return ex;
    }) : rest('/rrhh/expedientes/' + empleadoId + '/documentos', { method: 'POST', body: JSON.stringify(doc) })
  };

  /* ---------------- utilidades ---------------- */
  function aplicaFiltro(arr, filtro) {
    if (!filtro) return arr;
    return arr.filter(x => Object.keys(filtro).every(k => filtro[k] == null || filtro[k] === '' || x[k] === filtro[k]));
  }
  function qs(filtro) {
    if (!filtro) return '';
    const p = Object.keys(filtro).filter(k => filtro[k] != null && filtro[k] !== '')
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(filtro[k]));
    return p.length ? '?' + p.join('&') : '';
  }

  /* ============================================================
     ETAPA 1 — Análisis clínicos (SQF)
     Flujo: programación → resultado → validación → desviación →
     caso de seguimiento → valoración → alta/cierre.
     ============================================================ */
  const analisis = {
    programacion: (filtro) => esDemo()
      ? demo(s => aplicaFiltro(s.programacionAnalisis, filtro))
      : rest('/analisis/programacion' + qs(filtro)),

    programar: (datos) => esDemo() ? demo(s => {
      const p = Object.assign({ id: nuevoId('PA'), estado: 'programado', fechaEvaluacion: '' }, datos);
      s.programacionAnalisis.push(p);
      bitacora('analisis.programar', p.id, datos.empleado, datos.tipoEvaluacion + ' · ' + datos.programada);
      return p;
    }) : rest('/analisis/programacion', { method: 'POST', body: JSON.stringify(datos) }),

    resultados: (filtro) => esDemo()
      ? demo(s => aplicaFiltro(s.resultados, filtro))
      : rest('/analisis/resultados' + qs(filtro)),

    /* Registrar un resultado. Nace SIEMPRE como pendiente de validación:
       quien lo captura no decide si hay desviación; eso lo valida el médico. */
    registrarResultado: (datos) => esDemo() ? demo(s => {
      const r = Object.assign({
        id: nuevoId('RA'), valoracion: 'pendiente_validacion',
        validadoPor: '', fechaValidacion: ''
      }, datos);
      s.resultados.push(r);
      const p = s.programacionAnalisis.find(x => x.id === datos.programacion);
      if (p) { p.estado = 'realizado'; p.fechaEvaluacion = p.fechaEvaluacion || datos.fechaToma; }
      bitacora('analisis.resultado', r.id, datos.empleado, datos.analisis);
      return r;
    }) : rest('/analisis/resultados', { method: 'POST', body: JSON.stringify(datos) }),

    /* Validación médica: marca normal o desviación. Si es desviación,
       abre automáticamente el caso en "Pendiente de valoración". */
    validarResultado: (id, valoracion, quien, nota) => esDemo() ? demo(s => {
      const r = s.resultados.find(x => x.id === id);
      if (!r) throw new Error('Resultado no encontrado');
      if (valoracion !== 'normal' && valoracion !== 'desviacion') throw new Error('Valoración no válida');
      r.valoracion = valoracion;
      r.validadoPor = quien;
      r.fechaValidacion = new Date().toISOString().slice(0, 10);
      r.notaValidacion = nota || '';
      let caso = null;
      if (valoracion === 'desviacion' && !s.casos.some(c => c.resultado === id)) {
        caso = {
          id: nuevoId('CS'), empleado: r.empleado, resultado: r.id,
          fechaDeteccion: r.fechaValidacion,
          motivo: r.analisis + ': ' + r.resultado,
          estatus: 'pendiente_valoracion',
          valoracion: '', fechaCita: '', indicaciones: '', estudiosPosteriores: '',
          proximaValoracion: '', fechaCierre: '', restriccion: '', abiertoPor: quien,
          notas: [{ fecha: r.fechaValidacion, autor: quien, nota: 'Caso abierto automáticamente por desviación validada.' }]
        };
        s.casos.push(caso);
        bitacora('analisis.caso_abierto', caso.id, r.empleado, r.analisis);
      }
      bitacora('analisis.validar', id, r.empleado, valoracion);
      return { resultado: r, caso: caso };
    }) : rest('/analisis/resultados/' + id + '/validacion', {
      method: 'POST', body: JSON.stringify({ valoracion, nota })
    }),

    casos: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.casos, filtro)) : rest('/analisis/casos' + qs(filtro)),

    caso: (id) => esDemo() ? demo(s => s.casos.find(c => c.id === id) || null) : rest('/analisis/casos/' + id),

    abrirCaso: (datos) => esDemo() ? demo(s => {
      const c = Object.assign({
        id: nuevoId('CS'), estatus: 'pendiente_valoracion', notas: [],
        fechaDeteccion: new Date().toISOString().slice(0, 10),
        valoracion: '', fechaCita: '', indicaciones: '', estudiosPosteriores: '',
        proximaValoracion: '', fechaCierre: '', restriccion: ''
      }, datos);
      s.casos.push(c);
      bitacora('analisis.caso_abierto', c.id, datos.empleado, datos.motivo);
      return c;
    }) : rest('/analisis/casos', { method: 'POST', body: JSON.stringify(datos) }),

    /* Actualiza el caso y controla la transición de estatus.
       Sólo se permiten los cinco estatus acordados en la propuesta v3. */
    actualizarCaso: (id, campos, quien) => esDemo() ? demo(s => {
      const c = s.casos.find(x => x.id === id);
      if (!c) throw new Error('Caso no encontrado');
      const validos = (global.ZX_DEMO.CAT.estatusCaso || []).map(e => e.c);
      if (campos.estatus && validos.indexOf(campos.estatus) < 0) throw new Error('Estatus no válido');
      if (campos.estatus === 'alta_cierre' && !campos.fechaCierre && !c.fechaCierre) {
        campos.fechaCierre = new Date().toISOString().slice(0, 10);
      }
      const antes = c.estatus;
      Object.assign(c, campos);
      if (campos.estatus && campos.estatus !== antes) {
        c.notas = c.notas || [];
        c.notas.push({
          fecha: new Date().toISOString().slice(0, 10), autor: quien,
          nota: 'Cambio de estatus: ' + antes + ' → ' + campos.estatus
        });
        bitacora('analisis.caso_estatus', id, c.empleado, antes + ' → ' + campos.estatus);
      } else {
        bitacora('analisis.caso_actualizar', id, c.empleado, 'Actualización del seguimiento');
      }
      return c;
    }) : rest('/analisis/casos/' + id, { method: 'PATCH', body: JSON.stringify(campos) }),

    notaCaso: (id, nota, quien) => esDemo() ? demo(s => {
      const c = s.casos.find(x => x.id === id);
      if (!c) throw new Error('Caso no encontrado');
      c.notas = c.notas || [];
      c.notas.push({ fecha: new Date().toISOString().slice(0, 10), autor: quien, nota: nota });
      bitacora('analisis.caso_nota', id, c.empleado, 'Nota de seguimiento');
      return c;
    }) : rest('/analisis/casos/' + id + '/notas', { method: 'POST', body: JSON.stringify({ nota }) })
  };

  /* ---------------- Auditoría / administración ---------------- */
  const auditoria = {
    lista: (filtro) => esDemo()
      ? demo(s => aplicaFiltro(s.bitacora, filtro).slice().reverse())
      : rest('/admin/bitacora' + qs(filtro)),
    registrar: (accion, entidad, afectado, detalle) => {
      bitacora(accion, entidad, afectado, detalle);
      if (!esDemo()) return rest('/admin/bitacora', { method: 'POST', body: JSON.stringify({ accion, entidad, afectado, detalle }) });
      return Promise.resolve(null);
    },
    cambiarEstatus: (empleadoId, estatus) => esDemo() ? demo(s => {
      const e = s.empleados.find(x => x.id === empleadoId);
      if (!e) throw new Error('Usuario no encontrado');
      e.estatus = estatus;
      bitacora('usuario.estatus', empleadoId, empleadoId, 'Estatus: ' + estatus);
      return e;
    }) : rest('/admin/usuarios/' + empleadoId + '/estatus', { method: 'PATCH', body: JSON.stringify({ estatus }) })
  };

  /* ============================================================
     Privacidad — consentimiento y derechos ARCO (LFPDPPP)
     Nuevo: lo que Medico ZX probó contra un backend real (Supabase +
     disparador que impide guardar sin consentimiento) y que el portal
     no tenía. Aquí el aviso versionado vive en ZX_DEMO.CAT.avisoPrivacidad;
     esta capa sólo guarda quién consintió y las solicitudes ARCO.
     ============================================================ */
  const privacidad = {
    /* Consentimiento VIGENTE de una persona, o null si nunca lo otorgó
       o lo revocó. Null también si la versión que otorgó ya no es la
       vigente (ver otorgar: cambiar de versión exige volver a consentir). */
    consentimiento: (empleadoId) => esDemo() ? demo(s => {
      const version = (global.ZX_DEMO.CAT.avisoPrivacidad || {}).version;
      return s.consentimientos.find(c => c.empleado === empleadoId && c.vigente && c.version === version) || null;
    }) : rest('/privacidad/consentimiento/' + empleadoId),

    /* Panel del servicio médico / administración: quién consintió y quién no
       (art. 18 — evidencia de cumplimiento del deber de seguridad). */
    listaConsentimientos: () => esDemo() ? demo(s => s.consentimientos) : rest('/privacidad/consentimientos'),

    otorgar: (empleadoId) => esDemo() ? demo(s => {
      const version = (global.ZX_DEMO.CAT.avisoPrivacidad || {}).version;
      /* Revoca cualquier consentimiento anterior vigente (de una versión
         distinta) antes de registrar el nuevo, para no dejar dos vigentes. */
      s.consentimientos.filter(c => c.empleado === empleadoId && c.vigente)
        .forEach(c => { c.vigente = false; c.revocado = new Date().toISOString().slice(0, 10); });
      const reg = { id: nuevoId('CO'), empleado: empleadoId, version, fecha: new Date().toISOString().slice(0, 10), vigente: true, revocado: '' };
      s.consentimientos.push(reg);
      bitacora('privacidad.consentimiento_otorgado', reg.id, empleadoId, 'Versión ' + version);
      return reg;
    }) : rest('/privacidad/consentimiento', { method: 'POST', body: JSON.stringify({ empleado: empleadoId }) }),

    revocar: (empleadoId) => esDemo() ? demo(s => {
      const c = s.consentimientos.find(x => x.empleado === empleadoId && x.vigente);
      if (!c) throw new Error('No hay un consentimiento vigente que revocar.');
      c.vigente = false; c.revocado = new Date().toISOString().slice(0, 10);
      bitacora('privacidad.consentimiento_revocado', c.id, empleadoId, '');
      return c;
    }) : rest('/privacidad/consentimiento/' + empleadoId, { method: 'DELETE' }),

    /* Solicitudes ARCO de una persona (su propia bandeja) */
    arco: (empleadoId) => esDemo()
      ? demo(s => s.solicitudesArco.filter(x => x.empleado === empleadoId))
      : rest('/privacidad/arco?empleado=' + encodeURIComponent(empleadoId)),

    /* Bandeja completa para el servicio médico / administración */
    arcoLista: (filtro) => esDemo() ? demo(s => aplicaFiltro(s.solicitudesArco, filtro)) : rest('/privacidad/arco' + qs(filtro)),

    enviarArco: (datos) => esDemo() ? demo(s => {
      const r = Object.assign({ id: nuevoId('AR'), fecha: new Date().toISOString().slice(0, 10), estado: 'pendiente', respuesta: '', respondioPor: '', fechaRespuesta: '' }, datos);
      s.solicitudesArco.push(r);
      bitacora('privacidad.arco_enviada', r.id, datos.empleado, datos.tipo);
      return r;
    }) : rest('/privacidad/arco', { method: 'POST', body: JSON.stringify(datos) }),

    responderArco: (id, respuesta, quien) => esDemo() ? demo(s => {
      const r = s.solicitudesArco.find(x => x.id === id);
      if (!r) throw new Error('Solicitud no encontrada.');
      r.estado = 'respondida'; r.respuesta = respuesta; r.respondioPor = quien;
      r.fechaRespuesta = new Date().toISOString().slice(0, 10);
      bitacora('privacidad.arco_respondida', r.id, r.empleado, respuesta);
      return r;
    }) : rest('/privacidad/arco/' + id, { method: 'PATCH', body: JSON.stringify({ respuesta, respondioPor: quien }) })
  };

  /* ============================================================
     Administración de acceso — nivel (jerarquía, fijo) y perfil
     (función/módulos, editable desde Administración).
     ============================================================ */
  const MODULOS_ASIGNABLES = ['analisis', 'aptitud', 'indicadores', 'rrhh', 'admin'];

  const admin = {
    perfiles: () => esDemo() ? demo(s => s.perfiles) : rest('/admin/perfiles'),

    crearPerfil: (nombre, modulos, quien) => esDemo() ? demo(s => {
      nombre = String(nombre || '').trim();
      if (!nombre) throw new Error('Ponle un nombre al perfil.');
      const id = nuevoId('pf').toLowerCase();
      const p = { id, nombre, modulos: (modulos || []).filter(m => MODULOS_ASIGNABLES.indexOf(m) >= 0), sistema: false };
      s.perfiles.push(p);
      bitacora('admin.perfil_creado', id, '', nombre + ' — módulos: ' + p.modulos.join(', '));
      return p;
    }) : rest('/admin/perfiles', { method: 'POST', body: JSON.stringify({ nombre, modulos }) }),

    actualizarPerfil: (id, campos, quien) => esDemo() ? demo(s => {
      const p = s.perfiles.find(x => x.id === id);
      if (!p) throw new Error('Perfil no encontrado.');
      if (campos.modulos) campos.modulos = campos.modulos.filter(m => MODULOS_ASIGNABLES.indexOf(m) >= 0);
      Object.assign(p, campos);
      bitacora('admin.perfil_actualizado', id, '', JSON.stringify(campos));
      return p;
    }) : rest('/admin/perfiles/' + id, { method: 'PATCH', body: JSON.stringify(campos) }),

    eliminarPerfil: (id, quien) => esDemo() ? demo(s => {
      const p = s.perfiles.find(x => x.id === id);
      if (!p) throw new Error('Perfil no encontrado.');
      if (p.sistema) throw new Error('Este perfil lo usan reglas del sistema y no se puede eliminar.');
      if (s.empleados.some(e => e.perfil === id)) throw new Error('Hay personas con este perfil asignado. Reasígnalas antes de eliminarlo.');
      s.perfiles = s.perfiles.filter(x => x.id !== id);
      bitacora('admin.perfil_eliminado', id, '', p.nombre);
      return true;
    }) : rest('/admin/perfiles/' + id, { method: 'DELETE' }),

    /* Cambia nivel y/o perfil de una persona. En producción sólo el
       administrador autenticado puede llamarlo y el servidor debe
       revalidarlo en cada endpoint, no sólo aquí. */
    cambiarAcceso: (empleadoId, nivel, perfil, quien) => esDemo() ? demo(s => {
      const e = s.empleados.find(x => x.id === empleadoId);
      if (!e) throw new Error('Usuario no encontrado');
      if (!global.ZX_DEMO.NIVELES[nivel]) throw new Error('Nivel no válido.');
      if (!s.perfiles.some(p => p.id === perfil)) throw new Error('Perfil no válido.');
      const antes = e.nivel + ' / ' + e.perfil;
      e.nivel = nivel; e.perfil = perfil;
      bitacora('usuario.acceso', empleadoId, empleadoId, antes + ' → ' + nivel + ' / ' + perfil);
      return e;
    }) : rest('/admin/usuarios/' + empleadoId + '/acceso', { method: 'PATCH', body: JSON.stringify({ nivel, perfil }) })
  };

  /* Getter SÍNCRONO de los perfiles vigentes, para que app.js (puede(),
     requiereSesion()) pueda resolver permisos sin esperar una promesa.
     Sólo funciona en modo demo (localStorage); al conectar backend real,
     puede()/requiereSesion() deben volverse asíncronos o trabajar con una
     copia en caché que se refresque tras el login. */
  function perfilesSync() { return esDemo() ? cargar().perfiles : []; }

  global.ZX_API = {
    config, login, sesionActual, cerrarSesion, reiniciar, perfilesSync,
    empleados, vacaciones, medico, citas, rrhh, analisis, auditoria, privacidad, admin
  };
})(window);

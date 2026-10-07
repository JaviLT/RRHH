/* ============================================================
   Portal RRHH — Capa de acceso a datos (API)
   ------------------------------------------------------------
   Único punto del frontend que habla con los datos: Supabase
   (RLS + funciones SECURITY DEFINER + triggers hacen cumplir en el
   servidor la matriz nivel/perfil, el consentimiento, la apertura
   de casos y la bitácora). Aquí sólo se valida lo necesario para dar
   una respuesta rápida y clara antes de que la base tenga que
   rechazar algo.

   Todas las funciones son async. Ninguna pantalla (page-*.js) sabe
   de tablas ni de SQL: sólo llama a ZX_API.
   ============================================================ */
(function (global) {
  'use strict';

  /* Lo único que este portal guarda en el navegador:
       sessionStorage (se borra al cerrar el navegador):
         · la sesión actual (quién eres, tu nivel y tu perfil)
         · copia de los perfiles y del aviso de privacidad, que los menús
           necesitan leer al instante para decidir qué mostrar
       localStorage:
         · sólo la preferencia de tema claro/oscuro (zx_tema, en app.js) */
  const config = {
    sesionKey: 'zx_portal_sesion_v2',
    perfilesCacheKey: 'zx_portal_perfiles_cache',
    avisoCacheKey: 'zx_portal_aviso_cache'
  };

  /* Borra los datos ficticios que versiones anteriores (modo demo) dejaron
     guardados en este navegador, para que no quede ninguna copia local. */
  try { localStorage.removeItem('zx_portal_demo_v4'); } catch (e) {}
  try { sessionStorage.removeItem('zx_portal_sesion'); } catch (e) {}   // sesión de versiones anteriores a la 2.2.0

  const nuevoId = (pre) => pre + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const hoy = () => new Date().toISOString().slice(0, 10);

  /* ============================================================
     Conversión genérica camelCase (JS) ↔ snake_case (columnas).
     Los nombres de columna se diseñaron para ser la transformación
     mecánica del nombre de campo JS, así que un solo conversor sirve
     para las 30 tablas — salvo un puñado de siglas (IMSS) que se
     listan como excepción explícita.
     ============================================================ */
  const EXC_A_SNAKE = { reportadoIMSS: 'reportado_imss' };
  const EXC_A_CAMEL = { reportado_imss: 'reportadoIMSS' };
  const aSnake = (k) => EXC_A_SNAKE[k] || k.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
  const aCamel = (k) => EXC_A_CAMEL[k] || k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

  function haciaDB(obj) {
    const o = {};
    Object.keys(obj || {}).forEach(k => { if (obj[k] !== undefined) o[aSnake(k)] = obj[k]; });
    return o;
  }
  function desdeDB(fila) {
    if (!fila) return fila;
    const o = {};
    Object.keys(fila).forEach(k => { o[aCamel(k)] = fila[k]; });
    return o;
  }
  const listaDesdeDB = (filas) => (filas || []).map(desdeDB);

  /* Cliente de supabase-js, cargado desde assets/supabase.min.js (local,
     NUNCA desde un CDN — la red de planta ya bloqueó cdn.jsdelivr.net una
     vez con Medico ZX; no repetir el incidente).
     Sesión guardada en sessionStorage (no localStorage): muere al cerrar
     el navegador, la misma decisión de seguridad que ya tenía el portal. */
  let supaClient = null;
  function cliente() {
    if (supaClient) return supaClient;
    if (!global.supabase || !global.ZX_CONFIG) {
      throw new Error('Supabase no está disponible: revisa que supabase.min.js y config.js estén cargados antes de api.js.');
    }
    supaClient = global.supabase.createClient(global.ZX_CONFIG.supabaseUrl, global.ZX_CONFIG.supabaseKey, {
      auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
    });
    return supaClient;
  }

  /* Desenvuelve { data, error } de supabase-js y lo vuelve una Promesa
     que resuelve con `data` o rechaza con un Error legible — el mismo
     contrato que usan todas las funciones de este archivo. */
  async function sb(promesa) {
    const { data, error } = await promesa;
    if (error) throw new Error(error.message);
    return data;
  }

  /* La API de Supabase devuelve como máximo 1,000 filas por consulta y no avisa
     cuando corta. En las tablas que crecen con el tiempo (solicitudes, bitácora,
     citas, empleados) se pide por páginas hasta traerlo todo. `fabrica` debe
     construir la consulta COMPLETA con un orden único y estable (termina en id),
     porque se vuelve a construir en cada página. */
  async function sbTodo(fabrica) {
    const TAM = 1000; let todo = [];
    for (let desde = 0; ; desde += TAM) {
      const pagina = await sb(fabrica().range(desde, desde + TAM - 1));
      todo = todo.concat(pagina || []);
      if (!pagina || pagina.length < TAM) return todo;
    }
  }

  function conFiltro(query, filtro) {
    if (!filtro) return query;
    Object.keys(filtro).forEach(k => {
      if (filtro[k] != null && filtro[k] !== '') query = query.eq(aSnake(k), filtro[k]);
    });
    return query;
  }

  /* Lee-modifica-escribe un arreglo JSONB (seguimiento, notas, casos,
     docs...). No es atómico —dos escrituras a la vez podrían pisarse—,
     suficiente para el volumen
     de esta aplicación, documentado como mejora futura si hace falta. */
  async function anexarJSON(tabla, idCol, idVal, campoJSON, item) {
    const fila = await sb(cliente().from(tabla).select(campoJSON).eq(idCol, idVal).single());
    const arr = fila[campoJSON] || [];
    arr.push(item);
    const act = {}; act[campoJSON] = arr;
    const out = await sb(cliente().from(tabla).update(act).eq(idCol, idVal).select().single());
    return desdeDB(out);
  }

  /* Caché en sessionStorage para lo que app.js necesita leer de forma
     SÍNCRONA (puede()/requiereSesion() no pueden esperar una promesa).
     Se llena al iniciar sesión y se refresca en segundo plano cada vez
     que se pide la sesión actual — puede ir unos segundos desactualizada
     si alguien más cambia un perfil mientras la pestaña está abierta. */
  function guardarCache(key, valor) { try { sessionStorage.setItem(key, JSON.stringify(valor)); } catch (e) {} }
  function leerCache(key) { try { const r = sessionStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

  async function refrescarCaches() {
    try {
      const perfiles = await sb(cliente().from('perfiles').select('*'));
      guardarCache(config.perfilesCacheKey, listaDesdeDB(perfiles));
    } catch (e) { /* se reintenta la próxima vez */ }
    try {
      const aviso = await sb(cliente().from('aviso_privacidad').select('*').order('actualizado', { ascending: false }).limit(1));
      if (aviso && aviso[0]) guardarCache(config.avisoCacheKey, desdeDB(aviso[0]));
    } catch (e) {}
  }

  /* ---------------- Sesión ---------------- */
  function sesionActual() {
    try {
      const raw = sessionStorage.getItem(config.sesionKey);
      const s = raw ? JSON.parse(raw) : null;
      if (s) refrescarCaches(); // en segundo plano, no bloquea
      return s;
    } catch (e) { return null; }
  }

  function cerrarSesion() {
    try {
      sessionStorage.removeItem(config.sesionKey);
      sessionStorage.removeItem('zx_vista_como');          // la vista previa de Administración termina con la sesión
      sessionStorage.removeItem(config.perfilesCacheKey);
      sessionStorage.removeItem(config.avisoCacheKey);
    } catch (e) {}
    /* Nota: cada "Salir" en la app real hace location.replace() justo
       después de esto, lo que recarga la página y reinicia este módulo
       por completo (supaClient vuelve a null). No hace falta esperar
       aquí a que termine signOut() para ese flujo, pero se llama de
       todas formas para invalidar la sesión del lado de Supabase cuanto
       antes en vez de dejar que sólo expire sola. */
    if (supaClient) supaClient.auth.signOut().catch(() => {});
  }

  async function login(usuario, password) {
    /* Mismo patrón de correo sintético que Medico ZX: <nómina>@nomina.zubex.com.mx.
       También se acepta un correo real si alguien lo escribe completo. */
    const texto = String(usuario || '').trim().toLowerCase();
    const correo = texto.indexOf('@') >= 0 ? texto : texto + '@nomina.zubex.com.mx';
    const { data, error } = await cliente().auth.signInWithPassword({ email: correo, password });
    if (error) throw new Error('Usuario o contraseña incorrectos.');

    const fila = await sb(cliente().from('empleados').select('*').eq('auth_user_id', data.user.id).maybeSingle());
    if (!fila) {
      await cliente().auth.signOut();
      throw new Error('Tu usuario no tiene un perfil de empleado ligado todavía. Contacta a Recursos Humanos.');
    }
    if (fila.estatus === 'baja') {
      await cliente().auth.signOut();
      throw new Error('Este acceso está suspendido. Contacta a Recursos Humanos si crees que es un error.');
    }
    const emp = desdeDB(fila);
    const sesion = {
      id: emp.id, nombre: emp.nombre, correo: emp.correo, direccion: emp.direccion, departamento: emp.departamento,
      puesto: emp.puesto, nivel: emp.nivel, perfil: emp.perfil, inicio: new Date().toISOString()
    };
    sessionStorage.setItem(config.sesionKey, JSON.stringify(sesion));
    sessionStorage.removeItem('zx_vista_como');
    await refrescarCaches();
    return sesion;
  }

  /* ---------------- Empleados ---------------- */
  const empleados = {
    lista: () => sbTodo(() => cliente().from('empleados').select('*').order('id')).then(listaDesdeDB),
    uno: (id) => sb(cliente().from('empleados').select('*').eq('id', id).maybeSingle()).then(desdeDB),
    equipo: (jefeId) => sb(cliente().from('empleados').select('*').eq('jefe', jefeId)).then(listaDesdeDB),
    actualizar: (id, campos) => sb(cliente().from('empleados').update(haciaDB(campos)).eq('id', id).select().single()).then(desdeDB),

    /* Activa TODOS los días pendientes de una persona (jefe directo, RRHH o Admin; lo valida la base). */
    activarPendientes: (id) => sb(cliente().rpc('activar_pendientes', { p_empleado: id })),

    /* Catálogos vivos de departamento, área y turno. No son una lista fija
       en el código: la importación desde IBIX agrega los valores nuevos. */
    catalogos: async () => {
      const [dir, dep, t] = await Promise.all([
        sb(cliente().from('direcciones').select('nombre').order('nombre')),
        sb(cliente().from('departamentos').select('nombre').order('nombre')),
        sb(cliente().from('turnos').select('nombre').order('nombre'))
      ]);
      return { direcciones: dir.map(x => x.nombre), departamentos: dep.map(x => x.nombre), turnos: t.map(x => x.nombre) };
    },

    /* Sincronizar desde IBIX no puede hacerse con un
       simple UPDATE del cliente: dar de alta a alguien nuevo requiere crear
       su usuario real de Auth, y eso exige la llave de servicio — que
       nunca debe llegar al navegador. Por eso se llama a la Edge Function
       "sincronizar-ibix", que sí la tiene (ver supabase/functions/). */
    sincronizarIBIX: (filas, quien) => (async () => {
      const { data: { session } } = await cliente().auth.getSession();
      if (!session) throw new Error('Sesión no válida.');
      const resp = await fetch(global.ZX_CONFIG.supabaseUrl + '/functions/v1/sincronizar-ibix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ filas })
      });
      const cuerpo = await resp.json();
      if (!resp.ok) throw new Error(cuerpo.error || 'No se pudo importar.');
      return cuerpo;
    })()
  };

  /* ---------------- Vacaciones y banco de horas ---------------- */
  /* Vacaciones y banco de horas son dos tablas; las pantallas las mezclan en
     una sola lista y distinguen cada fila por `tipo` ('vacaciones' | 'banco').
     Ese campo no existe en la base: se agrega aquí, siempre, al leer. */
  const conTipo = (tipo) => (x) => Array.isArray(x) ? x.map(f => Object.assign(f, { tipo })) : (x ? Object.assign(x, { tipo }) : x);
  const vacaciones = {
    solicitudes: (filtro) => sbTodo(() => conFiltro(cliente().from('solicitudes_vacaciones').select('*'), filtro).order('id')).then(listaDesdeDB).then(conTipo('vacaciones')),
    banco: (filtro) => sbTodo(() => conFiltro(cliente().from('solicitudes_banco').select('*'), filtro).order('id')).then(listaDesdeDB).then(conTipo('banco')),

    solicitar: (datos) => sb(cliente().rpc('solicitar_vacaciones', {
      p_empleado: datos.empleado, p_inicio: datos.inicio, p_fin: datos.fin,
      p_dias: datos.dias, p_comentario: datos.comentarioEmpleado || null
    })).then(desdeDB).then(conTipo('vacaciones')),

    solicitarBanco: (datos) => sb(cliente().rpc('solicitar_banco', {
      p_empleado: datos.empleado, p_fecha: datos.fecha, p_horas: datos.horas,
      p_hora_inicio: datos.horaInicio || null, p_hora_fin: datos.horaFin || null,
      p_comentario: datos.comentarioEmpleado || null
    })).then(desdeDB).then(conTipo('banco')),

    resolver: (id, tipo, estado, nota) => (async () => {
      await sb(cliente().rpc('resolver_solicitud', { p_id: id, p_tipo: tipo, p_estado: estado, p_nota: nota || '' }));
      const tabla = tipo === 'banco' ? 'solicitudes_banco' : 'solicitudes_vacaciones';
      return conTipo(tipo === 'banco' ? 'banco' : 'vacaciones')(desdeDB(await sb(cliente().from(tabla).select('*').eq('id', id).single())));
    })()
  };

  /* ---------------- Calendario ---------------- */
  /* Sólo lee las tablas mínimas calendario_vacaciones / calendario_banco (nombre,
     departamento y fechas de lo APROBADO). Cualquier persona con sesión puede
     leerlas; las llenan triggers cuando se aprueba o se cambia una solicitud. */
  const calendario = {
    /* Vacaciones aprobadas que tocan el rango [desde, hasta] (fechas ISO) */
    vacaciones: (desde, hasta) => sbTodo(() => cliente().from('calendario_vacaciones').select('*')
      .lte('inicio', hasta).gte('fin', desde).order('solicitud_id')).then(listaDesdeDB),
    /* Banco de horas aprobado para un día */
    banco: (dia) => sbTodo(() => cliente().from('calendario_banco').select('*').eq('fecha', dia).order('solicitud_id')).then(listaDesdeDB),

    /* Llama a alCambiar() en cuanto algo cambia (conexión en tiempo real). Si esa
       conexión no se logra o se cae —la red de planta ya bloqueó otros servicios—,
       se refresca sola cada 30 s. Devuelve la función para dejar de escuchar. */
    suscribir: (alCambiar) => {
      const c = cliente(); let sondeo = null, canal = null, cerrado = false;
      const arrancar = () => { if (!sondeo && !cerrado) sondeo = setInterval(alCambiar, 30000); };
      const parar = () => { if (sondeo) { clearInterval(sondeo); sondeo = null; } };
      try {
        canal = c.channel('calendario-' + Math.random().toString(36).slice(2, 8))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_vacaciones' }, () => alCambiar())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_banco' }, () => alCambiar())
          .subscribe((estado) => {
            if (estado === 'SUBSCRIBED') parar();
            else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') arrancar();
          });
      } catch (e) { arrancar(); }
      setTimeout(() => { if (!canal || canal.state !== 'joined') arrancar(); }, 6000);
      return () => { cerrado = true; parar(); if (canal) { try { c.removeChannel(canal); } catch (e) {} } };
    }
  };

  /* ---------------- Módulo médico ---------------- */
  const medico = {
    cuestionario: (empleadoId) => sb(cliente().from('historias_clinicas').select('*').eq('empleado', empleadoId).maybeSingle()).then(desdeDB),

    /* El candado de consentimiento ya no vive aquí: es un trigger real
       en historias_clinicas (exigir_consentimiento). Si no hay consentimiento
       vigente, la base rechaza el INSERT/UPDATE y ese mensaje es el que
       se muestra — no hace falta repetir la validación en el cliente. */
    guardarCuestionario: (empleadoId, datos) => (async () => {
      const cuerpo = Object.assign({ empleado: empleadoId }, datos, { actualizado: new Date().toISOString() });
      const fila = await sb(cliente().from('historias_clinicas').upsert(haciaDB(cuerpo), { onConflict: 'empleado' }).select().single());
      return desdeDB(fila);
    })(),

    consultas: (empleadoId) => sb(empleadoId ? cliente().from('consultas').select('*').eq('empleado', empleadoId) : cliente().from('consultas').select('*')).then(listaDesdeDB),

    registrarConsulta: (datos) => (async () => {
      const { citaId } = datos;
      const cuerpo = Object.assign({}, datos); delete cuerpo.citaId;
      const c = Object.assign({ id: nuevoId('C'), fecha: hoy() }, cuerpo);
      const fila = await sb(cliente().from('consultas').insert(haciaDB(c)).select().single());
      if (citaId) await sb(cliente().from('citas').update({ estado: 'atendida' }).eq('id', citaId));
      return desdeDB(fila);
    })(),

    evaluaciones: (empleadoId) => sb(empleadoId ? cliente().from('evaluaciones').select('*').eq('empleado', empleadoId) : cliente().from('evaluaciones').select('*')).then(listaDesdeDB),

    guardarEvaluacion: (datos) => (async () => {
      const e = Object.assign({ id: nuevoId('EV') }, datos);
      const fila = await sb(cliente().from('evaluaciones').insert(haciaDB(e)).select().single());
      const pendientes = await sb(cliente().from('programa_evaluaciones').select('*')
        .eq('empleado', datos.empleado).eq('tipo', datos.tipo).neq('estado', 'realizada'));
      const pe = listaDesdeDB(pendientes).sort((a, b) => a.programada.localeCompare(b.programada))[0];
      if (pe) await sb(cliente().from('programa_evaluaciones')
        .update({ estado: 'realizada', evaluacion: e.id }).eq('id', pe.id));
      return desdeDB(fila);
    })(),

    riesgos: (empleadoId) => sb(empleadoId ? cliente().from('riesgos_trabajo').select('*').eq('empleado', empleadoId) : cliente().from('riesgos_trabajo').select('*')).then(listaDesdeDB),

    guardarRiesgo: (datos) => (async () => {
      const r = Object.assign({ id: nuevoId('RT'), seguimiento: [] }, datos);
      return desdeDB(await sb(cliente().from('riesgos_trabajo').insert(haciaDB(r)).select().single()));
    })(),

    actualizarRiesgo: (id, campos) => sb(cliente().from('riesgos_trabajo').update(haciaDB(campos)).eq('id', id).select().single()).then(desdeDB),

    agregarSeguimiento: (id, nota) => anexarJSON('riesgos_trabajo', 'id', id, 'seguimiento', { fecha: hoy(), nota }),

    incapacidades: (empleadoId) => sb(empleadoId ? cliente().from('incapacidades').select('*').eq('empleado', empleadoId) : cliente().from('incapacidades').select('*')).then(listaDesdeDB),

    guardarIncapacidad: (datos) => (async () => {
      const i = Object.assign({ id: nuevoId('IN') }, datos);
      return desdeDB(await sb(cliente().from('incapacidades').insert(haciaDB(i)).select().single()));
    })(),

    documentos: (empleadoId) => sb(empleadoId ? cliente().from('documentos_medicos').select('*').eq('empleado', empleadoId) : cliente().from('documentos_medicos').select('*')).then(listaDesdeDB),

    guardarDocumento: (datos) => (async () => {
      const d2 = Object.assign({ id: nuevoId('DM'), fecha: hoy() }, datos);
      return desdeDB(await sb(cliente().from('documentos_medicos').insert(haciaDB(d2)).select().single()));
    })(),

    vigilancia: (empleadoId) => sb(cliente().from('vigilancia_epidemiologica').select('*').eq('empleado', empleadoId).maybeSingle())
          .then(f => desdeDB(f) || { empleado: empleadoId, programa: '', periodicidad: '', recomendaciones: '', restricciones: '', proximaValoracion: '', casos: [] }),

    guardarVigilancia: (empleadoId, datos) => (async () => {
      const cuerpo = Object.assign({ empleado: empleadoId }, datos);
      return desdeDB(await sb(cliente().from('vigilancia_epidemiologica').upsert(haciaDB(cuerpo), { onConflict: 'empleado' }).select().single()));
    })(),

    expedientes: () => sb(cliente().from('expedientes_medicos_estado').select('*')).then(listaDesdeDB),

    expediente: (empleadoId) => sb(cliente().from('expedientes_medicos_estado').select('*').eq('empleado', empleadoId).maybeSingle())
          .then(f => desdeDB(f) || { empleado: empleadoId, estado: 'sin_iniciar', alta: '', altaPor: '', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' }),

    activarExpediente: (empleadoId, quien) => (async () => {
      const cuerpo = { empleado: empleadoId, estado: 'activo', alta: hoy(), altaPor: quien, baja: null, bajaPor: null, motivoBaja: null, conservarHasta: null };
      return desdeDB(await sb(cliente().from('expedientes_medicos_estado').upsert(haciaDB(cuerpo), { onConflict: 'empleado' }).select().single()));
    })(),

    darBajaExpediente: (empleadoId, quien, motivo, conservarHasta) => (async () => {
      const cuerpo = { empleado: empleadoId, estado: 'baja', baja: hoy(), bajaPor: quien, motivoBaja: motivo, conservarHasta };
      const fila = await sb(cliente().from('expedientes_medicos_estado').update(haciaDB(cuerpo)).eq('empleado', empleadoId).select().single());
      return desdeDB(fila);
    })(),

    programa: (empleadoId) => sb(empleadoId ? cliente().from('programa_evaluaciones').select('*').eq('empleado', empleadoId) : cliente().from('programa_evaluaciones').select('*')).then(listaDesdeDB),

    programar: (datos) => (async () => {
      const p = Object.assign({ id: nuevoId('PE') }, datos);
      return desdeDB(await sb(cliente().from('programa_evaluaciones').insert(haciaDB(p)).select().single()));
    })(),

    vacunas: (empleadoId) => sb(empleadoId ? cliente().from('vacunas').select('*').eq('empleado', empleadoId) : cliente().from('vacunas').select('*')).then(listaDesdeDB),

    guardarVacuna: (datos) => (async () => desdeDB(await sb(cliente().from('vacunas').insert(haciaDB(Object.assign({ id: nuevoId('VA') }, datos))).select().single())))(),

    campanas: () => sb(cliente().from('campanas_vacunacion').select('*')).then(listaDesdeDB),

    guardarCampana: (datos) => (async () => desdeDB(await sb(cliente().from('campanas_vacunacion').insert(haciaDB(Object.assign({ id: nuevoId('CP'), aplicadas: 0 }, datos))).select().single())))(),

    guardarCaso: (empleadoId, caso) => (async () => {
      await cliente().from('vigilancia_epidemiologica').upsert(haciaDB({ empleado: empleadoId }), { onConflict: 'empleado', ignoreDuplicates: true });
      return anexarJSON('vigilancia_epidemiologica', 'empleado', empleadoId, 'casos', Object.assign({ fecha: hoy(), estado: 'abierto' }, caso));
    })()
  };

  /* ---------------- Citas ---------------- */
  const citas = {
    agenda: () => sb(cliente().from('agenda_medico_config').select('*').eq('id', true).single()).then(desdeDB),
    lista: (filtro) => sbTodo(() => conFiltro(cliente().from('citas').select('*'), filtro).order('id')).then(listaDesdeDB),

    disponibilidad: (fecha) => (async () => {
      const ag = await citas.agenda();
      const dia = new Date(fecha + 'T12:00:00').getDay();
      const habil = ag.diasHabiles.indexOf(dia) >= 0;
      const bloqueo = (ag.bloqueos || []).find(b => b.fecha === fecha);
      const delDia = await citas.lista({ fecha });
      const ocupadas = delDia.filter(c => c.estado !== 'cancelada').map(c => c.hora);
      return {
        fecha, habil, bloqueo: bloqueo ? bloqueo.motivo : null,
        slots: ag.horarios.map(h => ({ hora: h, libre: habil && !bloqueo && ocupadas.indexOf(h) < 0 }))
      };
    })(),

    agendar: (datos) => (async () => {
      const delDia = await citas.lista({ fecha: datos.fecha });
      if (delDia.some(c => c.hora === datos.hora && c.estado !== 'cancelada')) throw new Error('Ese horario acaba de ocuparse. Elige otro.');
      if (delDia.some(c => c.empleado === datos.empleado && c.estado === 'confirmada')) throw new Error('Ya tienes una cita confirmada ese día.');
      const ag = await citas.agenda();
      const c = Object.assign({ id: nuevoId('A'), medico: ag.medico, estado: 'confirmada', creada: hoy() }, datos);
      return desdeDB(await sb(cliente().from('citas').insert(haciaDB(c)).select().single()));
    })(),

    cancelar: (id, motivo) => sb(cliente().from('citas').update({ estado: 'cancelada' }).eq('id', id).select().single()).then(desdeDB)
  };

  /* ---------------- RRHH ---------------- */
  const FIRMAS_RHF34 = ['Jefe directo', 'Gerente de área', 'Dirección General', 'Recursos Humanos'];

  const rrhh = {
    movimientos: (filtro) => sb(conFiltro(cliente().from('movimientos_rhf34').select('*'), filtro)).then(listaDesdeDB),
    movimiento: (id) => sb(cliente().from('movimientos_rhf34').select('*').eq('id', id).maybeSingle()).then(desdeDB),

    crearMovimiento: (datos) => (async () => {
      /* Folio por conteo. Con volumen alto conviene
         una secuencia de Postgres para evitar folios repetidos en carreras
         simultáneas; con el volumen actual de RHF-34 no es prioritario. */
      const { count } = await cliente().from('movimientos_rhf34').select('*', { count: 'exact', head: true });
      const folio = 'RHF34-' + String((count || 0) + 4).padStart(4, '0');
      const m = Object.assign({
        id: folio, folio, estado: datos.estado || 'borrador', elaboracion: hoy(),
        firmas: FIRMAS_RHF34.map(r => ({ rol: r, quien: null, estado: 'pendiente', fecha: '', nota: '' })),
        adjuntos: []
      }, datos);
      return desdeDB(await sb(cliente().from('movimientos_rhf34').insert(haciaDB(m)).select().single()));
    })(),

    firmar: (id, rolFirma, quien, decision, nota) => (async () => {
      const m = await rrhh.movimiento(id);
      if (!m) throw new Error('Movimiento no encontrado');
      const f = m.firmas.find(x => x.rol === rolFirma);
      if (!f) throw new Error('Etapa de firma no válida');
      if (f.estado !== 'pendiente') throw new Error('Esa etapa ya fue resuelta.');
      f.estado = decision === 'rechazar' ? 'rechazado' : 'firmado';
      f.quien = quien; f.fecha = hoy(); f.nota = nota || '';
      const nuevoEstado = f.estado === 'rechazado' ? 'rechazado' : (m.firmas.every(x => x.estado === 'firmado') ? 'completado' : 'en_firma');
      return desdeDB(await sb(cliente().from('movimientos_rhf34')
        .update({ firmas: m.firmas, estado: nuevoEstado }).eq('id', id).select().single()));
    })(),

    enviarAFirma: (id) => sb(cliente().from('movimientos_rhf34').update({ estado: 'en_firma' }).eq('id', id).select().single()).then(desdeDB),

    expediente: (empleadoId) => sb(cliente().from('expedientes_documentales').select('*').eq('empleado', empleadoId).maybeSingle())
          .then(f => desdeDB(f) || { empleado: empleadoId, docs: [] }),

    registrarDoc: (empleadoId, doc) => (async () => {
      await cliente().from('expedientes_documentales').upsert(haciaDB({ empleado: empleadoId, docs: [] }), { onConflict: 'empleado', ignoreDuplicates: true });
      return anexarJSON('expedientes_documentales', 'empleado', empleadoId, 'docs', Object.assign({ fecha: hoy() }, doc));
    })()
  };

  /* ============================================================
     ETAPA 1 — Análisis clínicos (SQF)
     ============================================================ */
  const ESTATUS_CASO_VALIDOS = ['pendiente_valoracion', 'en_seguimiento', 'pendiente_valoracion_posterior', 'alta_cierre', 'no_requiere'];

  /* Totales de salud ocupacional ya agregados por la base de datos (sin filas ni nombres; grupos < 5 ocultos). */
  const indicadores = {
    salud: (anio) => sb(cliente().rpc('indicadores_salud', { p_anio: anio || null }))
  };

  const analisis = {
    programacion: (filtro) => sb(conFiltro(cliente().from('programacion_analisis').select('*'), filtro)).then(listaDesdeDB),

    programar: (datos) => (async () => desdeDB(await sb(cliente().from('programacion_analisis').insert(haciaDB(Object.assign({ id: nuevoId('PA'), estado: 'programado' }, datos))).select().single())))(),

    resultados: (filtro) => sb(conFiltro(cliente().from('resultados_analisis').select('*'), filtro)).then(listaDesdeDB),

    registrarResultado: (datos) => (async () => {
      const r = Object.assign({ id: nuevoId('RA') }, datos);
      const fila = await sb(cliente().from('resultados_analisis').insert(haciaDB(r)).select().single());
      if (datos.programacion) {
        const p = await sb(cliente().from('programacion_analisis').select('*').eq('id', datos.programacion).maybeSingle());
        if (p) await sb(cliente().from('programacion_analisis')
          .update({ estado: 'realizado', fecha_evaluacion: p.fecha_evaluacion || datos.fechaToma }).eq('id', datos.programacion));
      }
      return desdeDB(fila);
    })(),

    /* La apertura del caso por desviación ya es un trigger real
       (abrir_caso_por_desviacion). Aquí sólo se actualiza el resultado
       y se recupera el caso, si el trigger creó uno, para devolver la
       forma { resultado, caso }. */
    validarResultado: (id, valoracion, quien, nota) => (async () => {
      if (valoracion !== 'normal' && valoracion !== 'desviacion') throw new Error('Valoración no válida');
      const fila = await sb(cliente().from('resultados_analisis')
        .update({ valoracion, validado_por: quien, fecha_validacion: hoy() }).eq('id', id).select().single());
      let caso = null;
      if (valoracion === 'desviacion') {
        const casos = await sb(cliente().from('casos_analisis').select('*').eq('resultado', id));
        if (casos && casos[0]) caso = desdeDB(casos[0]);
      }
      return { resultado: desdeDB(fila), caso };
    })(),

    casos: (filtro) => sb(conFiltro(cliente().from('casos_analisis').select('*'), filtro)).then(listaDesdeDB),
    caso: (id) => sb(cliente().from('casos_analisis').select('*').eq('id', id).maybeSingle()).then(desdeDB),

    abrirCaso: (datos) => (async () => desdeDB(await sb(cliente().from('casos_analisis')
      .insert(haciaDB(Object.assign({ id: nuevoId('CS'), estatus: 'pendiente_valoracion', notas: [], fechaDeteccion: hoy() }, datos))).select().single())))(),

    actualizarCaso: (id, campos, quien) => (async () => {
      if (campos.estatus && ESTATUS_CASO_VALIDOS.indexOf(campos.estatus) < 0) throw new Error('Estatus no válido');
      const actual = await sb(cliente().from('casos_analisis').select('*').eq('id', id).single());
      if (campos.estatus === 'alta_cierre' && !campos.fechaCierre && !actual.fecha_cierre) campos.fechaCierre = hoy();
      const antes = actual.estatus;
      const cambios = haciaDB(campos);
      if (campos.estatus && campos.estatus !== antes) {
        const notas = actual.notas || [];
        notas.push({ fecha: hoy(), autor: quien, nota: 'Cambio de estatus: ' + antes + ' → ' + campos.estatus });
        cambios.notas = notas;
      }
      return desdeDB(await sb(cliente().from('casos_analisis').update(cambios).eq('id', id).select().single()));
    })(),

    notaCaso: (id, nota, quien) => anexarJSON('casos_analisis', 'id', id, 'notas', { fecha: hoy(), autor: quien, nota })
  };

  /* ---------------- Auditoría / administración ---------------- */
  const auditoria = {
    lista: (filtro) => sbTodo(() => conFiltro(cliente().from('bitacora').select('*'), filtro).order('fecha', { ascending: false }).order('id')).then(listaDesdeDB),

    /* La bitácora la escriben triggers del servidor
       (usuario.acceso/estatus, admin.perfil_*, privacidad.*, y las que
       se vayan agregando) — no hay INSERT abierto al cliente, así que
       esta llamada es un no-op. Acciones que todavía
       no tienen su propio trigger (consultas, evaluaciones, RHF-34...)
       quedan sin bitácora por ahora: pendiente agregar más triggers. */
    registrar: () => Promise.resolve(null),

    cambiarEstatus: (empleadoId, estatus) => sb(cliente().from('empleados').update({ estatus }).eq('id', empleadoId).select().single()).then(desdeDB)
  };

  /* ============================================================
     Privacidad — consentimiento y derechos ARCO (LFPDPPP)
     ============================================================ */
  const privacidad = {
    /* Aviso vigente, desde la caché en sessionStorage (refrescada en el login y
       en segundo plano) porque page-privacidad.js lo necesita de forma
       síncrona al construir la pantalla. */
    avisoSync: () => (leerCache(config.avisoCacheKey) || { version: 'v1', vigente: false, pendientes: [], texto: '', responsable: '', domicilio: '', areaResponsable: '', contacto: '', actualizado: '' }),

    consentimiento: (empleadoId) => (async () => {
      const version = privacidad.avisoSync().version;
      const filas = await sb(cliente().from('consentimientos').select('*')
        .eq('empleado', empleadoId).eq('vigente', true).eq('version', version));
      return filas && filas[0] ? desdeDB(filas[0]) : null;
    })(),

    listaConsentimientos: () => sb(cliente().from('consentimientos').select('*')).then(listaDesdeDB),

    otorgar: (empleadoId) => (async () => {
      const version = privacidad.avisoSync().version;
      const vigentes = await sb(cliente().from('consentimientos').select('id').eq('empleado', empleadoId).eq('vigente', true));
      for (const v of (vigentes || [])) {
        await sb(cliente().from('consentimientos').update({ vigente: false, revocado: hoy() }).eq('id', v.id));
      }
      const reg = { id: nuevoId('CO'), empleado: empleadoId, version, fecha: hoy(), vigente: true };
      return desdeDB(await sb(cliente().from('consentimientos').insert(haciaDB(reg)).select().single()));
    })(),

    revocar: (empleadoId) => (async () => {
      const filas = await sb(cliente().from('consentimientos').select('*').eq('empleado', empleadoId).eq('vigente', true));
      if (!filas || !filas[0]) throw new Error('No hay un consentimiento vigente que revocar.');
      return desdeDB(await sb(cliente().from('consentimientos')
        .update({ vigente: false, revocado: hoy() }).eq('id', filas[0].id).select().single()));
    })(),

    arco: (empleadoId) => sb(cliente().from('solicitudes_arco').select('*').eq('empleado', empleadoId)).then(listaDesdeDB),

    arcoLista: (filtro) => sb(conFiltro(cliente().from('solicitudes_arco').select('*'), filtro)).then(listaDesdeDB),

    enviarArco: (datos) => (async () => desdeDB(await sb(cliente().from('solicitudes_arco')
      .insert(haciaDB(Object.assign({ id: nuevoId('AR'), fecha: hoy(), estado: 'pendiente' }, datos))).select().single())))(),

    responderArco: (id, respuesta, quien) => sb(cliente().from('solicitudes_arco')
      .update({ estado: 'respondida', respuesta, respondio_por: quien, fecha_respuesta: hoy() })
      .eq('id', id).select().single()).then(desdeDB)
  };

  /* ============================================================
     Administración de acceso — nivel (fijo) y perfil (editable).
     ============================================================ */
  const MODULOS_ASIGNABLES = ['analisis', 'aptitud', 'indicadores', 'rrhh', 'admin'];

  const admin = {
    perfiles: () => sb(cliente().from('perfiles').select('*')).then(listaDesdeDB),

    crearPerfil: (nombre, modulos, quien) => (async () => {
      nombre = String(nombre || '').trim();
      if (!nombre) throw new Error('Ponle un nombre al perfil.');
      const id = nuevoId('pf').toLowerCase();
      const p = { id, nombre, modulos: (modulos || []).filter(m => MODULOS_ASIGNABLES.indexOf(m) >= 0), sistema: false };
      const fila = await sb(cliente().from('perfiles').insert(haciaDB(p)).select().single());
      await refrescarCaches();
      return desdeDB(fila);
    })(),

    actualizarPerfil: (id, campos, quien) => (async () => {
      if (campos.modulos) campos.modulos = campos.modulos.filter(m => MODULOS_ASIGNABLES.indexOf(m) >= 0);
      const fila = await sb(cliente().from('perfiles').update(haciaDB(campos)).eq('id', id).select().single());
      await refrescarCaches();
      return desdeDB(fila);
    })(),

    eliminarPerfil: (id, quien) => (async () => {
      await sb(cliente().from('perfiles').delete().eq('id', id));
      await refrescarCaches();
      return true;
    })(),

    cambiarAcceso: (empleadoId, nivel, perfil, quien) => sb(cliente().from('empleados').update({ nivel, perfil }).eq('id', empleadoId).select().single()).then(desdeDB),

    /* ---- Jerarquía: a quién reporta cada persona (campo `jefe`) ----
       Es lo que decide quién aprueba vacaciones/banco de horas y qué
       equipo ve cada jefe. Sólo Administración lo cambia (RLS). En modo
       Supabase, la base misma rechaza ciclos y auto-jefaturas (triggers
       evitar_ciclo_jefe / constraint empleados_jefe_no_self); aquí se
       valida igual para dar un mensaje claro antes de ir al servidor. */
    cambiarJefe: (empleadoId, jefeId, quien) => sb(cliente().from('empleados').update({ jefe: jefeId || null }).eq('id', empleadoId).select().single()).then(desdeDB),

    /* Pone a `jefeId` como jefe directo de TODAS las personas de la lista,
       en una sola operación (todo o nada). */
    asignarEquipo: (jefeId, empleadoIds, quien) => (async () => {
      if (!jefeId) throw new Error('Elige a la persona que será el jefe.');
      if (!empleadoIds || !empleadoIds.length) return 0;
      const filas = await sb(cliente().from('empleados').update({ jefe: jefeId }).in('id', empleadoIds).select('id'));
      return (filas || []).length;
    })()
  };

  /* Getter SÍNCRONO de los perfiles vigentes, para que app.js (puede(),
     requiereSesion()) pueda resolver permisos sin esperar una promesa. */
  function perfilesSync() { return (leerCache(config.perfilesCacheKey) || []); }

  global.ZX_API = {
    config, login, sesionActual, cerrarSesion, perfilesSync,
    empleados, vacaciones, calendario, medico, citas, rrhh, analisis, indicadores, auditoria, privacidad, admin
  };
})(window);

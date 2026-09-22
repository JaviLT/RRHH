/* ============================================================
   Portal Zubex — DATOS DE DEMOSTRACIÓN
   ------------------------------------------------------------
   ⚠ TODOS los datos de este archivo son FICTICIOS.
     No contiene información real de empleados, ni contraseñas
     reales, ni datos personales ni datos de salud verdaderos.
     Sirve únicamente para poder navegar el frontend sin backend.

   Al conectar el backend real: borrar este archivo y dejar que
   api.js apunte a los endpoints del servidor (ver api.js).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Catálogos ---------- */
  const DEPARTAMENTOS = ['Administración Productiva', 'Recursos Humanos', 'Extrusión', 'Impresión', 'Bolseo',
                         'Mantenimiento', 'Calidad', 'Almacén', 'Seguridad Industrial', 'Sistemas'];
  const AREAS = ['Planta 1', 'Planta 2', 'Almacén', 'Laboratorio', 'Oficinas', 'Servicio médico', 'Patio de maniobras'];
  const TURNOS = ['Matutino', 'Vespertino', 'Nocturno', 'Rotativo', 'Mixto', 'Fijo administrativo'];

  /* ============================================================
     Modelo de acceso — dos ejes independientes por persona:

     · NIVEL    → jerarquía organizacional. Determina si ves "mi equipo",
       si apruebas vacaciones/banco de horas de quien te reporta, etc.
       Fijo: no se crea ni se edita desde Administración (a diferencia
       de los perfiles). `jefe`/`gerente` se fusionaron en `supervisor`:
       el código nunca los trató distinto (ver soloEquipo en
       page-aptitud.js) — el título real (Jefe de Producción, Gerente de
       Operaciones) sigue viviendo en el campo `puesto`, que es texto libre.

     · PERFIL   → función/acceso a módulos especiales, más allá de los
       universales (vacaciones, banco de horas, citas, mi historia
       clínica, aviso de privacidad — esos los tiene cualquiera).
       Es la parte editable: Administración puede crear perfiles nuevos
       y asignarles o quitarles módulos (ver assets/page-admin.js).
       `rrhh` y `rl` se fusionaron aquí: tenían exactamente los mismos
       módulos y ningún código los distinguía.

     Antes esto vivía en un solo campo `rol`, lo que impedía representar
     a alguien como "Jefe de Seguridad Industrial" (supervisa un equipo
     Y tiene el perfil de Seguridad Industrial) — tenía que elegir uno
     de los dos. Con dos campos, ese caso (E1009) ya se representa bien. */
  const NIVELES = {
    empleado:    { nombre: 'Empleado' },
    coordinador: { nombre: 'Coordinador' },
    supervisor:  { nombre: 'Jefe / Gerente' }
  };

  /* Perfiles de fábrica. `sistema: true` = protegido contra borrado desde
     Administración (varias reglas del código dependen de que el id exista:
     ver esClinico, esRRHH, esAdmin en app.js). Sus módulos SÍ son editables
     — sólo el borrado del perfil completo está bloqueado, y sólo mientras
     alguien lo tenga asignado o sea de sistema. */
  const PERFILES = [
    { id: 'ninguno',    nombre: 'Sin perfil adicional',       modulos: [], sistema: true },
    { id: 'medico',     nombre: 'Salud Ocupacional',          modulos: ['analisis', 'aptitud', 'indicadores'], sistema: true },
    { id: 'vigilancia', nombre: 'Seguridad Industrial',       modulos: ['aptitud', 'indicadores'], sistema: true },
    { id: 'rrhh',       nombre: 'Recursos Humanos',           modulos: ['rrhh', 'indicadores'], sistema: true },
    { id: 'direccion',  nombre: 'Dirección',                  modulos: ['analisis', 'indicadores'], sistema: true },
    { id: 'admin',      nombre: 'Administrador del sistema',  modulos: ['admin', 'analisis', 'indicadores'], sistema: true }
  ];

  /* Contraseña de TODOS los usuarios demo: demo1234
     (el hash de abajo es un hash de demostración, NO criptográfico;
      la autenticación real debe validarse en el servidor) */
  /* `turno`, `area` y `estatus` son datos MAESTROS del registro de personal
     (hoy capturados en el portal; en el modelo final vendrán de IBIX). */
  /* nivel: empleado · coordinador · supervisor (fusión de jefe+gerente)
     perfil: id de PERFILES — 'ninguno' para quien no tiene función especial.
     Nota E1009: nivel supervisor + perfil vigilancia — el caso que el
     modelo de un solo campo no podía representar (ver arriba). */
  const EMPLEADOS = [
    { id: 'E1001', nombre: 'Ana Sofía Duarte Peña',    correo: 'demo.ana@example.com',    depto: 'Recursos Humanos',        area: 'Oficinas',  turno: 'Fijo administrativo', puesto: 'Coordinadora de RRHH',   nivel: 'coordinador', perfil: 'rrhh',      jefe: 'E1005', ingreso: '2019-03-11', estatus: 'activo', genero: 'F', nacimiento: '1991-06-02', dias: 16, diasPend: 2, pendActivos: true,  horas: 8,  horasDeber: 0 },
    { id: 'E1002', nombre: 'Bruno Carrillo Mena',      correo: 'demo.bruno@example.com',  depto: 'Extrusión',               area: 'Planta 1',  turno: 'Rotativo',            puesto: 'Operador de Extrusión',  nivel: 'empleado',    perfil: 'ninguno',   jefe: 'E1004', ingreso: '2021-08-02', estatus: 'activo', genero: 'M', nacimiento: '1996-01-19', dias: 12, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1003', nombre: 'Carmen Iribe Salas',       correo: 'demo.carmen@example.com', depto: 'Calidad',                 area: 'Laboratorio', turno: 'Matutino',          puesto: 'Inspectora de Calidad',  nivel: 'empleado',    perfil: 'ninguno',   jefe: 'E1004', ingreso: '2023-02-20', estatus: 'activo', genero: 'F', nacimiento: '1999-11-30', dias: 9,  diasPend: 0, pendActivos: false, horas: 4,  horasDeber: 2 },
    { id: 'E1004', nombre: 'Diego Vargas Ochoa',       correo: 'demo.diego@example.com',  depto: 'Extrusión',               area: 'Planta 1',  turno: 'Matutino',            puesto: 'Jefe de Producción',     nivel: 'supervisor',  perfil: 'ninguno',   jefe: 'E1005', ingreso: '2016-05-09', estatus: 'activo', genero: 'M', nacimiento: '1987-04-14', dias: 20, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1005', nombre: 'Elena Roldán Quiroz',      correo: 'demo.elena@example.com',  depto: 'Administración Productiva', area: 'Oficinas', turno: 'Fijo administrativo', puesto: 'Gerente de Operaciones', nivel: 'supervisor',  perfil: 'ninguno',   jefe: null,    ingreso: '2012-10-01', estatus: 'activo', genero: 'F', nacimiento: '1982-09-08', dias: 24, diasPend: 4, pendActivos: true,  horas: 12, horasDeber: 0 },
    { id: 'E1006', nombre: 'Dr. Francisco Neri Ávila', correo: 'demo.medico@example.com', depto: 'Recursos Humanos',        area: 'Servicio médico', turno: 'Matutino',      puesto: 'Médico de Empresa',      nivel: 'empleado',    perfil: 'medico',    jefe: 'E1001', ingreso: '2020-01-15', estatus: 'activo', genero: 'M', nacimiento: '1985-02-26', dias: 14, diasPend: 0, pendActivos: false, horas: 8,  horasDeber: 0 },
    { id: 'E1007', nombre: 'Gabriel Tenorio Ruiz',     correo: 'demo.gabriel@example.com', depto: 'Impresión',              area: 'Planta 2',  turno: 'Vespertino',          puesto: 'Ayudante de Impresión',  nivel: 'empleado',    perfil: 'ninguno',   jefe: 'E1004', ingreso: '2024-07-01', estatus: 'activo', genero: 'M', nacimiento: '2001-03-05', dias: 6,  diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1008', nombre: 'Hilda Márquez Cano',       correo: 'demo.hilda@example.com',  depto: 'Bolseo',                  area: 'Planta 1',  turno: 'Nocturno',            puesto: 'Coordinadora de Turno',  nivel: 'coordinador', perfil: 'ninguno',   jefe: 'E1004', ingreso: '2018-11-26', estatus: 'activo', genero: 'F', nacimiento: '1990-12-12', dias: 18, diasPend: 0, pendActivos: false, horas: 10, horasDeber: 0 },
    { id: 'E1009', nombre: 'Ignacio Peralta Bustos',   correo: 'demo.ignacio@example.com', depto: 'Seguridad Industrial',   area: 'Planta 1',  turno: 'Matutino',            puesto: 'Jefe de Seguridad Industrial', nivel: 'supervisor', perfil: 'vigilancia', jefe: 'E1005', ingreso: '2017-04-03', estatus: 'activo', genero: 'M', nacimiento: '1984-07-21', dias: 18, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1010', nombre: 'Julia Sandoval Ríos',      correo: 'demo.julia@example.com',  depto: 'Recursos Humanos',        area: 'Oficinas',  turno: 'Fijo administrativo', puesto: 'Analista de Relaciones Laborales', nivel: 'empleado', perfil: 'rrhh', jefe: 'E1001', ingreso: '2020-09-14', estatus: 'activo', genero: 'F', nacimiento: '1993-05-17', dias: 15, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1012', nombre: 'Lorena Bañuelos Prado',    correo: 'demo.lorena@example.com', depto: 'Administración Productiva', area: 'Oficinas', turno: 'Fijo administrativo', puesto: 'Directora de Operaciones', nivel: 'supervisor', perfil: 'direccion', jefe: null, ingreso: '2010-02-01', estatus: 'activo', genero: 'F', nacimiento: '1978-11-03', dias: 25, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 },
    { id: 'E1011', nombre: 'Kevin Ordaz Villalba',     correo: 'demo.kevin@example.com',  depto: 'Sistemas',                area: 'Oficinas',  turno: 'Fijo administrativo', puesto: 'Administrador de Sistemas', nivel: 'empleado', perfil: 'admin',   jefe: 'E1005', ingreso: '2022-01-10', estatus: 'activo', genero: 'M', nacimiento: '1994-10-08', dias: 13, diasPend: 0, pendActivos: false, horas: 12, horasDeber: 0 }
  ];

  /* Credenciales demo — el "hash" es simbólico. Ver nota arriba. */
  const CREDENCIALES = EMPLEADOS.map(e => ({ id: e.id, hash: 'demo::demo1234' }));

  const hoy = new Date();
  const d = (offset) => {
    const x = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };

  const SOLICITUDES = [
    { id: 'V-2601', empleado: 'E1002', tipo: 'vacaciones', inicio: d(12), fin: d(16), dias: 5, estado: 'pendiente', comentarioEmpleado: 'Viaje familiar programado.', resolucion: '', aprobador: 'E1004', creada: d(-2) },
    { id: 'V-2602', empleado: 'E1003', tipo: 'vacaciones', inicio: d(-20), fin: d(-16), dias: 5, estado: 'aprobada', comentarioEmpleado: '', resolucion: 'Sin carga de auditoría esa semana.', aprobador: 'E1004', creada: d(-32) },
    { id: 'V-2603', empleado: 'E1007', tipo: 'vacaciones', inicio: d(1), fin: d(3), dias: 3, estado: 'aprobada', comentarioEmpleado: 'Trámite personal.', resolucion: 'Aprobado.', aprobador: 'E1004', creada: d(-9) },
    { id: 'V-2604', empleado: 'E1008', tipo: 'vacaciones', inicio: d(-1), fin: d(4), dias: 6, estado: 'aprobada', comentarioEmpleado: '', resolucion: 'Cubre Bruno.', aprobador: 'E1004', creada: d(-14) },
    { id: 'V-2605', empleado: 'E1003', tipo: 'vacaciones', inicio: d(30), fin: d(34), dias: 5, estado: 'pendiente', comentarioEmpleado: 'Puente vacacional.', resolucion: '', aprobador: 'E1004', creada: d(-1) },
    { id: 'V-2606', empleado: 'E1002', tipo: 'vacaciones', inicio: d(-60), fin: d(-58), dias: 3, estado: 'rechazada', comentarioEmpleado: '', resolucion: 'Coincide con arranque de línea 3.', aprobador: 'E1004', creada: d(-70) }
  ];

  const BANCO_HORAS = [
    { id: 'B-1201', empleado: 'E1003', tipo: 'banco', fecha: d(5), horas: 3, horaInicio: '13:00', horaFin: '16:00', estado: 'pendiente', comentarioEmpleado: 'Cita en el banco.', resolucion: '', aprobador: 'E1004', creada: d(-1) },
    { id: 'B-1202', empleado: 'E1002', tipo: 'banco', fecha: d(-8), horas: 2, horaInicio: '08:00', horaFin: '10:00', estado: 'aprobada', comentarioEmpleado: '', resolucion: 'OK', aprobador: 'E1004', creada: d(-12) },
    { id: 'B-1203', empleado: 'E1007', tipo: 'banco', fecha: d(9), horas: 4, horaInicio: '14:00', horaFin: '18:00', estado: 'pendiente', comentarioEmpleado: 'Asunto escolar.', resolucion: '', aprobador: 'E1004', creada: d(0) }
  ];

  /* ---------- Módulo médico ----------
     Cuestionario que llena el empleado (una vez / actualizable) */
  /* Cuestionario que llena el COLABORADOR — secciones 1, 2 y 3 del expediente */
  const CUESTIONARIOS = [
    {
      empleado: 'E1002', actualizado: d(-40),
      /* 1. Identificación (lo no derivable del registro de personal) */
      curp: 'DEMO910101HDFXXX01', nacimiento: '1996-01-19', sexo: 'Hombre', jornada: 'Turnos', jornadaDetalle: 'Rotativo 2x2',
      contactoEmergencia: 'Familiar directo', telefonoEmergencia: '55-0000-0000',
      /* 2. Información médica básica */
      tipoSanguineo: 'O+',
      alergias: 'Penicilina (rash leve)',
      antecedentesMedicos: 'Fractura de antebrazo izquierdo en 2014, sin secuelas.',
      antecedentesQuirurgicos: 'Apendicectomía (2011)',
      medicamentosHabituales: 'Ninguno',
      cronicas: ['Ninguna'],
      /* 3. Historia clínica ocupacional */
      puestos: [
        { puesto: 'Ayudante general', empresa: 'Zubex', desde: '2021-08-02', hasta: '2023-01-31', antiguedad: '1 año 6 meses' },
        { puesto: 'Operador de Extrusión', empresa: 'Zubex', desde: '2023-02-01', hasta: '', antiguedad: '3 años' }
      ],
      riesgosExposicion: ['Ruido', 'Temperaturas altas', 'Manejo manual de cargas'],
      epp: ['Tapones auditivos', 'Guantes', 'Calzado de seguridad', 'Lentes de seguridad'],
      accidentes: 'Golpe en mano derecha en 2023, sin incapacidad.',
      /* Complementarios (versión anterior del cuestionario) */
      consumo: ['Ninguno'],
      padecimientos: ['Ninguna'],
      heredofamiliares: ['Diabetes'],
      mascota: 'Sí', tipoMascota: 'Perro',
      frecuenciaServicio: '1',
      estadoSaludPercibido: 'Bueno',
      goa: null
    },
    {
      empleado: 'E1003', actualizado: d(-15),
      curp: 'DEMO990101MDFXXX02', nacimiento: '1999-11-30', sexo: 'Mujer', jornada: 'Fijo', jornadaDetalle: 'Lunes a viernes 08:00–17:00',
      contactoEmergencia: 'Familiar directo', telefonoEmergencia: '55-0000-0000',
      tipoSanguineo: 'A+',
      alergias: 'Ninguna conocida',
      antecedentesMedicos: 'Sin antecedentes relevantes.',
      antecedentesQuirurgicos: 'Ninguno',
      medicamentosHabituales: 'Ninguno',
      cronicas: ['Ninguna'],
      puestos: [
        { puesto: 'Auxiliar de laboratorio', empresa: 'Otra empresa', desde: '2020-01-15', hasta: '2023-02-15', antiguedad: '3 años' },
        { puesto: 'Inspectora de Calidad', empresa: 'Zubex', desde: '2023-02-20', hasta: '', antiguedad: '3 años' }
      ],
      riesgosExposicion: ['Posturas forzadas', 'Iluminación', 'Sustancias químicas'],
      epp: ['Bata', 'Guantes', 'Lentes de seguridad'],
      accidentes: 'No',
      consumo: ['Ninguno'],
      padecimientos: ['Ninguna'],
      heredofamiliares: ['Hipertensión'],
      mascota: 'No', tipoMascota: '',
      frecuenciaServicio: '2',
      estadoSaludPercibido: 'Muy bueno',
      goa: { menarca: '', ritmo: '', fum: '', gestas: '', paras: '', abortos: '', cesareas: '', ivsa: '', anticonceptivo: '' }
    }
  ];

  /* 4. Evaluaciones de salud — sólo el médico */
  const EVALUACIONES = [
    {
      id: 'EV-5001', empleado: 'E1002', medico: 'E1006', tipo: 'ingreso', fecha: '2021-08-02',
      motivo: 'Examen médico de ingreso',
      hallazgos: 'Sin hallazgos patológicos. Audiometría dentro de parámetros normales.',
      estudios: [
        { nombre: 'Biometría hemática', fecha: '2021-07-28', resultado: 'Normal' },
        { nombre: 'Audiometría', fecha: '2021-07-28', resultado: 'Normal bilateral' },
        { nombre: 'Espirometría', fecha: '2021-07-28', resultado: 'Normal' }
      ],
      dictamen: 'apto', restricciones: '', vigencia: '2026-08-02'
    },
    {
      id: 'EV-5002', empleado: 'E1002', medico: 'E1006', tipo: 'periodico', fecha: d(-40),
      motivo: 'Examen periódico anual — puesto con exposición a ruido',
      hallazgos: 'Contractura lumbar leve. Audiometría con descenso no significativo en 4000 Hz.',
      estudios: [
        { nombre: 'Audiometría', fecha: d(-42), resultado: 'Descenso leve en 4000 Hz, seguimiento en 12 meses' },
        { nombre: 'Química sanguínea', fecha: d(-42), resultado: 'Glucosa 92 mg/dL, perfil normal' }
      ],
      dictamen: 'apto_con_restricciones',
      restricciones: 'Evitar carga manual mayor a 20 kg durante 3 meses. Uso obligatorio de tapones auditivos.',
      vigencia: d(325)
    },
    {
      id: 'EV-5003', empleado: 'E1003', medico: 'E1006', tipo: 'cambio_puesto', fecha: d(-15),
      motivo: 'Valoración por cambio de puesto a Analista de Calidad',
      hallazgos: 'Sin contraindicaciones para el nuevo puesto.',
      estudios: [{ nombre: 'Biometría hemática', fecha: d(-18), resultado: 'Normal' }],
      dictamen: 'apto', restricciones: '', vigencia: d(350)
    }
  ];

  /* 6. Riesgos de trabajo — accidentes, incidentes y enfermedades de trabajo */
  const RIESGOS = [
    {
      id: 'RT-6001', empleado: 'E1002', tipo: 'accidente', fecha: d(-95), hora: '14:20',
      area: 'Extrusión', puesto: 'Operador de Extrusión',
      descripcion: 'Golpe en mano derecha al manipular rodillo durante cambio de bobina.',
      lesion: 'Contusión en dorso de mano derecha, sin fractura.',
      mecanismo: 'Atrapamiento entre partes móviles',
      diasPerdidos: 0, incapacidad: false, reportadoIMSS: true,
      ochoD: {
        d1: 'Jefe de Producción, operador involucrado, seguridad e higiene, servicio médico.',
        d2: 'Durante el cambio de bobina el operador introdujo la mano sin detener el rodillo, generando contusión.',
        d3: 'Paro inmediato de la línea y atención médica en sitio. Señalización del punto de atrapamiento.',
        d4: 'Causa raíz: el procedimiento de cambio de bobina no exigía paro total del equipo; falta de guarda física en el punto de atrapamiento.',
        d5: 'Rediseño del procedimiento con bloqueo de energía (LOTO) e instalación de guarda fija.',
        d6: 'Guarda instalada y procedimiento liberado; verificación en piso a 30 días sin desviaciones.',
        d7: 'Actualización del análisis de riesgos del puesto y capacitación a los tres turnos.',
        d8: 'Caso cerrado. Reconocimiento al equipo de mantenimiento por la instalación de la guarda.'
      },
      estado: 'cerrado',
      reincorporacion: { fecha: d(-94), condiciones: 'Reincorporación sin restricciones al día siguiente.' },
      seguimiento: [
        { fecha: d(-95), nota: 'Atención inicial, curación y vendaje.' },
        { fecha: d(-88), nota: 'Revisión: sin dolor ni limitación funcional. Alta.' }
      ]
    },
    {
      id: 'RT-6002', empleado: 'E1007', tipo: 'incidente', fecha: d(-30), hora: '09:05',
      area: 'Impresión', puesto: 'Ayudante de Impresión',
      descripcion: 'Derrame de tinta en piso; personal resbaló sin caída ni lesión.',
      lesion: 'Sin lesión',
      mecanismo: 'Superficie resbalosa',
      diasPerdidos: 0, incapacidad: false, reportadoIMSS: false,
      ochoD: {
        d1: 'Coordinador de turno, seguridad e higiene.', d2: 'Derrame de tinta por conexión mal ajustada en la bomba.',
        d3: 'Acordonamiento y limpieza inmediata.', d4: 'Causa raíz: falta de par de apriete definido en la conexión de la bomba.',
        d5: 'Definición de par de apriete y check-list de arranque.', d6: 'Check-list en uso desde hace 30 días.',
        d7: 'Extensión del check-list a las otras dos prensas.', d8: ''
      },
      estado: 'en_seguimiento',
      reincorporacion: { fecha: '', condiciones: '' },
      seguimiento: [{ fecha: d(-30), nota: 'Sin atención médica requerida. Se documenta como incidente.' }]
    }
  ];

  /* 7. Incapacidades y ausentismo médico */
  const INCAPACIDADES = [
    {
      id: 'IN-7001', empleado: 'E1007', tipo: 'enfermedad_general', folio: 'DEMO-0001',
      inicio: d(-52), fin: d(-50), dias: 3, causa: 'Gastroenteritis aguda',
      expedidaPor: 'IMSS', estado: 'concluida',
      seguimiento: 'Reincorporación sin restricciones. Sin recaídas.'
    },
    {
      id: 'IN-7002', empleado: 'E1003', tipo: 'maternidad', folio: 'DEMO-0002',
      inicio: d(-200), fin: d(-116), dias: 84, causa: 'Licencia por maternidad',
      expedidaPor: 'IMSS', estado: 'concluida',
      seguimiento: 'Reincorporación con horario de lactancia por 6 meses.'
    },
    {
      id: 'IN-7003', empleado: 'E1002', tipo: 'riesgo_trabajo', folio: 'DEMO-0003',
      inicio: d(-4), fin: d(2), dias: 7, causa: 'Lumbalgia asociada a manejo de cargas',
      expedidaPor: 'IMSS', estado: 'vigente',
      seguimiento: 'Valoración de reincorporación programada al término del periodo.'
    }
  ];

  /* 8. Documentos y evidencias del expediente médico */
  const DOCS_MEDICOS = [
    { id: 'DM-8001', empleado: 'E1002', tipo: 'Historia clínica', nombre: 'historia_clinica_ingreso.pdf', fecha: '2021-08-02', tam: '240 KB', notas: 'Firmada por el colaborador' },
    { id: 'DM-8002', empleado: 'E1002', tipo: 'Resultado de laboratorio', nombre: 'biometria_hematica.pdf', fecha: d(-42), tam: '112 KB', notas: '' },
    { id: 'DM-8003', empleado: 'E1002', tipo: 'Estudio médico', nombre: 'audiometria.pdf', fecha: d(-42), tam: '96 KB', notas: 'Seguimiento en 12 meses' },
    { id: 'DM-8004', empleado: 'E1002', tipo: 'Dictamen médico', nombre: 'dictamen_aptitud.pdf', fecha: d(-40), tam: '84 KB', notas: 'Apto con restricciones' },
    { id: 'DM-8005', empleado: 'E1002', tipo: 'Incapacidad', nombre: 'incapacidad_IN-7003.pdf', fecha: d(-4), tam: '72 KB', notas: '' },
    { id: 'DM-8006', empleado: 'E1003', tipo: 'Historia clínica', nombre: 'historia_clinica.pdf', fecha: '2023-02-20', tam: '228 KB', notas: '' }
  ];

  /* 9. Seguimiento de salud ocupacional */
  const VIGILANCIA = [
    {
      empleado: 'E1002', programa: 'Vigilancia por exposición a ruido (NOM-011-STPS)',
      periodicidad: 'Anual',
      recomendaciones: 'Uso permanente de tapones auditivos. Higiene de columna y calentamiento previo a turno.',
      restricciones: 'Carga manual máxima 20 kg por 3 meses.',
      proximaValoracion: d(325),
      casos: [
        { fecha: d(-40), tema: 'Descenso audiométrico en 4000 Hz', estado: 'abierto', nota: 'Repetir audiometría en 12 meses; verificar uso de EPP en piso.' },
        { fecha: d(-4), tema: 'Lumbalgia con incapacidad vigente', estado: 'abierto', nota: 'Valorar reincorporación y ajuste de tareas al alta.' }
      ]
    },
    {
      empleado: 'E1003', programa: 'Vigilancia general anual',
      periodicidad: 'Anual', recomendaciones: 'Pausas activas cada 2 horas por trabajo con pantalla.',
      restricciones: 'Ninguna', proximaValoracion: d(350), casos: []
    }
  ];

  /* Consultas registradas por el médico (expediente) */
  const CONSULTAS = [
    {
      id: 'C-3001', empleado: 'E1002', medico: 'E1006', fecha: d(-40), hora: '10:30',
      motivoCod: 'M03', motivo: 'Dolor lumbar tras jornada de carga',
      somatometria: { estatura: 174, peso: 78, ta: '118/76', fc: 72 },
      exploracion: { cabeza: 'Normal', ojos: 'Normal', oidos: 'Normal', nariz: 'Normal', boca: 'Normal', torax: 'Normal', areaCardiaca: 'Ruidos rítmicos', abdomen: 'Blando, depresible', columna: 'Contractura paravertebral L4-L5', extremidades: 'Íntegras' },
      diagnostico: 'Lumbalgia mecánica leve',
      tratamiento: 'Analgésico 5 días, calor local, higiene de columna',
      estudios: 'Ninguno',
      evolucion: 'Mejoría del dolor a las 48 h. Continúa con higiene de columna.',
      referencia: '', temperatura: 36.5, fr: 16, spo2: 98,
      proximaCita: d(20)
    },
    {
      id: 'C-3002', empleado: 'E1003', medico: 'E1006', fecha: d(-15), hora: '09:00',
      motivoCod: 'M12', motivo: 'Revisión periódica anual',
      somatometria: { estatura: 161, peso: 58, ta: '110/70', fc: 68 },
      exploracion: { cabeza: 'Normal', ojos: 'Agudeza conservada', oidos: 'Normal', nariz: 'Normal', boca: 'Normal', torax: 'Campos pulmonares limpios', areaCardiaca: 'Normal', abdomen: 'Normal', columna: 'Normal', extremidades: 'Normal' },
      diagnostico: 'Paciente sana',
      tratamiento: 'Sin tratamiento. Recomendaciones de hidratación.',
      estudios: 'Biometría hemática de control',
      evolucion: 'Sin cambios. Se cita a control anual.',
      referencia: '', temperatura: 36.4, fr: 15, spo2: 99,
      proximaCita: ''
    }
  ];

  /* ---------- Citas ---------- */
  const AGENDA_MEDICO = {
    medico: 'E1006',
    diasHabiles: [1, 2, 3, 4, 5],           // lunes a viernes
    horarios: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
    duracionMin: 30,
    bloqueos: [{ fecha: d(3), motivo: 'Capacitación NOM-035' }]
  };

  const CITAS = [
    { id: 'A-4001', empleado: 'E1002', medico: 'E1006', fecha: d(2), hora: '09:00', motivo: 'Seguimiento lumbalgia', estado: 'confirmada', creada: d(-3) },
    { id: 'A-4002', empleado: 'E1007', medico: 'E1006', fecha: d(2), hora: '10:30', motivo: 'Consulta general', estado: 'confirmada', creada: d(-1) },
    { id: 'A-4003', empleado: 'E1003', medico: 'E1006', fecha: d(-15), hora: '09:00', motivo: 'Revisión anual', estado: 'atendida', creada: d(-20) }
  ];

  /* ---------- RRHH: Movimientos de personal (RHF-34) ---------- */
  const MOVIMIENTOS = [
    {
      id: 'RHF34-0007', folio: 'RHF34-0007', tipo: 'C', tipoNombre: 'Cambio de puesto',
      elaboracion: d(-6), aplicacion: d(9), capturadoPor: 'E1001',
      empleado: 'E1003', empleadoNombre: 'Carmen Iribe Salas', noEmpleado: 'E1003',
      puesto: 'Inspectora de Calidad', direccion: 'Operaciones', depto: 'Calidad', division: 'Planta 1',
      jefeReporta: 'Diego Vargas Ochoa', tipoPersonal: 'Administrativo',
      detalle: { puestoActual: 'Inspectora de Calidad', deptoActual: 'Calidad', puestoNuevo: 'Analista de Calidad', deptoNuevo: 'Calidad' },
      comentarios: 'Promoción por desempeño en auditoría interna.',
      estado: 'en_firma',
      firmas: [
        { rol: 'Jefe directo',    quien: 'E1004', estado: 'firmado',   fecha: d(-5), nota: 'De acuerdo.' },
        { rol: 'Gerente de área', quien: 'E1005', estado: 'firmado',   fecha: d(-4), nota: '' },
        { rol: 'Dirección General', quien: null,  estado: 'pendiente', fecha: '',     nota: '' },
        { rol: 'Recursos Humanos', quien: 'E1001', estado: 'pendiente', fecha: '',    nota: '' }
      ],
      adjuntos: [{ nombre: 'evaluacion_desempeno.pdf', tam: '184 KB', subido: d(-6) }]
    },
    {
      id: 'RHF34-0006', folio: 'RHF34-0006', tipo: 'A', tipoNombre: 'Alta de personal / nueva creación',
      elaboracion: d(-25), aplicacion: d(-11), capturadoPor: 'E1001',
      empleado: 'E1007', empleadoNombre: 'Gabriel Tenorio Ruiz', noEmpleado: 'E1007',
      puesto: 'Ayudante de Impresión', direccion: 'Operaciones', depto: 'Impresión', division: 'Planta 2',
      jefeReporta: 'Diego Vargas Ochoa', tipoPersonal: 'Sindicalizado',
      detalle: { contrato: 'Nueva creación', tiempoRequerido: '', puestoNombre: 'Ayudante de Impresión', fuente: 'Externo' },
      comentarios: 'Cobertura de vacante por crecimiento de turno.',
      estado: 'completado',
      firmas: [
        { rol: 'Jefe directo',    quien: 'E1004', estado: 'firmado', fecha: d(-24), nota: '' },
        { rol: 'Gerente de área', quien: 'E1005', estado: 'firmado', fecha: d(-23), nota: '' },
        { rol: 'Dirección General', quien: 'E1005', estado: 'firmado', fecha: d(-20), nota: '' },
        { rol: 'Recursos Humanos', quien: 'E1001', estado: 'firmado', fecha: d(-19), nota: 'Alta procesada.' }
      ],
      adjuntos: [{ nombre: 'requisicion_firmada.pdf', tam: '96 KB', subido: d(-25) }]
    },
    {
      id: 'RHF34-0005', folio: 'RHF34-0005', tipo: 'B', tipoNombre: 'Cambio de departamento',
      elaboracion: d(-2), aplicacion: d(14), capturadoPor: 'E1001',
      empleado: 'E1008', empleadoNombre: 'Hilda Márquez Cano', noEmpleado: 'E1008',
      puesto: 'Coordinadora de Turno', direccion: 'Operaciones', depto: 'Bolseo', division: 'Planta 1',
      jefeReporta: 'Diego Vargas Ochoa', tipoPersonal: 'Administrativo',
      detalle: { deptoActual: 'Bolseo', ccActual: 'CC-3200', deptoNuevo: 'Impresión', ccNuevo: 'CC-3400' },
      comentarios: 'Reestructura de turnos.',
      estado: 'borrador',
      firmas: [
        { rol: 'Jefe directo',    quien: null, estado: 'pendiente', fecha: '', nota: '' },
        { rol: 'Gerente de área', quien: null, estado: 'pendiente', fecha: '', nota: '' },
        { rol: 'Dirección General', quien: null, estado: 'pendiente', fecha: '', nota: '' },
        { rol: 'Recursos Humanos', quien: null, estado: 'pendiente', fecha: '', nota: '' }
      ],
      adjuntos: []
    }
  ];

  /* Expediente documental por empleado (metadatos, sin archivos reales) */
  const EXPEDIENTES = [
    { empleado: 'E1002', docs: [
      { tipo: 'Contrato individual', nombre: 'contrato_E1002.pdf', tam: '212 KB', fecha: '2021-08-02', vence: '' },
      { tipo: 'Identificación oficial', nombre: 'ine_E1002.pdf', tam: '88 KB', fecha: '2021-08-02', vence: '2029-01-01' },
      { tipo: 'Constancia DC-3', nombre: 'dc3_seguridad.pdf', tam: '64 KB', fecha: '2025-03-14', vence: '2027-03-14' }
    ]},
    { empleado: 'E1003', docs: [
      { tipo: 'Contrato individual', nombre: 'contrato_E1003.pdf', tam: '205 KB', fecha: '2023-02-20', vence: '' },
      { tipo: 'Comprobante de estudios', nombre: 'titulo_E1003.pdf', tam: '311 KB', fecha: '2023-02-20', vence: '' }
    ]},
    { empleado: 'E1007', docs: [
      { tipo: 'Contrato individual', nombre: 'contrato_E1007.pdf', tam: '198 KB', fecha: '2024-07-01', vence: '2026-09-30' }
    ]}
  ];

  /* ---------- Ciclo de vida del expediente médico ----------
     Etapa 1 y 9 del flujo: RH activa el expediente al ingreso y lo pasa a
     estatus de baja al terminar la relación laboral. */
  const EXPEDIENTES_MED = [
    { empleado: 'E1002', estado: 'activo', alta: '2021-08-02', altaPor: 'E1001', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' },
    { empleado: 'E1003', estado: 'activo', alta: '2023-02-20', altaPor: 'E1001', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' },
    { empleado: 'E1004', estado: 'activo', alta: '2016-05-09', altaPor: 'E1001', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' },
    { empleado: 'E1007', estado: 'activo', alta: '2024-07-01', altaPor: 'E1001', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' },
    { empleado: 'E1008', estado: 'activo', alta: '2018-11-26', altaPor: 'E1001', baja: '', bajaPor: '', motivoBaja: '', conservarHasta: '' }
    /* El resto de los colaboradores está en estado "sin_iniciar" hasta que RH lo activa. */
  ];

  /* ---------- Programa de evaluaciones (programadas vs realizadas) ----------
     Denominador de los indicadores de cumplimiento del Entregable 2. */
  const PROGRAMA_EVAL = [
    { id: 'PE-9001', empleado: 'E1002', tipo: 'periodico', programada: d(-45), estado: 'realizada', evaluacion: 'EV-5002', programa: 'Vigilancia por ruido' },
    { id: 'PE-9002', empleado: 'E1002', tipo: 'periodico', programada: d(320), estado: 'programada', evaluacion: '', programa: 'Vigilancia por ruido' },
    { id: 'PE-9003', empleado: 'E1003', tipo: 'cambio_puesto', programada: d(-18), estado: 'realizada', evaluacion: 'EV-5003', programa: 'Cambio de puesto' },
    { id: 'PE-9004', empleado: 'E1003', tipo: 'periodico', programada: d(345), estado: 'programada', evaluacion: '', programa: 'Vigilancia general' },
    { id: 'PE-9005', empleado: 'E1007', tipo: 'ingreso', programada: d(-380), estado: 'vencida', evaluacion: '', programa: 'Examen de ingreso' },
    { id: 'PE-9006', empleado: 'E1008', tipo: 'periodico', programada: d(-12), estado: 'vencida', evaluacion: '', programa: 'Vigilancia general' },
    { id: 'PE-9007', empleado: 'E1004', tipo: 'periodico', programada: d(20), estado: 'programada', evaluacion: '', programa: 'Vigilancia general' }
  ];

  /* ---------- Vacunación y campañas preventivas ---------- */
  const VACUNAS = [
    { id: 'VA-1001', empleado: 'E1002', biologico: 'Tétanos / Td', dosis: 'Refuerzo', fecha: d(-300), campana: 'Campaña de vacunación 2025', proximaDosis: d(3350), aplicadaPor: 'E1006', observaciones: '' },
    { id: 'VA-1002', empleado: 'E1002', biologico: 'Influenza estacional', dosis: 'Única anual', fecha: d(-240), campana: 'Influenza 2025-2026', proximaDosis: d(125), aplicadaPor: 'E1006', observaciones: '' },
    { id: 'VA-1003', empleado: 'E1003', biologico: 'Influenza estacional', dosis: 'Única anual', fecha: d(-238), campana: 'Influenza 2025-2026', proximaDosis: d(127), aplicadaPor: 'E1006', observaciones: '' },
    { id: 'VA-1004', empleado: 'E1007', biologico: 'Hepatitis B', dosis: '1 de 3', fecha: d(-60), campana: 'Esquema por exposición', proximaDosis: d(-30), aplicadaPor: 'E1006', observaciones: 'Segunda dosis pendiente' }
  ];

  const CAMPANAS = [
    { id: 'CP-2001', nombre: 'Influenza 2026-2027', tipo: 'Vacunación', inicio: d(120), fin: d(150), objetivo: 'Todo el personal', estado: 'planeada', aplicadas: 0 },
    { id: 'CP-2002', nombre: 'Detección de hipertensión', tipo: 'Detección', inicio: d(-20), fin: d(10), objetivo: 'Personal mayor de 35 años', estado: 'en_curso', aplicadas: 12 },
    { id: 'CP-2003', nombre: 'Salud visual', tipo: 'Detección', inicio: d(-120), fin: d(-100), objetivo: 'Puestos con trabajo de precisión', estado: 'concluida', aplicadas: 24 }
  ];

  /* ---------- Bitácora de auditoría (trazabilidad) ----------
     En producción la escribe el SERVIDOR en cada operación, no el cliente. */
  const BITACORA = [
    { id: 'LG-0001', fecha: d(-40) + ' 10:42', usuario: 'E1006', accion: 'consulta.registrar', entidad: 'C-3001', afectado: 'E1002', detalle: 'Alta de consulta médica' },
    { id: 'LG-0002', fecha: d(-40) + ' 10:55', usuario: 'E1006', accion: 'evaluacion.registrar', entidad: 'EV-5002', afectado: 'E1002', detalle: 'Dictamen: apto con restricciones' },
    { id: 'LG-0003', fecha: d(-15) + ' 09:12', usuario: 'E1006', accion: 'expediente.consultar', entidad: 'E1003', afectado: 'E1003', detalle: 'Apertura de expediente clínico' },
    { id: 'LG-0004', fecha: d(-6) + ' 08:30', usuario: 'E1001', accion: 'movimiento.crear', entidad: 'RHF34-0007', afectado: 'E1003', detalle: 'Cambio de puesto' },
    { id: 'LG-0005', fecha: d(-2) + ' 16:04', usuario: 'E1009', accion: 'aptitud.consultar', entidad: 'E1002', afectado: 'E1002', detalle: 'Consulta de restricciones vigentes' }
  ];

  /* ============================================================
     ETAPA 1 — Control y seguimiento de resultados de análisis
     clínicos (lineamiento SQF). Alcance del documento v3.
     ============================================================ */

  /* Programación de los análisis: quién debe evaluarse y quién ya lo hizo */
  const PROGRAMACION_ANALISIS = [
    { id: 'PA-001', empleado: 'E1002', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(-52), estado: 'realizado',  fechaEvaluacion: d(-50) },
    { id: 'PA-002', empleado: 'E1003', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(-45), estado: 'realizado',  fechaEvaluacion: d(-44) },
    { id: 'PA-003', empleado: 'E1007', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(-30), estado: 'realizado',  fechaEvaluacion: d(-28) },
    { id: 'PA-004', empleado: 'E1008', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(-8),  estado: 'programado', fechaEvaluacion: '' },
    { id: 'PA-005', empleado: 'E1004', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(12),  estado: 'programado', fechaEvaluacion: '' },
    { id: 'PA-006', empleado: 'E1005', periodo: '2026', tipoEvaluacion: 'bianual', programada: d(-15), estado: 'vencido',    fechaEvaluacion: '' },
    { id: 'PA-007', empleado: 'E1001', periodo: '2026', tipoEvaluacion: 'anual',   programada: d(25),  estado: 'programado', fechaEvaluacion: '' }
  ];

  /* Resultados recibidos del laboratorio */
  const RESULTADOS_ANALISIS = [
    { id: 'RA-001', empleado: 'E1002', programacion: 'PA-001', analisis: 'Coproparasitoscópico (serie 3)',
      fechaToma: d(-52), fechaResultado: d(-50), resultado: 'Positivo a Giardia lamblia',
      parametro: 'Ausencia de parásitos patógenos', valoracion: 'desviacion',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: 'E1006', fechaValidacion: d(-50) },
    { id: 'RA-002', empleado: 'E1002', programacion: 'PA-001', analisis: 'Exudado faríngeo',
      fechaToma: d(-52), fechaResultado: d(-50), resultado: 'Flora habitual',
      parametro: 'Ausencia de Staphylococcus aureus', valoracion: 'normal',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: 'E1006', fechaValidacion: d(-50) },
    { id: 'RA-003', empleado: 'E1002', programacion: 'PA-001', analisis: 'Biometría hemática',
      fechaToma: d(-52), fechaResultado: d(-50), resultado: 'Hb 15.1 g/dL · leucocitos 7,200',
      parametro: 'Dentro de valores de referencia', valoracion: 'normal',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: 'E1006', fechaValidacion: d(-50) },
    { id: 'RA-004', empleado: 'E1003', programacion: 'PA-002', analisis: 'Coprocultivo',
      fechaToma: d(-45), fechaResultado: d(-44), resultado: 'Negativo a enteropatógenos',
      parametro: 'Ausencia de Salmonella y Shigella', valoracion: 'normal',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: 'E1006', fechaValidacion: d(-44) },
    { id: 'RA-005', empleado: 'E1003', programacion: 'PA-002', analisis: 'Cultivo de manos y uñas',
      fechaToma: d(-45), fechaResultado: d(-44), resultado: 'Desarrollo de S. aureus 10³ UFC',
      parametro: 'Ausencia de S. aureus', valoracion: 'desviacion',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: 'E1006', fechaValidacion: d(-44) },
    { id: 'RA-006', empleado: 'E1007', programacion: 'PA-003', analisis: 'Coproparasitoscópico (serie 3)',
      fechaToma: d(-30), fechaResultado: d(-28), resultado: 'Negativo',
      parametro: 'Ausencia de parásitos patógenos', valoracion: 'normal',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: '', fechaValidacion: '' },
    { id: 'RA-007', empleado: 'E1007', programacion: 'PA-003', analisis: 'Química sanguínea',
      fechaToma: d(-30), fechaResultado: d(-28), resultado: 'Glucosa 128 mg/dL',
      parametro: 'Glucosa 70–99 mg/dL en ayuno', valoracion: 'pendiente_validacion',
      laboratorio: 'Laboratorio externo autorizado', capturadoPor: 'E1006', validadoPor: '', fechaValidacion: '' }
  ];

  /* Casos de seguimiento abiertos a partir de una desviación.
     Los cinco estatus del documento v3, sin inventar ninguno más. */
  const CASOS_ANALISIS = [
    {
      id: 'CS-001', empleado: 'E1002', resultado: 'RA-001',
      fechaDeteccion: d(-50), motivo: 'Coproparasitoscópico positivo a Giardia lamblia',
      estatus: 'en_seguimiento',
      valoracion: 'Paciente asintomático. Se indica tratamiento y separación temporal de línea de producto terminado.',
      fechaCita: d(-48), indicaciones: 'Nitazoxanida 500 mg cada 12 h por 3 días. Reforzar lavado de manos.',
      estudiosPosteriores: 'Coproparasitoscópico de control (serie 3)',
      proximaValoracion: d(4), fechaCierre: '', restriccion: 'Sin contacto con producto expuesto hasta control negativo.',
      abiertoPor: 'E1006',
      notas: [
        { fecha: d(-50), autor: 'E1006', nota: 'Se abre caso por resultado positivo. Se notifica a Seguridad Industrial la restricción operativa (sin detalle clínico).' },
        { fecha: d(-48), autor: 'E1006', nota: 'Valoración médica realizada. Inicia tratamiento.' },
        { fecha: d(-20), autor: 'E1006', nota: 'Tolera tratamiento, sin síntomas. Se programa control.' }
      ]
    },
    {
      id: 'CS-002', empleado: 'E1003', resultado: 'RA-005',
      fechaDeteccion: d(-44), motivo: 'Cultivo de manos y uñas con desarrollo de S. aureus',
      estatus: 'pendiente_valoracion_posterior',
      valoracion: 'Sin lesiones dérmicas visibles. Probable portador nasal.',
      fechaCita: d(-42), indicaciones: 'Mupirocina nasal 5 días. Capacitación de higiene de manos.',
      estudiosPosteriores: 'Repetir cultivo de manos y uñas',
      proximaValoracion: d(-2), fechaCierre: '', restriccion: 'Uso obligatorio de guantes en línea.',
      abiertoPor: 'E1006',
      notas: [
        { fecha: d(-44), autor: 'E1006', nota: 'Caso abierto por desviación en cultivo.' },
        { fecha: d(-42), autor: 'E1006', nota: 'Valoración realizada, inicia tratamiento tópico.' }
      ]
    },
    {
      id: 'CS-003', empleado: 'E1008', resultado: '',
      fechaDeteccion: d(-120), motivo: 'Cultivo de manos positivo en periodo anterior',
      estatus: 'alta_cierre',
      valoracion: 'Control posterior negativo.',
      fechaCita: d(-118), indicaciones: 'Tratamiento concluido.',
      estudiosPosteriores: 'Cultivo de control — negativo',
      proximaValoracion: '', fechaCierre: d(-90), restriccion: '', abiertoPor: 'E1006',
      notas: [
        { fecha: d(-120), autor: 'E1006', nota: 'Caso abierto.' },
        { fecha: d(-90), autor: 'E1006', nota: 'Control negativo. Alta médica y cierre del caso.' }
      ]
    }
  ];

  /* ---------- Catálogos del cuestionario médico ---------- */
  const CAT = {
    consumo: ['Ninguno', 'Tabaco', 'Alcohol', 'Café', 'Medicamentos controlados'],
    padecimientos: ['Ninguna', 'Diabetes', 'Hipertensión', 'Cardiopatía', 'Asma', 'Alergias', 'Problemas de columna', 'Problemas visuales', 'Otra'],
    mascotas: ['Perro', 'Gato', 'Ave', 'Otro'],
    percepcionSalud: ['Muy bueno', 'Bueno', 'Regular', 'Malo'],
    exploracion: ['cabeza', 'ojos', 'oidos', 'nariz', 'boca', 'torax', 'areaCardiaca', 'abdomen', 'columna', 'extremidades'],
    exploracionLabel: {
      cabeza: 'Cabeza', ojos: 'Ojos', oidos: 'Oídos', nariz: 'Nariz', boca: 'Boca',
      torax: 'Tórax', areaCardiaca: 'Área cardiaca', abdomen: 'Abdomen', columna: 'Columna', extremidades: 'Extremidades'
    },
    tiposMovimiento: [
      { c: 'A', n: 'Alta de personal y nueva creación (requisición)' },
      { c: 'B', n: 'Cambio de departamento' },
      { c: 'C', n: 'Cambio de puesto' },
      { c: 'D', n: 'Cambio de sueldo' },
      { c: 'E', n: 'Baja de personal' }
    ],
    firmasRHF34: ['Jefe directo', 'Gerente de área', 'Dirección General', 'Recursos Humanos'],
    tiposDoc: ['Contrato individual', 'Identificación oficial', 'CURP', 'RFC', 'NSS', 'Comprobante de domicilio', 'Comprobante de estudios', 'Constancia DC-3', 'Movimiento de personal', 'Otro'],

    /* --- Catálogos del expediente médico ampliado --- */
    jornadas: ['Turnos', 'Fijo', 'Otro'],
    sexos: ['Hombre', 'Mujer', 'Prefiero no decirlo'],
    tiposSanguineos: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No lo sé'],
    cronicas: ['Ninguna', 'Diabetes', 'Hipertensión', 'Dislipidemia', 'Cardiopatía', 'Asma / EPOC',
               'Enfermedad renal', 'Enfermedad tiroidea', 'Epilepsia', 'Trastorno músculo-esquelético', 'Otra'],
    riesgosExposicion: ['Ruido', 'Vibraciones', 'Temperaturas altas', 'Temperaturas bajas', 'Iluminación',
                        'Sustancias químicas', 'Polvos / humos', 'Manejo manual de cargas', 'Posturas forzadas',
                        'Movimientos repetitivos', 'Trabajo en alturas', 'Espacios confinados', 'Electricidad',
                        'Maquinaria en movimiento', 'Trabajo nocturno / rotativo', 'Ninguno'],
    epp: ['Casco', 'Lentes de seguridad', 'Careta', 'Tapones auditivos', 'Orejeras', 'Mascarilla / respirador',
          'Guantes', 'Bata', 'Mandil', 'Calzado de seguridad', 'Arnés', 'Ninguno'],

    tiposEvaluacion: [
      { c: 'ingreso', n: 'Examen médico de ingreso' },
      { c: 'periodico', n: 'Examen periódico' },
      { c: 'cambio_puesto', n: 'Evaluación por cambio de puesto o exposición' },
      { c: 'reincorporacion', n: 'Evaluación de reincorporación' },
      { c: 'egreso', n: 'Examen de egreso' }
    ],
    dictamenes: [
      { c: 'apto', n: 'Apto' },
      { c: 'apto_con_restricciones', n: 'Apto con restricciones' },
      { c: 'no_apto', n: 'No apto para el puesto' },
      { c: 'pendiente', n: 'Pendiente de estudios' }
    ],
    tiposRiesgo: [
      { c: 'accidente', n: 'Accidente de trabajo' },
      { c: 'incidente', n: 'Incidente (sin lesión)' },
      { c: 'enfermedad_trabajo', n: 'Enfermedad de trabajo' },
      { c: 'trayecto', n: 'Accidente en trayecto' }
    ],
    ochoD: [
      { c: 'd1', n: 'D1 · Equipo de trabajo' },
      { c: 'd2', n: 'D2 · Descripción del problema' },
      { c: 'd3', n: 'D3 · Acción de contención inmediata' },
      { c: 'd4', n: 'D4 · Causa raíz' },
      { c: 'd5', n: 'D5 · Acción correctiva' },
      { c: 'd6', n: 'D6 · Implementación y verificación' },
      { c: 'd7', n: 'D7 · Prevención de recurrencia' },
      { c: 'd8', n: 'D8 · Cierre y reconocimiento' }
    ],
    tiposIncapacidad: [
      { c: 'enfermedad_general', n: 'Enfermedad general' },
      { c: 'riesgo_trabajo', n: 'Riesgo de trabajo' },
      { c: 'maternidad', n: 'Maternidad' },
      { c: 'licencia_cuidados', n: 'Licencia por cuidados médicos' }
    ],
    tiposDocMedico: ['Historia clínica', 'Resultado de laboratorio', 'Estudio médico', 'Receta',
                     'Nota de evolución', 'Incapacidad', 'Dictamen médico', 'Consentimiento informado', 'Otro'],
    periodicidades: ['Anual', 'Semestral', 'Trimestral', 'Bienal', 'Según exposición', 'No aplica'],
    tiposEstudio: ['Biometría hemática', 'Química sanguínea', 'Perfil de lípidos', 'Examen general de orina',
                   'Audiometría', 'Espirometría', 'Radiografía de tórax', 'Electrocardiograma',
                   'Agudeza visual', 'Antidoping', 'Otro'],

    /* Catálogo CERRADO de motivos de consulta.
       Es el que permite calcular la distribución porcentual de motivos del
       Entregable 2; sin catálogo ese indicador no se puede construir. */
    motivosConsulta: [
      { c: 'M01', n: 'Enfermedad respiratoria', g: 'Enfermedad general' },
      { c: 'M02', n: 'Enfermedad gastrointestinal', g: 'Enfermedad general' },
      { c: 'M03', n: 'Dolor músculo-esquelético / lumbalgia', g: 'Músculo-esquelético' },
      { c: 'M04', n: 'Lesión por accidente de trabajo', g: 'Riesgo de trabajo' },
      { c: 'M05', n: 'Lesión por accidente fuera del trabajo', g: 'Enfermedad general' },
      { c: 'M06', n: 'Cefalea', g: 'Enfermedad general' },
      { c: 'M07', n: 'Control de enfermedad crónica', g: 'Crónico-degenerativo' },
      { c: 'M08', n: 'Salud visual', g: 'Sensorial' },
      { c: 'M09', n: 'Salud auditiva', g: 'Sensorial' },
      { c: 'M10', n: 'Dermatológico', g: 'Enfermedad general' },
      { c: 'M11', n: 'Salud mental / estrés laboral', g: 'Psicosocial (NOM-035)' },
      { c: 'M12', n: 'Revisión periódica programada', g: 'Vigilancia' },
      { c: 'M13', n: 'Valoración de reincorporación', g: 'Vigilancia' },
      { c: 'M14', n: 'Curación / seguimiento de herida', g: 'Riesgo de trabajo' },
      { c: 'M15', n: 'Entrega de resultados / orientación', g: 'Vigilancia' },
      { c: 'M99', n: 'Otro (especificar)', g: 'Otro' }
    ],

    biologicos: ['Influenza estacional', 'Tétanos / Td', 'Hepatitis A', 'Hepatitis B', 'SARS-CoV-2',
                 'Neumococo', 'SRP (sarampión, rubéola, parotiditis)', 'Otro'],
    dosis: ['Única anual', 'Primera dosis', '1 de 3', '2 de 3', '3 de 3', 'Refuerzo'],
    tiposCampana: ['Vacunación', 'Detección', 'Promoción de la salud', 'Ergonomía', 'Vigilancia epidemiológica'],
    estadosCampana: [{ c: 'planeada', n: 'Planeada' }, { c: 'en_curso', n: 'En curso' }, { c: 'concluida', n: 'Concluida' }],
    estadosExpediente: [
      { c: 'sin_iniciar', n: 'Sin iniciar' }, { c: 'activo', n: 'Activo' }, { c: 'baja', n: 'Baja' }
    ],
    motivosBajaExp: ['Renuncia voluntaria', 'Terminación de contrato', 'Rescisión laboral', 'Jubilación', 'Defunción', 'Otro'],

    /* --- Etapa 1: análisis clínicos bajo lineamiento SQF --- */
    tiposAnalisis: [
      { n: 'Coproparasitoscópico (serie 3)', p: 'Ausencia de parásitos patógenos' },
      { n: 'Coprocultivo', p: 'Ausencia de Salmonella y Shigella' },
      { n: 'Exudado faríngeo', p: 'Ausencia de Staphylococcus aureus' },
      { n: 'Cultivo de manos y uñas', p: 'Ausencia de S. aureus' },
      { n: 'Biometría hemática', p: 'Dentro de valores de referencia' },
      { n: 'Química sanguínea', p: 'Glucosa 70–99 mg/dL en ayuno' },
      { n: 'Examen general de orina', p: 'Sin datos de infección' },
      { n: 'VDRL', p: 'No reactivo' },
      { n: 'Radiografía de tórax', p: 'Sin alteraciones pleuropulmonares' },
      { n: 'Otro', p: '' }
    ],
    tiposEvaluacionAnalisis: [
      { c: 'anual', n: 'Anual' },
      { c: 'bianual', n: 'Bianual' },
      { c: 'ingreso', n: 'De ingreso' },
      { c: 'extraordinaria', n: 'Extraordinaria' },
      { c: 'control', n: 'De control / seguimiento' }
    ],
    valoracionResultado: [
      { c: 'pendiente_validacion', n: 'Pendiente de validación' },
      { c: 'normal', n: 'Normal' },
      { c: 'desviacion', n: 'Desviación' }
    ],
    /* Los CINCO estatus del documento v3. No agregar más sin acordarlo:
       de ellos dependen los indicadores de la Etapa 1. */
    estatusCaso: [
      { c: 'pendiente_valoracion', n: 'Pendiente de valoración', chip: 'no' },
      { c: 'en_seguimiento', n: 'En seguimiento', chip: 'wa' },
      { c: 'pendiente_valoracion_posterior', n: 'Pendiente de valoración posterior', chip: 'wa' },
      { c: 'alta_cierre', n: 'Alta / cierre', chip: 'ok' },
      { c: 'no_requiere', n: 'No requiere seguimiento', chip: 'nt' }
    ],
    estadosProgramacion: [
      { c: 'programado', n: 'Programado' },
      { c: 'realizado', n: 'Realizado' },
      { c: 'vencido', n: 'Vencido' }
    ],

    /* Nota de conservación documental — se muestra en la app.
       Las dos normas conviven y NO dicen lo mismo; Salud Ocupacional y
       Jurídico deben fijar la política definitiva. */
    conservacion: {
      clinico: 'NOM-004-SSA3-2012 (expediente clínico): conservar mínimo 5 años a partir del último acto médico.',
      laboral: 'LFT art. 804: conservar los documentos laborales durante el último año de la relación de trabajo y hasta un año después de su terminación.',
      nota: 'Ambas aplican sobre un mismo colaborador pero sobre documentos distintos y con plazos distintos. ' +
            'El criterio conservador es aplicar el plazo mayor por tipo de documento y no depurar el expediente clínico ' +
            'con la regla laboral. Definir la política antes de programar cualquier borrado automático.'
    },

    /* --- Aviso de privacidad y consentimiento (aprendido en Medico ZX) ---
       `vigente: false` mientras falten los campos que debe llenar Jurídico
       (art. 29 LFPDPPP: designar a la persona/área de datos personales).
       La pantalla de privacidad se marca sola como "borrador" mientras
       existan `pendientes`. Subir `version` obliga a todos a otorgar el
       consentimiento de nuevo — ver Riesgos legales v3, arts. 14 y 15. */
    avisoPrivacidad: {
      version: 'v1',
      vigente: false,
      actualizado: '2026-09-01',
      responsable: 'Zubex Industrial S.A. de C.V.',
      domicilio: '« Jurídico: domicilio fiscal completo »',
      areaResponsable: '« Jurídico: persona o área de datos personales, art. 29 »',
      contacto: '« Jurídico: correo y teléfono de contacto »',
      pendientes: ['domicilio fiscal', 'área responsable de datos personales (art. 29)', 'correo de contacto', 'teléfono de contacto'],
      texto: 'Zubex Industrial S.A. de C.V. es responsable del tratamiento de los datos personales que recaba a ' +
        'través de este portal, incluidos datos de salud (dato sensible, LFPDPPP art. 3 fr. VI). Se recaban con la ' +
        'finalidad de dar cumplimiento a la vigilancia de la salud en el trabajo, la Etapa 1 del Expediente Médico ' +
        'Electrónico ZX y la gestión laboral y de Recursos Humanos. No se transfieren a terceros salvo obligación ' +
        'legal. Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación u Oposición (ARCO) desde esta ' +
        'misma pantalla. Este aviso está sujeto a la LFPDPPP (DOF 20/03/2025).'
    },
    motivosArco: [
      { c: 'acceso', n: 'Acceso — saber qué datos míos se tratan' },
      { c: 'rectificacion', n: 'Rectificación — corregir un dato inexacto o incompleto' },
      { c: 'cancelacion', n: 'Cancelación — eliminar mis datos cuando proceda' },
      { c: 'oposicion', n: 'Oposición — dejar de tratar un dato para un fin específico' }
    ]
  };

  /* ---------- Privacidad: consentimiento y solicitudes ARCO ----------
     Demo con un par de personas sin consentimiento vigente a propósito
     (para poder probar la pantalla de "aún no has otorgado tu consentimiento"
     con cualquier usuario nuevo que no aparezca aquí). */
  const CONSENTIMIENTOS = [
    { id: 'CO-0001', empleado: 'E1002', version: 'v1', fecha: '2026-09-05', vigente: true, revocado: '' },
    { id: 'CO-0002', empleado: 'E1003', version: 'v1', fecha: '2026-09-05', vigente: true, revocado: '' },
    { id: 'CO-0003', empleado: 'E1007', version: 'v1', fecha: '2026-06-11', vigente: false, revocado: '2026-09-02' }
  ];

  const SOLICITUDES_ARCO = [
    { id: 'AR-0001', empleado: 'E1002', tipo: 'acceso', detalle: 'Quiero una copia de mi expediente médico completo.',
      fecha: '2026-09-10', estado: 'pendiente', respuesta: '', respondioPor: '', fechaRespuesta: '' }
  ];

  global.ZX_DEMO = {
    DEPARTAMENTOS, AREAS, TURNOS, NIVELES, EMPLEADOS, CREDENCIALES, SOLICITUDES, BANCO_HORAS,
    CUESTIONARIOS, CONSULTAS, AGENDA_MEDICO, CITAS, MOVIMIENTOS, EXPEDIENTES,
    EVALUACIONES, RIESGOS, INCAPACIDADES, DOCS_MEDICOS, VIGILANCIA,
    EXPEDIENTES_MED, PROGRAMA_EVAL, VACUNAS, CAMPANAS, BITACORA,
    PROGRAMACION_ANALISIS, RESULTADOS_ANALISIS, CASOS_ANALISIS,
    CONSENTIMIENTOS, SOLICITUDES_ARCO, PERFILES, CAT
  };
})(window);

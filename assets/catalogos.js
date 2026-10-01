/* ============================================================
   Portal Zubex — Catálogos de negocio (listas fijas)
   ------------------------------------------------------------
   Opciones de los formularios y reglas que no cambian con los datos:
   niveles jerárquicos, tipos de riesgo y de incapacidad, dictámenes,
   estatus de caso, motivos de consulta, etc.

   NO contiene datos de personas ni datos de ejemplo. Departamentos,
   áreas y turnos tampoco están aquí: son catálogos vivos en la base
   de datos (los agrega la importación desde IBIX).
   El aviso de privacidad tampoco: vive en la tabla aviso_privacidad.
   ============================================================ */
(function (global) {
  'use strict';
  global.ZX_CAT = {
    "NIVELES": {
      "empleado": {
        "nombre": "Empleado"
      },
      "coordinador": {
        "nombre": "Coordinador"
      },
      "supervisor": {
        "nombre": "Jefe / Gerente"
      }
    },
    "consumo": [
      "Ninguno",
      "Tabaco",
      "Alcohol",
      "Café",
      "Medicamentos controlados"
    ],
    "padecimientos": [
      "Ninguna",
      "Diabetes",
      "Hipertensión",
      "Cardiopatía",
      "Asma",
      "Alergias",
      "Problemas de columna",
      "Problemas visuales",
      "Otra"
    ],
    "mascotas": [
      "Perro",
      "Gato",
      "Ave",
      "Otro"
    ],
    "percepcionSalud": [
      "Muy bueno",
      "Bueno",
      "Regular",
      "Malo"
    ],
    "exploracion": [
      "cabeza",
      "ojos",
      "oidos",
      "nariz",
      "boca",
      "torax",
      "areaCardiaca",
      "abdomen",
      "columna",
      "extremidades"
    ],
    "exploracionLabel": {
      "cabeza": "Cabeza",
      "ojos": "Ojos",
      "oidos": "Oídos",
      "nariz": "Nariz",
      "boca": "Boca",
      "torax": "Tórax",
      "areaCardiaca": "Área cardiaca",
      "abdomen": "Abdomen",
      "columna": "Columna",
      "extremidades": "Extremidades"
    },
    "tiposMovimiento": [
      {
        "c": "A",
        "n": "Alta de personal y nueva creación (requisición)"
      },
      {
        "c": "B",
        "n": "Cambio de departamento"
      },
      {
        "c": "C",
        "n": "Cambio de puesto"
      },
      {
        "c": "D",
        "n": "Cambio de sueldo"
      },
      {
        "c": "E",
        "n": "Baja de personal"
      }
    ],
    "firmasRHF34": [
      "Jefe directo",
      "Gerente de área",
      "Dirección General",
      "Recursos Humanos"
    ],
    "tiposDoc": [
      "Contrato individual",
      "Identificación oficial",
      "CURP",
      "RFC",
      "NSS",
      "Comprobante de domicilio",
      "Comprobante de estudios",
      "Constancia DC-3",
      "Movimiento de personal",
      "Otro"
    ],
    "jornadas": [
      "Turnos",
      "Fijo",
      "Otro"
    ],
    "sexos": [
      "Hombre",
      "Mujer",
      "Prefiero no decirlo"
    ],
    "tiposSanguineos": [
      "O+",
      "O-",
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "No lo sé"
    ],
    "cronicas": [
      "Ninguna",
      "Diabetes",
      "Hipertensión",
      "Dislipidemia",
      "Cardiopatía",
      "Asma / EPOC",
      "Enfermedad renal",
      "Enfermedad tiroidea",
      "Epilepsia",
      "Trastorno músculo-esquelético",
      "Otra"
    ],
    "riesgosExposicion": [
      "Ruido",
      "Vibraciones",
      "Temperaturas altas",
      "Temperaturas bajas",
      "Iluminación",
      "Sustancias químicas",
      "Polvos / humos",
      "Manejo manual de cargas",
      "Posturas forzadas",
      "Movimientos repetitivos",
      "Trabajo en alturas",
      "Espacios confinados",
      "Electricidad",
      "Maquinaria en movimiento",
      "Trabajo nocturno / rotativo",
      "Ninguno"
    ],
    "epp": [
      "Casco",
      "Lentes de seguridad",
      "Careta",
      "Tapones auditivos",
      "Orejeras",
      "Mascarilla / respirador",
      "Guantes",
      "Bata",
      "Mandil",
      "Calzado de seguridad",
      "Arnés",
      "Ninguno"
    ],
    "tiposEvaluacion": [
      {
        "c": "ingreso",
        "n": "Examen médico de ingreso"
      },
      {
        "c": "periodico",
        "n": "Examen periódico"
      },
      {
        "c": "cambio_puesto",
        "n": "Evaluación por cambio de puesto o exposición"
      },
      {
        "c": "reincorporacion",
        "n": "Evaluación de reincorporación"
      },
      {
        "c": "egreso",
        "n": "Examen de egreso"
      }
    ],
    "dictamenes": [
      {
        "c": "apto",
        "n": "Apto"
      },
      {
        "c": "apto_con_restricciones",
        "n": "Apto con restricciones"
      },
      {
        "c": "no_apto",
        "n": "No apto para el puesto"
      },
      {
        "c": "pendiente",
        "n": "Pendiente de estudios"
      }
    ],
    "tiposRiesgo": [
      {
        "c": "accidente",
        "n": "Accidente de trabajo"
      },
      {
        "c": "incidente",
        "n": "Incidente (sin lesión)"
      },
      {
        "c": "enfermedad_trabajo",
        "n": "Enfermedad de trabajo"
      },
      {
        "c": "trayecto",
        "n": "Accidente en trayecto"
      }
    ],
    "ochoD": [
      {
        "c": "d1",
        "n": "D1 · Equipo de trabajo"
      },
      {
        "c": "d2",
        "n": "D2 · Descripción del problema"
      },
      {
        "c": "d3",
        "n": "D3 · Acción de contención inmediata"
      },
      {
        "c": "d4",
        "n": "D4 · Causa raíz"
      },
      {
        "c": "d5",
        "n": "D5 · Acción correctiva"
      },
      {
        "c": "d6",
        "n": "D6 · Implementación y verificación"
      },
      {
        "c": "d7",
        "n": "D7 · Prevención de recurrencia"
      },
      {
        "c": "d8",
        "n": "D8 · Cierre y reconocimiento"
      }
    ],
    "tiposIncapacidad": [
      {
        "c": "enfermedad_general",
        "n": "Enfermedad general"
      },
      {
        "c": "riesgo_trabajo",
        "n": "Riesgo de trabajo"
      },
      {
        "c": "maternidad",
        "n": "Maternidad"
      },
      {
        "c": "licencia_cuidados",
        "n": "Licencia por cuidados médicos"
      }
    ],
    "tiposDocMedico": [
      "Historia clínica",
      "Resultado de laboratorio",
      "Estudio médico",
      "Receta",
      "Nota de evolución",
      "Incapacidad",
      "Dictamen médico",
      "Consentimiento informado",
      "Otro"
    ],
    "periodicidades": [
      "Anual",
      "Semestral",
      "Trimestral",
      "Bienal",
      "Según exposición",
      "No aplica"
    ],
    "tiposEstudio": [
      "Biometría hemática",
      "Química sanguínea",
      "Perfil de lípidos",
      "Examen general de orina",
      "Audiometría",
      "Espirometría",
      "Radiografía de tórax",
      "Electrocardiograma",
      "Agudeza visual",
      "Antidoping",
      "Otro"
    ],
    "motivosConsulta": [
      {
        "c": "M01",
        "n": "Enfermedad respiratoria",
        "g": "Enfermedad general"
      },
      {
        "c": "M02",
        "n": "Enfermedad gastrointestinal",
        "g": "Enfermedad general"
      },
      {
        "c": "M03",
        "n": "Dolor músculo-esquelético / lumbalgia",
        "g": "Músculo-esquelético"
      },
      {
        "c": "M04",
        "n": "Lesión por accidente de trabajo",
        "g": "Riesgo de trabajo"
      },
      {
        "c": "M05",
        "n": "Lesión por accidente fuera del trabajo",
        "g": "Enfermedad general"
      },
      {
        "c": "M06",
        "n": "Cefalea",
        "g": "Enfermedad general"
      },
      {
        "c": "M07",
        "n": "Control de enfermedad crónica",
        "g": "Crónico-degenerativo"
      },
      {
        "c": "M08",
        "n": "Salud visual",
        "g": "Sensorial"
      },
      {
        "c": "M09",
        "n": "Salud auditiva",
        "g": "Sensorial"
      },
      {
        "c": "M10",
        "n": "Dermatológico",
        "g": "Enfermedad general"
      },
      {
        "c": "M11",
        "n": "Salud mental / estrés laboral",
        "g": "Psicosocial (NOM-035)"
      },
      {
        "c": "M12",
        "n": "Revisión periódica programada",
        "g": "Vigilancia"
      },
      {
        "c": "M13",
        "n": "Valoración de reincorporación",
        "g": "Vigilancia"
      },
      {
        "c": "M14",
        "n": "Curación / seguimiento de herida",
        "g": "Riesgo de trabajo"
      },
      {
        "c": "M15",
        "n": "Entrega de resultados / orientación",
        "g": "Vigilancia"
      },
      {
        "c": "M99",
        "n": "Otro (especificar)",
        "g": "Otro"
      }
    ],
    "biologicos": [
      "Influenza estacional",
      "Tétanos / Td",
      "Hepatitis A",
      "Hepatitis B",
      "SARS-CoV-2",
      "Neumococo",
      "SRP (sarampión, rubéola, parotiditis)",
      "Otro"
    ],
    "dosis": [
      "Única anual",
      "Primera dosis",
      "1 de 3",
      "2 de 3",
      "3 de 3",
      "Refuerzo"
    ],
    "tiposCampana": [
      "Vacunación",
      "Detección",
      "Promoción de la salud",
      "Ergonomía",
      "Vigilancia epidemiológica"
    ],
    "estadosCampana": [
      {
        "c": "planeada",
        "n": "Planeada"
      },
      {
        "c": "en_curso",
        "n": "En curso"
      },
      {
        "c": "concluida",
        "n": "Concluida"
      }
    ],
    "estadosExpediente": [
      {
        "c": "sin_iniciar",
        "n": "Sin iniciar"
      },
      {
        "c": "activo",
        "n": "Activo"
      },
      {
        "c": "baja",
        "n": "Baja"
      }
    ],
    "motivosBajaExp": [
      "Renuncia voluntaria",
      "Terminación de contrato",
      "Rescisión laboral",
      "Jubilación",
      "Defunción",
      "Otro"
    ],
    "tiposAnalisis": [
      {
        "n": "Coproparasitoscópico (serie 3)",
        "p": "Ausencia de parásitos patógenos"
      },
      {
        "n": "Coprocultivo",
        "p": "Ausencia de Salmonella y Shigella"
      },
      {
        "n": "Exudado faríngeo",
        "p": "Ausencia de Staphylococcus aureus"
      },
      {
        "n": "Cultivo de manos y uñas",
        "p": "Ausencia de S. aureus"
      },
      {
        "n": "Biometría hemática",
        "p": "Dentro de valores de referencia"
      },
      {
        "n": "Química sanguínea",
        "p": "Glucosa 70–99 mg/dL en ayuno"
      },
      {
        "n": "Examen general de orina",
        "p": "Sin datos de infección"
      },
      {
        "n": "VDRL",
        "p": "No reactivo"
      },
      {
        "n": "Radiografía de tórax",
        "p": "Sin alteraciones pleuropulmonares"
      },
      {
        "n": "Otro",
        "p": ""
      }
    ],
    "tiposEvaluacionAnalisis": [
      {
        "c": "anual",
        "n": "Anual"
      },
      {
        "c": "bianual",
        "n": "Bianual"
      },
      {
        "c": "ingreso",
        "n": "De ingreso"
      },
      {
        "c": "extraordinaria",
        "n": "Extraordinaria"
      },
      {
        "c": "control",
        "n": "De control / seguimiento"
      }
    ],
    "valoracionResultado": [
      {
        "c": "pendiente_validacion",
        "n": "Pendiente de validación"
      },
      {
        "c": "normal",
        "n": "Normal"
      },
      {
        "c": "desviacion",
        "n": "Desviación"
      }
    ],
    "estatusCaso": [
      {
        "c": "pendiente_valoracion",
        "n": "Pendiente de valoración",
        "chip": "no"
      },
      {
        "c": "en_seguimiento",
        "n": "En seguimiento",
        "chip": "wa"
      },
      {
        "c": "pendiente_valoracion_posterior",
        "n": "Pendiente de valoración posterior",
        "chip": "wa"
      },
      {
        "c": "alta_cierre",
        "n": "Alta / cierre",
        "chip": "ok"
      },
      {
        "c": "no_requiere",
        "n": "No requiere seguimiento",
        "chip": "nt"
      }
    ],
    "estadosProgramacion": [
      {
        "c": "programado",
        "n": "Programado"
      },
      {
        "c": "realizado",
        "n": "Realizado"
      },
      {
        "c": "vencido",
        "n": "Vencido"
      }
    ],
    "conservacion": {
      "clinico": "NOM-004-SSA3-2012 (expediente clínico): conservar mínimo 5 años a partir del último acto médico.",
      "laboral": "LFT art. 804: conservar los documentos laborales durante el último año de la relación de trabajo y hasta un año después de su terminación.",
      "nota": "Ambas aplican sobre un mismo colaborador pero sobre documentos distintos y con plazos distintos. El criterio conservador es aplicar el plazo mayor por tipo de documento y no depurar el expediente clínico con la regla laboral. Definir la política antes de programar cualquier borrado automático."
    },
    "motivosArco": [
      {
        "c": "acceso",
        "n": "Acceso — saber qué datos míos se tratan"
      },
      {
        "c": "rectificacion",
        "n": "Rectificación — corregir un dato inexacto o incompleto"
      },
      {
        "c": "cancelacion",
        "n": "Cancelación — eliminar mis datos cuando proceda"
      },
      {
        "c": "oposicion",
        "n": "Oposición — dejar de tratar un dato para un fin específico"
      }
    ]
  };
})(window);

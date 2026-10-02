# Portal Zubex — RRHH y colaboradores

Aplicación web interna de Zubex Industrial: expediente médico ocupacional, **Etapa 1 del Expediente
Médico Electrónico ZX** (análisis clínicos bajo lineamiento SQF), citas, vacaciones y banco de horas,
y gestión documental de RRHH, con permisos distintos por nivel y por perfil.

**Versión 2.1.0 · Equipo RMNC · Octubre 2026**

> **Trabaja únicamente con Supabase.** Ya no existe el modo demo ni ningún dato de ejemplo en el
> código: todo lo que se ve viene de la base de datos real (proyecto `RRHH`). Las pruebas se hacen
> con cuentas de prueba creadas dentro de Supabase.

## Qué hay de nuevo

- **2.1.0** — Barra superior con **puesto y área**. Carga de la **jerarquía de jefes** (336 personas), de 9
  empleados nuevos y del **historial de solicitudes** (1,124 de vacaciones y 201 de banco de horas, con
  quién las resolvió y cuándo). Correcciones que sólo se notaban con datos reales: las solicitudes no
  traían su `tipo` (vacaciones/banco), las fechas-hora salían como "—", los horarios vacíos salían como
  "null" y la lectura se cortaba en 1,000 filas sin avisar.
- **2.0.0** — Se eliminó el modo demo por completo (`data.demo.js`, usuarios y contraseñas de
  ejemplo, botones de reinicio y diagnóstico). Las listas fijas de los formularios pasaron a
  `assets/catalogos.js` (sin datos de personas); departamentos, áreas y turnos son catálogos vivos
  de la base. Carga inicial de las 333 personas con sus roles, días de vacaciones y banco de horas.
- **1.9.0** — *Administración → Jefes y equipos* (organigrama en cadena), perfil `admin` con todos
  los módulos, barra lateral tipo acordeón y barra superior con nombre y departamento.
- **1.8.0** — Conexión a Supabase (RLS, triggers, funciones, Edge Function de importación).

## 1. Cómo abrirlo

El portal es un sitio estático (se publica en GitHub Pages). Para probarlo en tu equipo:

```
python -m http.server 8080     # dentro de la carpeta del portal
```

y abre <http://localhost:8080>. Se entra con **número de nómina y contraseña**. Las contraseñas
iniciales las genera la importación de personal y las entrega RRHH/Sistemas por un medio controlado.

### Lo único que el portal guarda en el navegador

| Dónde | Qué | Se borra |
|---|---|---|
| `sessionStorage` | Quién eres (nombre, nivel, perfil) y la sesión de acceso | Al cerrar el navegador |
| `sessionStorage` | Copia de los perfiles y del aviso de privacidad, para que los menús decidan al instante qué mostrar | Al cerrar el navegador |
| `localStorage` | Sólo la preferencia de tema claro/oscuro (`zx_tema`) | Manualmente |

Ningún dato de personas ni de salud se guarda en el navegador. Al abrir la versión 2.0.0, el portal
borra además los datos ficticios que versiones anteriores pudieron dejar en ese navegador.

---

## 2. Estructura de archivos

```
├── index.html            Acceso + portal de inicio
├── vacaciones.html       Vacaciones y banco de horas
├── medico.html           Servicio médico (mi historia; expedientes, sólo Salud Ocupacional)
├── citas.html            Citas con el médico de empresa
├── analisis.html         Análisis clínicos (Etapa 1 · SQF)
├── aptitud.html          Aptitud y restricciones
├── indicadores.html      Tablero de indicadores
├── rrhh.html             RRHH (RHF-34, maestro, expedientes) e importación desde IBIX
├── admin.html            Administración (usuarios, jefes y equipos, perfiles, matriz, bitácora)
├── privacidad.html       Aviso de privacidad, consentimiento y ARCO
└── assets/
    ├── config.js         URL y llave PÚBLICA de Supabase (no es un secreto; la seguridad es RLS)
    ├── supabase.min.js   Cliente de Supabase, empaquetado aquí a propósito: la red de planta
    │                     bloqueó antes cdn.jsdelivr.net; nunca cargarlo desde un CDN
    ├── catalogos.js      Listas fijas de formularios (tipos de riesgo, dictámenes, estatus...)
    ├── api.js            ⭐ Única capa que habla con la base de datos
    ├── app.js            Shell común: sesión, permisos, menú, modales, calendario
    ├── app.css           Sistema de diseño
    └── page-*.js         Lógica de cada pantalla (una por módulo)
```

---

## 3. Módulos y permisos

Universales (los tiene cualquiera, sin importar nivel ni perfil): Vacaciones y banco de horas,
Servicio médico (mi historia), Citas médicas (mis citas), Aviso de privacidad.

El resto se reparte en dos ejes independientes — ver la nota de la introducción:

| Módulo / capacidad | Empleado | Coordinador | Supervisor | Salud Ocupacional (perfil) | Seg. Industrial (perfil) | RRHH (perfil) | Dirección (perfil) | Admin (perfil) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Aptitud — restricciones de **mi equipo** | — | — | ✅ *(por nivel)* | — | — | — | — | — |
| Aptitud — planta completa | — | — | — | ✅ | ✅ | — | — | — |
| Análisis clínicos — resultado y valoración médica | — | — | — | ✅ | — | — | — | — |
| Análisis clínicos — estatus e indicadores de gestión | — | — | — | ✅ | — | — | ✅ | ✅ |
| Médico — expedientes clínicos de terceros | — | — | — | ✅ | — | — | — | — |
| Citas — agenda del médico | — | — | — | ✅ | — | — | — | — |
| RRHH — RHF-34, maestro, expediente documental | — | — | — | — | — | ✅ | — | — |
| Indicadores (datos agregados) | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Administración — usuarios, perfiles, bitácora | — | — | — | — | — | — | — | ✅ |
| Aprobar vacaciones/banco de horas de quien me reporta | — | ✅ *(por nivel)* | ✅ *(por nivel)* | — | — | — | — | — |
| Privacidad — panel de consentimientos y ARCO | — | — | — | ✅ | — | — | — | ✅ |

Aptitud es el único caso con **dos caminos de acceso**: por nivel (`supervisor` ve sólo su equipo)
o por perfil (`medico`/`vigilancia` ven la planta completa) — alguien puede tener ambos a la vez,
por ejemplo, un Jefe de Seguridad Industrial (nivel supervisor + perfil vigilancia). El resto de la
tabla es sólo por perfil, y los perfiles no vienen grabados en el código: se administran desde
**Administración → Perfiles y módulos**, donde se pueden crear perfiles nuevos y asignarles o
quitarles cualquiera de estos módulos. La pantalla *Administración → Matriz de permisos* muestra
esta tabla en vivo, separada en "por nivel" y "por perfil".

**Regla clave de privacidad, citando la propuesta:** el sistema no debe convertir los resultados
médicos individuales en información de libre consulta. La historia clínica y los resultados de
análisis son datos personales sensibles (LFPDPPP art. 3 fr. VI).

### 3.1 Análisis clínicos — Etapa 1 (alcance vigente)

Implementa el alcance del documento *Expediente Médico Electrónico ZX v3*: registrar, consultar y
dar seguimiento a los resultados de los análisis clínicos anuales y bianuales bajo lineamiento SQF.

**El flujo completo, tal como lo define la propuesta:**

```
Programación → Resultado → Validación médica → ¿Normal o desviación?
                                                    ↓ desviación
                              Caso de seguimiento → Valoración → Estudios posteriores → Alta/cierre
```

- **Programación.** Quién ya fue evaluado, quién está pendiente y quién está vencido. Los
  colaboradores activos sin ninguna programación se listan aparte, porque sin programación no
  cuentan como pendientes en los indicadores.
- **Resultados.** Tipo de análisis, fecha de toma, fecha de resultado, resultado, parámetro o
  criterio de referencia y laboratorio. Todo resultado nace como *pendiente de validación*: quien
  lo captura no decide si hay desviación.
- **Validación médica.** El médico clasifica el resultado como normal o desviación. Al marcar una
  desviación, **el caso de seguimiento se abre automáticamente** en estatus *Pendiente de
  valoración*, para que ninguna desviación quede sin atender.
- **Casos de seguimiento.** Con los **cinco estatus** definidos en el documento, sin inventar
  ninguno más: Pendiente de valoración → En seguimiento → Pendiente de valoración posterior →
  Alta/cierre, más No requiere seguimiento. Cada caso guarda fecha de detección, motivo, valoración
  médica, fecha de cita, indicaciones, estudios posteriores, próxima valoración, restricción
  derivada, fecha de alta y bitácora de notas.
- **Reporte de gestión.** Cobertura y casos por área, casos por estatus y días promedio de la
  detección al alta. Agregado, exportable e imprimible.

**Quién ve qué, dentro del mismo módulo:** Salud Ocupacional ve el resultado y la valoración
clínica; RH, Seguridad Industrial y Dirección ven el estatus, los tiempos y los indicadores, pero
no el resultado ni la valoración. El colaborador ve **sus propios** resultados y el avance de su
caso desde *Servicio médico → Mi expediente → Análisis clínicos*.

### 3.2 Servicio médico — expediente ocupacional en 9 secciones

El expediente está dividido en nueve secciones. **Las secciones 1, 2 y 3 las llena el
colaborador**; de la 4 a la 9 son exclusivas del servicio médico.

| # | Sección | Quién captura | Contenido |
|---|---|---|---|
| 1 | Datos de identificación | Colaborador | Nº de empleado, nombre, puesto, departamento y fecha de ingreso (precargados del registro de personal); CURP, fecha de nacimiento y edad calculada, sexo, tipo de jornada (turnos / fijo / otro) y contacto de emergencia |
| 2 | Información médica básica | Colaborador | Tipo sanguíneo, alergias, antecedentes médicos y quirúrgicos, medicamentos de uso habitual, enfermedades crónicas y heredofamiliares |
| 3 | Historia clínica ocupacional | Colaborador | Puestos anteriores y actual con antigüedad en cada uno (filas que se agregan y quitan), factores de riesgo/exposición, EPP utilizado y antecedentes de accidentes o enfermedades de trabajo |
| 4 | Evaluaciones de salud | Médico | Examen de ingreso, periódicos, por cambio de puesto o exposición, de reincorporación y de egreso; estudios de laboratorio/gabinete con resultado, y **dictamen de aptitud laboral** (apto / apto con restricciones / no apto / pendiente) con vigencia |
| 5 | Atenciones médicas | Médico | Fecha y motivo, signos vitales completos (T/A, FC, FR, temperatura, SpO₂, somatometría e IMC), exploración física por región, diagnóstico, tratamiento, **evolución** y **referencia o interconsulta** |
| 6 | Riesgos de trabajo | Médico | Accidentes, incidentes, enfermedades de trabajo y accidentes en trayecto; área y puesto involucrados, lesión, días perdidos, reporte al IMSS, **análisis de causa raíz en 8 disciplinas (8D)**, notas de seguimiento y reincorporación laboral |
| 7 | Incapacidades y ausentismo | Médico | Tipo (enfermedad general, riesgo de trabajo, maternidad, licencia), folio, periodo, días calculados automáticamente, causa y seguimiento |
| 8 | Documentos y evidencias | Médico | Historia clínica, resultados de laboratorio, estudios, recetas, notas de evolución, incapacidades y dictámenes |
| 9 | Seguimiento de salud ocupacional | Médico | Programa y periodicidad de vigilancia aplicable, recomendaciones, restricciones laborales, casos abiertos y fecha de próxima valoración |
| 10 | Vacunación y campañas | Médico | Biológico, dosis, fecha, campaña, próxima dosis y control de esquemas vencidos |
| — | Historial de cambios | Sistema | Bitácora de quién abrió, capturó o modificó el expediente y cuándo |

Además del expediente por persona, el médico tiene seis vistas agregadas: **Programa de exámenes**
(programados contra realizados), **Riesgos de trabajo**, **Ausentismo**, **Vigilancia**,
**Campañas y vacunación** y **Alta y baja de expedientes**.

#### Ciclo de vida del expediente

Sigue las etapas 1 y 9 del flujo de la propuesta. El expediente nace en estado **sin iniciar**;
Recursos Humanos lo **activa** al ingreso del colaborador, y al terminar la relación laboral pasa a
estatus de **baja** con motivo y fecha de conservación. Dar de baja no borra nada: bloquea la
captura y deja el expediente en resguardo.

> **Conservación — dos normas que conviven.** La **NOM-004-SSA3-2012** obliga a conservar el
> expediente clínico un mínimo de **5 años a partir del último acto médico**. El **artículo 804 de
> la LFT** obliga a conservar los documentos laborales durante el **último año de la relación de
> trabajo y hasta un año después** de su terminación. Aplican al mismo colaborador pero sobre
> documentos distintos y con plazos muy distintos: lo clínico no puede depurarse con la regla
> laboral. El portal propone por defecto el plazo mayor (5 años) y muestra esta nota en la pantalla
> de baja y en las de documentos, **pero la política definitiva la deben fijar Salud Ocupacional y
> Jurídico antes de programar cualquier borrado automático.**

### 3.5 Aptitud y restricciones (Seguridad Industrial)

Vista construida para el perfil de Vigilancia de la propuesta. Muestra dictamen de aptitud,
vigencia, restricciones, recomendaciones y próxima valoración — y **nada más**: no expone
diagnóstico, tratamiento ni antecedentes. Incluye el corte de eventos de salud por área y turno.

### 3.6 Indicadores (Entregable 2 + Etapa 1)

La pestaña **Etapa 1 · Análisis** agrega siete indicadores propios del alcance vigente: cobertura
de evaluación, avance de validación, tasa de desviación, porcentaje de casos abiertos, porcentaje
de casos cerrados, días promedio de la detección al alta y casos con valoración vencida. Con ellos
se responde la meta de las cuatro semanas: quiénes fueron evaluados, quiénes están pendientes, qué
desviaciones hubo, cuántas siguen en seguimiento y cuáles se cerraron.

#### Indicadores de gestión general

Los diez indicadores de la matriz de la propuesta, cada uno con su nombre formal, su fórmula, el
numerador y denominador que la alimentan y su fuente de datos: tasa de atención médica,
distribución de motivos de consulta, tasa de incidencia de accidentes, índice de días de
incapacidad, porcentaje de casos en seguimiento, cumplimiento de evaluaciones, cumplimiento de
exámenes periódicos, restricciones vigentes, índice de frecuencia de eventos y tasa por área/turno.
Todo es información **agregada**: el tablero no muestra ningún dato clínico individual.

Dos advertencias metodológicas que la propia app señala: los indicadores de cumplimiento sólo
existen si el **programa de exámenes** está cargado (sin evaluaciones programadas no hay
denominador), y las tasas por área/turno pueden identificar a una persona cuando el grupo es muy
pequeño, por lo que conviene fijar un umbral mínimo antes de difundir el reporte.

### 3.7 Administración del sistema

Cinco pestañas: **Usuarios** (cambiar nivel y/o perfil de cualquier persona, suspender/reactivar
acceso, con vista previa de qué módulos vería con el cambio antes de aplicarlo); **Jefes y equipos**
(organigrama: nivel de cada persona y quién está a su cargo, en cadena); **Perfiles y
módulos** — crear un perfil desde cero, asignarle o quitarle módulos con checkboxes, y
eliminarlo (bloqueado si es de sistema o si alguien lo tiene asignado — hay que reasignar primero);
**Matriz de permisos**, ahora en dos tablas (por nivel y por perfil, ya que dejaron de ser el mismo
campo); y **Bitácora de auditoría**, filtrable por acción y usuario, con conteo de aperturas de
expediente clínico.

### 3.3 Citas
Calendario con días hábiles del servicio médico → horarios libres calculados contra las citas ya
confirmadas y los bloqueos → confirmación con motivo. El médico ve su agenda del día, los próximos
7 días y el % de ocupación.

### 3.4 RRHH — RHF-34
Réplica digital del formato **RHF-34 rev. 00 "Movimiento de Personal"**: datos generales, los cinco
incisos (A alta, B cambio de departamento, C cambio de puesto, D cambio de sueldo, E baja) con
campos dinámicos por inciso, comentarios y **flujo de firmas** en cuatro etapas secuenciales
(jefe directo → gerente de área → dirección general → RRHH). Cada firma guarda quién, cuándo y con
qué comentario; el rechazo detiene el flujo. Incluye tablero, buscador, exportación CSV, vista de
impresión y expediente documental por colaborador con control de vigencias.

> El inciso D (cambio de sueldo) **no captura importes** a propósito: los sueldos deben vivir en
> nómina, no en el portal.

**Maestro de colaboradores → Importar desde IBIX.** Sube un CSV (botón *⬆ Importar desde IBIX*) y
reconoce columnas por alias — "No. Empleado", "Nómina", "Núm. Empleado" y variantes con o sin
puntuación/acentos mapean todas al mismo campo `id`; igual para nombre, correo, depto, área, turno,
puesto, jefe directo, fecha de ingreso y estatus. Antes de aplicar nada muestra qué columnas
reconoció, cuáles va a ignorar, y una muestra de las primeras filas mapeadas. Al confirmar:
- Actualiza a quien ya existe (upsert por número de nómina) — sólo los campos que trae el CSV.
- Da de alta a quien no existe, con **nivel `empleado` y perfil `ninguno`** (el mínimo acceso
  posible) y una contraseña temporal descargable en CSV — para asignarle su nivel y perfil real
  después, a mano, en *Administración → Usuarios*.
- **Nunca toca `nivel` ni `perfil`** de nadie, tampoco al actualizar: esos dos campos no existen en
  IBIX y el importador ni los lee ni los escribe. Reimportar el mismo archivo dos veces no duplica
  personas ni pisa accesos ya asignados.
- **Suspende automáticamente** (no elimina) a quien esté activo hoy y ya no aparezca en el archivo
  — conserva su expediente e historial, sólo le cierra el acceso (y ahora `login()` sí lo hace
  cumplir de verdad, no sólo lo oculta de las listas).
- **Seguro del 90%:** si el archivo trae menos del 90% de las personas activas actuales, la
  importación se cancela por completo antes de tocar nada — para no suspender a media planta por
  un CSV incompleto o a medio exportar.

### 3.8 Aviso de privacidad, consentimiento y ARCO

- **Todos** ven el aviso versionado y pueden otorgar o revocar su consentimiento expreso
  (LFPDPPP art. 8). El texto vive en la tabla `aviso_privacidad`; mientras tenga campos pendientes
  de Jurídico (marcados con `«` `»`) la pantalla se muestra como borrador.
- **Candado real.** `historias_clinicas` tiene un disparador de PostgreSQL (`exigir_consentimiento`):
  sin consentimiento vigente la base rechaza guardar o actualizar la historia clínica, venga de la
  pantalla o de una llamada directa a la API. La pantalla *Servicio médico → Mi historia clínica*
  además lo revisa antes de mostrar el formulario.
- **Derechos ARCO.** Cualquiera puede enviar una solicitud de Acceso, Rectificación, Cancelación u
  Oposición y ver el estatus de las que envió.
- **Panel de privacidad** (sólo `medico` y `admin`): quién tiene consentimiento vigente, quién no, y
  la bandeja de solicitudes ARCO, con aviso visual a los 20 días sin respuesta.

---

## 4. Backend: Supabase

El portal habla con el proyecto `RRHH` de Supabase (organización *Javi ZX*). `assets/config.js` trae
la URL y la llave pública (`publishable`/`anon`), **segura de tener en el repositorio**: no es un
secreto, la seguridad real la da RLS en cada tabla. La llave `service_role` **nunca** debe aparecer
en ningún archivo del proyecto: vive sólo dentro de la Edge Function, como variable de entorno que
Supabase inyecta sola.

### 4.1 Carga inicial de personal (septiembre 2026)

Se cargaron **333 personas** desde `EMPLEADOS.csv` (exportación con nómina, nombre, correo, rol,
fecha de ingreso, días disponibles, banco de horas, departamento, área y puesto):

- Pasó por la Edge Function `sincronizar-ibix` (creación oficial de usuarios), con contraseñas
  temporales aleatorias.
- Fechas dd/mm/aaaa convertidas explícitamente a ISO (212 fechas con día >12 y ninguna con mes >12
  confirmaron el formato). Nombres sin espacios sobrantes. El **turno** se tomó de la extracción
  previa de `medico-zx` (319 de 333; el archivo nuevo no lo trae).
- **Rol anterior → nivel/perfil:** Empleado → empleado; Jefe y Gerente → supervisor;
  Coordinador → coordinador; RRHH → perfil `rrhh` (1 persona); Médico → perfil `medico` (1 persona,
  nómina 9999). La cuenta 2859 conservó su perfil `admin`.
- **Días de vacaciones:** se cargaron tal cual, incluidos **31 saldos negativos** (personas que ya
  usaron más de lo disponible). **Banco de horas:** coma decimal interpretada; los 2 valores
  negativos se guardaron como horas adeudadas (`horas_deber`), con saldo 0.
- Los totales de la base se verificaron contra el archivo original (días, horas, conteos por rol).
- Los jefes se cargaron en octubre (ver 4.1b); desde entonces se ajustan en *Administración → Jefes y equipos*.

### 4.1b Jefes, empleados nuevos y solicitudes (octubre 2026)

- **Jefes:** `EMPLEADOS(3).csv` trae la nómina del jefe de cada persona: 336 con jefe, 54 jefes distintos,
  hasta 5 niveles de cadena, sin ciclos. Quedaron **sin jefe**: 100 (dirección general), 3490, 3725 y 3730
  (el archivo no lo indica) y **101**, que en el archivo aparece como su propio jefe (la base lo prohíbe);
  falta definir a quién reporta. Los jefes 2381 y 3702 pasaron a nivel Coordinador porque su puesto lo es y
  tienen gente a su cargo.
- **9 empleados nuevos** (204, 2507, 2587, 3402, 3524, 3624, 3634, 3694, 3727), con acceso propio. El archivo
  sólo trae nombre, correo y jefe: su departamento, área, puesto, ingreso y saldos están vacíos.
- **Solicitudes:** `SOLICITUDES.csv` y `SOLICITUDES_BANCO_HORAS.csv`, con folios estables (`V-…`, `B-…`).
  Fechas dd/mm/aaaa convertidas explícitamente; hora de Monterrey (UTC−6). Quién resolvió se resolvió por
  nombre a su nómina; las aprobadas sin dato de resolución (150) quedaron sin resolutor, y las pendientes
  tienen como aprobador al jefe actual. **No se tocaron los saldos de días ni de horas**: ya reflejan esas
  solicitudes. Se omitieron 3 solicitudes de vacaciones de las nóminas 283 y 3718, que no están en la lista.
- Datos de origen para revisar: 13 solicitudes de banco con horas **negativas o cero** (se cargaron tal
  cual), 15 solicitudes con más días que los naturales del rango, y 1 horario capturado como "04" (se guardó
  como 04:00).

### 4.2 Esquema

30 tablas en `public` (empleados, perfiles,
solicitudes de vacaciones/banco, historias clínicas, consultas, citas, RHF-34, expedientes,
evaluaciones, riesgos, incapacidades, documentos médicos, vigilancia, programa de evaluaciones,
vacunas, campañas, análisis clínicos (programación/resultados/casos), consentimientos, ARCO,
bitácora, y catálogos de departamento/área/turno/aviso de privacidad). `empleados.nivel` y
`empleados.perfil` son exactamente el mismo modelo de dos ejes que ya tenía el frontend — `perfil`
referencia la tabla `perfiles`, editable desde Administración.

No existe una tabla de "credenciales": el login real usa **Supabase Auth** con el mismo patrón de
correo sintético que ya probó Medico ZX (`<nómina>@nomina.zubex.com.mx`), enlazado a la fila de
`empleados` por `auth_user_id`.

### 4.3 RLS y funciones — el candado real

Cada tabla tiene Row Level Security activo. Las políticas usan un puñado de funciones
`SECURITY DEFINER` que resuelven "quién soy" sin caer en referencia circular: `mi_empleado_id()`,
`mi_nivel()`, `mi_perfil()`, `tengo_modulo(x)`, `soy_medico()`, `soy_admin()`, `es_supervisor_de(id)`.
Las tres primeras filtran por `estatus = 'activo'`: alguien suspendido se vuelve "nadie" para efectos
de permisos aunque su sesión siga técnicamente viva — es el candado de `estatus` aplicado a nivel de
base, no sólo en el login.

Dos reglas que antes vivían como validación de JavaScript ahora son disparadores reales:
- **`exigir_consentimiento()`** en `historias_clinicas` — igual que el disparador de Medico ZX
  (`04_privacidad.sql`): sin consentimiento vigente, la base rechaza el `INSERT`/`UPDATE`.
- **`abrir_caso_por_desviacion()`** en `resultados_analisis` — toda desviación abre su caso de
  seguimiento sola, sin depender de que alguien se acuerde.

La bitácora (`bitacora`) no tiene **ninguna** política de escritura para ningún rol: sólo la
escriben triggers internos (`auditar_acceso`, `auditar_perfil`, `auditar_consentimiento`,
`auditar_arco`) que corren con más privilegio que cualquier usuario — ni el propio administrador
puede alterarla desde la aplicación. Esto resuelve el pendiente histórico de que "la bitácora la
escribe el navegador y no tiene valor probatorio".

Las operaciones que tocan el saldo de alguien más (aprobar/rechazar una solicitud, descontar el
saldo al solicitar) son funciones `SECURITY DEFINER` propias — `solicitar_vacaciones`,
`solicitar_banco`, `resolver_solicitud` — porque un empleado normal no tiene permiso de `UPDATE`
directo sobre `empleados`. Es la corrección de un bug real que encontró la prueba en vivo: sin esto,
el saldo se quedaba sin descontar en silencio.

### 4.4 Altas nuevas — Edge Function `sincronizar-ibix`

Dar de alta a alguien requiere crear su usuario real de Supabase Auth, y eso exige la llave de
servicio — que nunca debe llegar al navegador. Por eso el importador de IBIX (*RRHH → Maestro de
colaboradores → Importar desde IBIX*) ya no escribe directo a la tabla: llama a la Edge Function
`sincronizar-ibix` (v3: altas en paralelo, 333 personas en ~17 s), que:
- Verifica que quien llama tenga perfil `rrhh` o `admin` (revisando su propia fila de `empleados`).
- Aplica el seguro del 90%: si el archivo trae menos del 90% de las personas activas, no toca nada.
- Da de alta a quien no existe (usuario de Auth + fila de `empleados`, `nivel: empleado` /
  `perfil: ninguno`, contraseña temporal) y actualiza a quien ya existe — sin tocar nunca
  `nivel`/`perfil` de nadie.
- Registra automáticamente en el catálogo cualquier departamento/área/turno que IBIX traiga y aún no
  exista — IBIX manda sobre el catálogo, el catálogo no debe bloquear una alta legítima.
- Suspende (nunca elimina) a quien deje de aparecer en el archivo.

### 4.5 Primera persona — arranque

Como nadie puede llamar a la Edge Function sin ya tener perfil `rrhh`/`admin`, la primerísima
persona se liga a mano (una sola vez): crearla en **Authentication → Users → Add user** con correo
`<nómina>@nomina.zubex.com.mx` y **Auto Confirm User activado**, y luego en el SQL Editor:

```sql
select alta_persona('2859', 'Nombre Completo', 'empleado', 'admin');
```

### 4.6 Jerarquía de jefes (migración 25)

`empleados.jefe` define quién aprueba y qué equipo ve cada jefe. Tres protecciones en la base:
`empleados_jefe_no_self` (nadie es su propio jefe), el trigger `evitar_ciclo_jefe()` (nadie queda
como jefe de su propio jefe, a cualquier profundidad) y `reasignar_aprobador_pendientes()` (al
cambiar el jefe, las solicitudes pendientes de vacaciones/banco pasan al jefe nuevo). Los cambios se
auditan como `usuario.jefe`. **Ojo con IBIX:** si algún día el archivo de IBIX trae una columna de
jefe, la importación la usará y pisará lo asignado a mano; mientras el archivo no la traiga, las
asignaciones manuales se respetan.

### 4.7 Pendientes

Ver la sección 6.

---

## 5. Seguridad

Lo que ya hace el sistema:

- El repositorio **no contiene datos de personas**, ni contraseñas, ni llaves secretas.
- Escapado de HTML en todo dato dinámico (`ZX.esc`) → sin XSS por contenido capturado.
- `Content-Security-Policy` restrictiva (`script-src 'self'`, sin `eval`, sin JS en línea);
  `connect-src` limitado al proyecto de Supabase; `base-uri 'none'`, `object-src 'none'`, `noindex`.
- Sesión en `sessionStorage` (muere al cerrar el navegador); contraseñas manejadas por Supabase Auth.
- Autorización en el **servidor**: RLS en las 30 tablas + funciones `SECURITY DEFINER`. Ocultar un
  menú nunca es la barrera; la base rechaza lo no permitido aunque se llame a la API directamente.
- Cuenta suspendida = sin acceso: lo exige el login y también los permisos de la base.
- Consentimiento exigido por la base, apertura automática de casos, bitácora que sólo escribe el
  servidor, jerarquía de jefes sin ciclos.
- Datos clínicos individuales sólo para el propio titular y el perfil Salud Ocupacional.

> **Repositorio público por ahora.** Mientras siga público, nunca subir llaves privadas ni
> exportaciones de personal ni archivos de credenciales (el `.gitignore` bloquea los más comunes).
> El plan es pasar a repositorio privado.

---

## 6. Pendientes

| Prioridad | Punto |
|---|---|
| **Alta** | **Cambio de contraseña por la propia persona.** Todas las cuentas tienen contraseña temporal y el portal aún no ofrece cambiarla (Medico ZX tenía "Mi cuenta"). |
| **Alta** | **Directorio abierto:** cualquier persona con sesión puede leer la tabla `empleados` completa (saldos de vacaciones y horas, correos, perfiles de todos). Restringir a propio/equipo/perfiles autorizados y dejar una vista mínima (nombre, puesto, departamento). |
| **Alta** | Definir el jefe de 100, 101, 3490, 3725 y 3730: sin él, sus solicitudes no tienen quién las apruebe (las ve RRHH/Admin). |
| **Alta** | Registrar en bitácora la apertura de expedientes clínicos: `auditoria.registrar` hoy no hace nada; la función de base `registrar_apertura_expediente` existe pero no está conectada. |
| Media | RRHH no puede editar el maestro de personal: la política de `empleados` sólo deja actualizar a `admin`. |
| Media | Bitácora incompleta: faltan triggers de consultas, evaluaciones, RHF-34, análisis, etc. |
| Media | `agenda_medico_config.medico` está en blanco; el médico es la cuenta 9999. |
| Media | Indicadores y Aptitud tardan ~7 s en abrir con 333 personas; la pantalla de espera falla a los 12 s. |
| Media | Textos legales del aviso de privacidad (domicilio, responsable art. 29, contacto) y política de conservación. |
| Media | Umbral mínimo de personas por grupo en reportes por área/turno. |
| Media | Firma del RHF-34: no valida que quien firma sea la persona de esa etapa; falta e.firma. |
| Media | Carga de archivos (PDF de laboratorio, adjuntos): no hay Storage conectado. |
| Baja | Folio de RHF-34 por conteo (usar una secuencia); notificaciones por correo. |

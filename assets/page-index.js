/* ============================================================
   Portal Zubex — index: acceso y portal de inicio
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, MODULOS, ACCESO_TEXTO, fmtLargo, hoyISO, iniciales } = window.ZX;
  const API = window.ZX_API;
  const root = document.getElementById('root');

  API.sesionActual() ? portal() : login();

  /* ------------------------- LOGIN ------------------------- */
  function login() {
    root.innerHTML =
      '<div class="login">' +
        '<section class="login-art">' +
          '<div class="zx-logo" style="font-size:17px"><span class="zx-mark">ZX</span><span>Zubex Industrial</span></div>' +
          '<div>' +
            '<h2>Un solo portal para tus trámites de personal.</h2>' +
            '<p>Expediente médico ocupacional, análisis clínicos, citas y gestión documental de Recursos Humanos, con los permisos que le corresponden a cada perfil.</p>' +
            '<div class="login-feat">' +
              '<div><i>🧪</i><span>Etapa 1: resultados de análisis clínicos, desviaciones y seguimiento hasta el alta</span></div>' +
              '<div><i>🩺</i><span>Tu historia clínica y tus consultas en un expediente digital</span></div>' +
              '<div><i>📅</i><span>Agenda con el médico de empresa según su disponibilidad real</span></div>' +
              '<div><i>🗂️</i><span>Movimientos de personal RHF-34 con flujo de firmas digital</span></div>' +
            '</div>' +
          '</div>' +
          '<small style="opacity:.7;font-size:11px">Zubex Industrial S.A. de C.V. · Uso interno</small>' +
        '</section>' +
        '<section class="login-form"><div class="login-box">' +
          '<h1>Iniciar sesión</h1><p>Usa tu número de nómina y tu contraseña.</p>' +
          '<div id="err" class="login-err hidden" role="alert"></div>' +
          '<form id="f" autocomplete="off">' +
            '<div class="field"><label for="u">Número de nómina</label>' +
              '<input id="u" name="u" required autocomplete="username" inputmode="numeric" placeholder="Ej. 2859"></div>' +
            '<div class="field"><label for="p">Contraseña</label>' +
              '<input id="p" name="p" type="password" required autocomplete="current-password" placeholder="••••••••"></div>' +
            '<button class="btn" style="width:100%;justify-content:center" id="btn" type="submit">Entrar</button>' +
          '</form>' +
          '<p style="margin-top:14px;font-size:10.5px;color:var(--tx3)">Versión ' + esc(ZX.VERSION) + '</p>' +
        '</div></section>' +
      '</div>';

    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#err'), btn = $('#btn');
      err.classList.add('hidden');
      btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        await API.login($('#u').value, $('#p').value);
        location.reload();
      } catch (ex) {
        err.textContent = ex.message || 'No fue posible iniciar sesión.';
        err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    });
  }

  /* ------------------------- PORTAL ------------------------- */
  async function portal() {
    const shell = ZX.montarShell('inicio', 'Inicio');
    if (!shell) return;
    const { main, sesion } = shell;

    const verVacaciones = ZX.puede(sesion, 'vacaciones');
    const [sols, banco, citas, movs] = await Promise.all([
      API.vacaciones.solicitudes(), API.vacaciones.banco(),
      API.citas.lista({ empleado: sesion.id }), API.rrhh.movimientos()
    ]);

    const yo = await API.empleados.uno(sesion.id);
    const misPend = sols.concat(banco).filter(x => x.empleado === sesion.id && x.estado === 'pendiente').length;
    const porAprobar = ZX.esAprobador(sesion)
      ? sols.concat(banco).filter(x => x.aprobador === sesion.id && x.estado === 'pendiente').length : 0;
    const proxCita = citas.filter(c => c.estado === 'confirmada' && c.fecha >= hoyISO())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const enFirma = ZX.esRRHH(sesion) ? movs.filter(m => m.estado === 'en_firma').length : 0;

    let kpis = '';
    if (verVacaciones) {
      kpis += kpi('Días de vacaciones', (yo.dias + (yo.pendActivos ? yo.diasPend : 0)), 'Disponibles hoy') +
              kpi('Banco de horas', yo.horas + ' h', yo.horasDeber ? yo.horasDeber + ' h por reponer' : 'Sin horas por reponer') +
              kpi('Mis pendientes', misPend, misPend ? 'Esperando aprobación' : 'Nada en trámite', misPend ? 'wn' : '');
    }
    kpis += kpi('Próxima cita', proxCita ? ZX.fmt(proxCita.fecha) : '—', proxCita ? proxCita.hora + ' h · Servicio médico' : 'Sin citas agendadas');
    if (ZX.esClinico(sesion)) {
      const [pac, incap] = await Promise.all([API.empleados.lista(), API.medico.incapacidades()]);
      const hoy = ZX.hoyISO();
      const citasHoy = (await API.citas.lista()).filter(c => c.fecha === hoy && c.estado === 'confirmada').length;
      const vigentes = incap.filter(i => i.estado === 'vigente').length;
      kpis += kpi('Citas de hoy', citasHoy, 'En tu agenda') +
              kpi('Pacientes', pac.length, 'Con expediente ocupacional') +
              kpi('Incapacidades vigentes', vigentes, 'Colaboradores ausentes', vigentes ? 'wn' : 'gn');
    }
    if (ZX.puede(sesion, 'analisis')) {
      const [prog, res, casos] = await Promise.all([
        API.analisis.programacion(), API.analisis.resultados(), API.analisis.casos()
      ]);
      const evaluados = new Set(prog.filter(p => p.estado === 'realizado').map(p => p.empleado)).size;
      const abiertos = casos.filter(c => c.estatus !== 'alta_cierre' && c.estatus !== 'no_requiere').length;
      const porValidar = res.filter(r => r.valoracion === 'pendiente_validacion').length;
      kpis += kpi('Evaluados (Etapa 1)', evaluados, 'Análisis clínicos realizados') +
              kpi('Casos abiertos', abiertos, 'Desviaciones en seguimiento', abiertos ? 'wn' : 'gn');
      if (ZX.esClinico(sesion)) {
        kpis += kpi('Por validar', porValidar, 'Resultados esperando validación', porValidar ? 'wn' : 'gn');
      }
    }
    if (porAprobar) kpis += kpi('Por aprobar', porAprobar, 'Solicitudes de tu equipo', 'wn');
    if (enFirma) kpis += kpi('RHF-34 en firma', enFirma, 'Movimientos esperando firma', 'wn');

    const mods = ZX.modulosVisibles().filter(m => m.id !== 'inicio' && ZX.puede(sesion, m.id)).map(m =>
      '<a class="mod" href="' + esc(m.url) + '">' +
        '<div class="mod-ico">' + m.ico + '</div><b>' + esc(m.nombre) + '</b>' +
        '<p>' + esc(m.desc || '') + '</p>' +
        '<span class="mod-tag">Entrar →</span></a>').join('');

    main.innerHTML =
      '<div class="page-head"><div>' +
        '<h1 class="page-t">Hola, ' + esc(sesion.nombre.split(' ')[0]) + '</h1>' +
        '<div class="page-sub">' + esc(ACCESO_TEXTO(sesion)) + ' · ' + esc(sesion.depto) + ' · ' + esc(fmtLargo(hoyISO())) + '</div>' +
      '</div></div>' +
      '<div class="grid g4">' + kpis + '</div>' +
      '<h2 class="sec-t">Tus secciones</h2>' +
      '<div class="mod-grid">' + mods + '</div>';

    ZX.pie(main, 'Los saldos mostrados provienen del registro de personal y consideran los días pendientes sólo cuando están activados.');
  }

  function kpi(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div>' +
           '<div class="kpi-v ' + (clase || '') + '">' + esc(v) + '</div>' +
           '<div class="kpi-d">' + esc(d) + '</div></div>';
  }
})();

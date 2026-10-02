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

  /* ------------------------- PORTAL (inicio) ------------------------- */
  async function portal() {
    const shell = ZX.montarShell('inicio', 'Inicio');
    if (!shell) return;
    const { main, sesion } = shell;
    ZX.cargando(main);

    try {
      /* Sólo se piden datos propios: la ficha (nombre, departamento, correo, saldos),
         las solicitudes y las citas de quien entró. */
      const [yo, sols, banco, citas] = await Promise.all([
        API.empleados.uno(sesion.id),
        API.vacaciones.solicitudes({ empleado: sesion.id }),
        API.vacaciones.banco({ empleado: sesion.id }),
        API.citas.lista({ empleado: sesion.id })
      ]);
      const ficha = yo || sesion;

      const pendVac = sols.filter(x => x.estado === 'pendiente').length;
      const pendBan = banco.filter(x => x.estado === 'pendiente').length;
      const proxCita = citas.filter(c => c.estado === 'confirmada' && c.fecha >= hoyISO())
        .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];

      let tarjetas = '';
      if (ZX.puede(sesion, 'vacaciones')) {
        const disp = ficha.dias + (ficha.pendActivos ? ficha.diasPend : 0);
        tarjetas +=
          kpi('Días de vacaciones', disp, 'Disponibles hoy', '', 'vacaciones.html#solicitar-vacaciones') +
          kpi('Solicitudes pendientes de vacaciones', pendVac, pendVac ? 'Esperando aprobación' : 'Nada en trámite', pendVac ? 'wn' : '', 'vacaciones.html#pendientes-vacaciones') +
          kpi('Banco de horas', ficha.horas + ' h', ficha.horasDeber ? ficha.horasDeber + ' h por reponer' : 'Disponibles hoy', '', 'vacaciones.html#solicitar-banco') +
          kpi('Solicitudes pendientes de banco de horas', pendBan, pendBan ? 'Esperando aprobación' : 'Nada en trámite', pendBan ? 'wn' : '', 'vacaciones.html#pendientes-banco');
      }
      tarjetas += kpi('Próxima cita', proxCita ? ZX.fmt(proxCita.fecha) : '—',
        proxCita ? proxCita.hora + ' h · Servicio médico' : 'Sin citas agendadas');

      const mods = ZX.modulosVisibles().filter(m => m.id !== 'inicio' && ZX.puede(sesion, m.id)).map(m =>
        '<a class="mod" href="' + esc(m.url) + '">' +
          '<div class="mod-ico">' + m.ico + '</div><b>' + esc(m.nombre) + '</b>' +
          '<p>' + esc(m.desc || '') + '</p>' +
          '<span class="mod-tag">Entrar →</span></a>').join('');

      const linea = [ficha.departamento, ficha.correo].filter(Boolean).join(' · ');
      main.innerHTML =
        '<div class="page-head"><div>' +
          '<h1 class="page-t">' + esc(sesion.id + ' - ' + ficha.nombre) + '</h1>' +
          (linea ? '<div class="home-id">' + esc(linea) + '</div>' : '') +
        '</div></div>' +
        '<div class="grid g4">' + tarjetas + '</div>' +
        '<h2 class="sec-t">Tus secciones</h2>' +
        '<div class="mod-grid">' + mods + '</div>';

      ZX.pie(main, 'Los saldos mostrados provienen del registro de personal y consideran los días pendientes sólo cuando están activados.');
    } catch (e) { console.error('[Portal Zubex]', e); ZX.fallo(e); }
  }

  /* Tarjeta de dato. Con `url` funciona como enlace. */
  function kpi(l, v, d, clase, url) {
    const cuerpo = '<div class="kpi-l">' + esc(l) + '</div>' +
      '<div class="kpi-v ' + (clase || '') + '">' + esc(v) + '</div>' +
      '<div class="kpi-d">' + esc(d) + '</div>';
    return url
      ? '<a class="kpi kpi-link" href="' + esc(url) + '">' + cuerpo + '</a>'
      : '<div class="kpi">' + cuerpo + '</div>';
  }
})();

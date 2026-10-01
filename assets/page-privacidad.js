/* ============================================================
   Portal Zubex — Aviso de privacidad, consentimiento y ARCO
   ------------------------------------------------------------
   En el consentimiento, la regla real es un disparador de PostgreSQL
   (exigir_consentimiento en historias_clinicas): sin consentimiento vigente la
   base rechaza guardar la historia clínica.
   Todos los roles pueden entrar aquí (roles:'*' en MODULOS). El panel
   de "quién consintió" y la bandeja ARCO sólo se muestran a medico/admin,
   igual que hace Medico ZX con su rol clínico.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, toast, fmt, fmtLargo, hoyISO, confirmar } = window.ZX;
  const API = window.ZX_API;
  const CAT = window.ZX_CAT;
  const AVISO = API.privacidad.avisoSync();

  const sesion = ZX.requiereSesion('privacidad');
  if (!sesion) return;
  const esPanel = ZX.esClinico(sesion) || ZX.esAdmin(sesion);

  const vistas = esPanel
    ? [{ id: 'aviso', nombre: 'Mi consentimiento', ico: '🔒' },
       { id: 'panel',  nombre: 'Panel de privacidad', ico: '🗂️' }]
    : [{ id: 'aviso', nombre: 'Aviso y consentimiento', ico: '🔒' },
       { id: 'arco',  nombre: 'Mis solicitudes ARCO', ico: '📨' }];

  const shell = ZX.montarShell('privacidad', 'Aviso de privacidad · consentimiento y derechos ARCO', vistas);
  const main = shell.main;

  let D = { consentimiento: null, misArco: [], emps: [], consentimientos: [], todasArco: [] };

  async function recargar() {
    if (esPanel) {
      const [emps, consentimientos, todasArco] = await Promise.all([
        API.empleados.lista(), API.privacidad.listaConsentimientos(), API.privacidad.arcoLista()
      ]);
      D = Object.assign(D, { emps, consentimientos, todasArco });
    } else {
      const [consentimiento, misArco] = await Promise.all([
        API.privacidad.consentimiento(sesion.id), API.privacidad.arco(sesion.id)
      ]);
      D = Object.assign(D, { consentimiento, misArco });
    }
  }

  let vista = vistas[0].id;
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await recargar(); render(); });
  async function refrescar() { await recargar(); render(); }
  function render() { ({ aviso, arco, panel }[vista] || aviso)(); }

  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }

  function bannerBorrador() {
    if (AVISO.vigente) return '';
    return '<div class="priv">📝 <div><b>Este aviso sigue en borrador.</b> Faltan campos por completar antes de que ' +
      'Jurídico lo apruebe: ' + esc(AVISO.pendientes.join(', ')) + '. Mientras tanto puedes seguir otorgando tu ' +
      'consentimiento con normalidad — cuando el aviso cambie de versión, se te pedirá otorgarlo de nuevo.</div></div>';
  }

  /* ===========================================================
     AVISO + CONSENTIMIENTO (todos los roles ven su propio estado)
     =========================================================== */
  function aviso() {
    const c = D.consentimiento;
    main.innerHTML =
      cab('Aviso de privacidad', 'Versión ' + esc(AVISO.version) + ' · actualizado ' + fmt(AVISO.actualizado)) +
      bannerBorrador() +
      '<div class="card"><div class="card-t">Texto del aviso</div>' +
        '<p style="font-size:13px;line-height:1.6">' + esc(AVISO.texto) + '</p>' +
        '<div class="frow" style="margin-top:10px">' +
          '<div class="field"><label>Responsable</label><input readonly value="' + esc(AVISO.responsable) + '"></div>' +
          '<div class="field"><label>Domicilio</label><input readonly value="' + esc(AVISO.domicilio) + '"></div>' +
        '</div>' +
        '<div class="frow">' +
          '<div class="field"><label>Área de datos personales (art. 29)</label><input readonly value="' + esc(AVISO.areaResponsable) + '"></div>' +
          '<div class="field"><label>Contacto</label><input readonly value="' + esc(AVISO.contacto) + '"></div>' +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-t">Tu consentimiento</div>' +
      (c
        ? '<p style="font-size:13px">Otorgado el <b>' + fmt(c.fecha) + '</b>, versión <b>' + esc(c.version) + '</b> del aviso.</p>' +
          '<div class="btn-row"><button class="btn gh" id="revocar">Revocar mi consentimiento</button></div>' +
          '<p class="field hint" style="margin-top:8px">Revocarlo no borra tu historia clínica ya capturada, pero no podrás ' +
          'actualizarla hasta que lo otorgues de nuevo.</p>'
        : '<p style="font-size:13px">Aún no has otorgado tu consentimiento para esta versión del aviso.</p>' +
          '<label class="chk"><input type="checkbox" id="acepto"><span>He leído el aviso de privacidad y otorgo mi consentimiento expreso ' +
          'para el tratamiento de mis datos personales, incluidos los de salud.</span></label>' +
          '<div class="btn-row"><button class="btn" id="otorgar" disabled>Otorgar consentimiento</button></div>') +
      '</div>';

    ZX.pie(main, 'La captura o actualización de tu historia clínica en Servicio médico requiere un consentimiento vigente. ' +
      'Es un control de la base de datos: sin consentimiento vigente, el servidor rechaza guardar la historia clínica.');

    if (!c) {
      const chk = $('#acepto'), btn = $('#otorgar');
      chk.addEventListener('change', () => { btn.disabled = !chk.checked; });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await API.privacidad.otorgar(sesion.id); toast('Consentimiento otorgado.', 'ok'); await refrescar(); }
        catch (ex) { toast(ex.message, 'no'); btn.disabled = false; }
      });
    } else {
      $('#revocar').addEventListener('click', () => {
        confirmar('Revocar consentimiento', '¿Confirmas que quieres revocar tu consentimiento? No podrás capturar ni ' +
          'actualizar tu historia clínica hasta que lo otorgues de nuevo.', async () => {
          try { await API.privacidad.revocar(sesion.id); toast('Consentimiento revocado.', 'ok'); await refrescar(); }
          catch (ex) { toast(ex.message, 'no'); }
        });
      });
    }
  }

  /* ===========================================================
     MIS SOLICITUDES ARCO (colaborador)
     =========================================================== */
  function arco() {
    main.innerHTML =
      cab('Mis solicitudes ARCO', 'Acceso, Rectificación, Cancelación u Oposición sobre tus datos personales') +
      '<div class="card"><div class="card-t">Nueva solicitud</div>' +
        '<form id="f">' +
          '<div class="field"><label for="tipo">Tipo de solicitud</label><select id="tipo">' +
            CAT.motivosArco.map(m => '<option value="' + esc(m.c) + '">' + esc(m.n) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label for="detalle">Detalle</label><textarea id="detalle" maxlength="500" placeholder="Describe qué necesitas"></textarea></div>' +
          '<button class="btn" type="submit">Enviar solicitud</button>' +
        '</form>' +
      '</div>' +
      '<div class="card"><div class="card-t">Historial</div>' +
        ZX.tabla(
          [{ t: 'Fecha', v: r => fmt(r.fecha) }, { t: 'Tipo', v: r => (CAT.motivosArco.find(m => m.c === r.tipo) || {}).n || r.tipo },
           { t: 'Estado', html: r => estadoArco(r) }, { t: 'Respuesta', v: r => r.respuesta || '—' }],
          D.misArco.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)),
          { vacio: 'No has enviado ninguna solicitud.' }
        ) +
      '</div>';

    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const detalle = $('#detalle').value.trim();
      if (!detalle) return toast('Describe tu solicitud.', 'wa');
      try {
        await API.privacidad.enviarArco({ empleado: sesion.id, tipo: $('#tipo').value, detalle });
        toast('Solicitud enviada.', 'ok');
        await refrescar();
      } catch (ex) { toast(ex.message, 'no'); }
    });
  }

  function estadoArco(r) {
    if (r.estado === 'respondida') return '<span class="chip ok">Respondida</span>';
    const dias = Math.round((new Date() - new Date(r.fecha + 'T12:00:00')) / 86400000);
    return dias > 20 ? '<span class="chip no">Pendiente · ' + dias + ' días</span>' : '<span class="chip wa">Pendiente · ' + dias + ' días</span>';
  }

  /* ===========================================================
     PANEL (medico / admin): quién consintió y bandeja ARCO
     =========================================================== */
  function panel() {
    const nombreDe = id => (D.emps.find(e => e.id === id) || {}).nombre || id;
    const vigentes = D.consentimientos.filter(c => c.vigente && c.version === AVISO.version);
    const sinConsentimiento = D.emps.filter(e => !vigentes.some(c => c.empleado === e.id));
    const pendientesArco = D.todasArco.filter(r => r.estado === 'pendiente');

    main.innerHTML =
      cab('Panel de privacidad', 'Evidencia de cumplimiento del deber de seguridad (LFPDPPP art. 18)') +
      '<div class="grid g4" style="margin-bottom:14px">' +
        k('Con consentimiento vigente', vigentes.length, 'versión ' + AVISO.version) +
        k('Sin consentimiento', sinConsentimiento.length, 'de ' + D.emps.length + ' colaboradores') +
        k('ARCO pendientes', pendientesArco.length, pendientesArco.some(r => diasArco(r) > 20) ? 'con solicitudes vencidas' : 'dentro de plazo') +
      '</div>' +
      '<div class="card"><div class="card-t">Quién otorgó consentimiento</div>' +
        ZX.tabla(
          [{ t: 'Colaborador', v: r => nombreDe(r.empleado) }, { t: 'Versión', v: r => r.version },
           { t: 'Fecha', v: r => fmt(r.fecha) }, { t: 'Estado', html: r => r.vigente ? '<span class="chip ok">Vigente</span>' : '<span class="chip no">Revocado ' + fmt(r.revocado) + '</span>' }],
          D.consentimientos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)),
          { vacio: 'Nadie ha otorgado su consentimiento todavía.' }
        ) +
      '</div>' +
      '<div class="card"><div class="card-t">Sin consentimiento vigente</div>' +
        ZX.tabla([{ t: 'Colaborador', v: e => e.nombre }, { t: 'Departamento', v: e => e.depto }],
          sinConsentimiento, { vacio: 'Todos tienen consentimiento vigente.' }) +
      '</div>' +
      '<div class="card"><div class="card-t">Solicitudes ARCO</div>' +
        ZX.tabla(
          [{ t: 'Colaborador', v: r => nombreDe(r.empleado) }, { t: 'Tipo', v: r => (CAT.motivosArco.find(m => m.c === r.tipo) || {}).n || r.tipo },
           { t: 'Fecha', v: r => fmt(r.fecha) }, { t: 'Estado', html: r => estadoArco(r) },
           { t: '', html: r => r.estado === 'pendiente' ? '<button class="btn gh sm" data-r="' + esc(r.id) + '">Responder</button>' : '' }],
          D.todasArco.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)),
          { vacio: 'No hay solicitudes ARCO.' }
        ) +
      '</div>';

    $$('[data-r]').forEach(b => b.addEventListener('click', () => abrirRespuesta(b.dataset.r)));
  }

  function diasArco(r) { return Math.round((new Date() - new Date(r.fecha + 'T12:00:00')) / 86400000); }

  function abrirRespuesta(id) {
    const r = D.todasArco.find(x => x.id === id);
    const body = ZX.modal({
      titulo: 'Responder solicitud ARCO',
      cuerpo: '<p style="font-size:13px;margin-bottom:10px"><b>' + esc(r.detalle) + '</b></p>' +
        '<div class="field"><label for="resp">Respuesta</label><textarea id="resp" maxlength="800"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Enviar respuesta', accion: async (b) => {
          const resp = $('#resp', b).value.trim();
          if (!resp) return toast('Escribe una respuesta.', 'wa');
          await API.privacidad.responderArco(id, resp, sesion.id);
          toast('Respuesta registrada.', 'ok');
          ZX.cerrarModal();
          await refrescar();
        } }
      ]
    });
  }

  function k(l, v, d) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v">' + esc(v) + '</div><div class="kpi-d">' + esc(d) + '</div></div>';
  }
})();

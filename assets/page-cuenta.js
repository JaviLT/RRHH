/* ============================================================
   Portal RRHH — Mi cuenta
   Cambio de contraseña (obligatorio mientras sea temporal) y verificación en dos pasos.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, toast } = window.ZX;
  const API = window.ZX_API;
  const sesion = ZX.requiereSesion('cuenta');
  if (!sesion) return;
  const forzado = sesion.claveCambiada === false;
  const shell = ZX.montarShell('cuenta', 'Mi cuenta', []);
  if (!shell) return;
  const main = shell.main;

  const DEBILES = ['12345678', '123456789', '1234567890', 'password', 'contrasena', 'contraseña', 'zubex', 'qwerty', 'abcdefgh'];
  function revisaClave(nueva, actual) {
    if (nueva.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
    if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) return 'Debe combinar letras y números.';
    if (nueva.toLowerCase().indexOf(String(sesion.id)) >= 0) return 'No uses tu número de nómina dentro de la contraseña.';
    if (DEBILES.some(d => nueva.toLowerCase().indexOf(d) >= 0)) return 'Esa contraseña es demasiado fácil de adivinar. Elige otra.';
    if (nueva === actual) return 'La nueva contraseña debe ser distinta de la actual.';
    return '';
  }

  async function pinta() {
    let fx = { totp: [], all: [] };
    try { fx = await API.mfa.factores(); } catch (e) { fx = null; }
    const verificado = fx && (fx.totp || []).find(f => f.status === 'verified');
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-t">Mi cuenta</h1><div class="page-sub">' + esc(sesion.id + ' · ' + sesion.nombre) + '</div></div></div>' +
      (forzado ? '<div class="priv" style="border-color:var(--wa)">🔑 <div><b>Tu contraseña es temporal.</b> Debes cambiarla para poder usar el portal. Elige una que sólo tú conozcas.</div></div>' : '') +
      '<div class="card"><div class="card-t">Contraseña</div>' +
        '<form id="fc" autocomplete="off"><div class="frow">' +
          '<div class="field"><label for="c_act">Contraseña actual</label><input id="c_act" type="password" autocomplete="current-password" required></div>' +
          '<div class="field"><label for="c_nva">Contraseña nueva</label><input id="c_nva" type="password" autocomplete="new-password" required minlength="10"></div>' +
          '<div class="field"><label for="c_rep">Repite la contraseña nueva</label><input id="c_rep" type="password" autocomplete="new-password" required></div>' +
        '</div><p class="page-sub" style="margin:2px 0 12px">Mínimo 10 caracteres, con letras y números. No uses tu nómina ni palabras comunes.</p>' +
        '<div class="btn-row"><button class="btn" type="submit" id="c_ok">Cambiar contraseña</button></div></form></div>' +
      '<div class="card"><div class="card-t">Verificación en dos pasos ' + (verificado ? '<span class="chip ok">Activada</span>' : '<span class="chip nt">No activada</span>') + '</div>' +
        '<p class="page-sub" style="margin-bottom:12px">Además de tu contraseña, al entrar se pide un código de 6 dígitos de una aplicación de verificación (Microsoft Authenticator, Google Authenticator u otra). ' +
        'Es muy recomendable para quien consulta información de salud.</p>' +
        (fx === null ? '<div class="empty">La verificación en dos pasos no está disponible en este momento.</div>'
          : verificado ? '<div class="btn-row"><button class="btn gh" id="m_quitar">Desactivar verificación en dos pasos</button></div>'
          : '<div id="m_zona"><div class="btn-row"><button class="btn" id="m_activar">Activar verificación en dos pasos</button></div></div>') +
      '</div>' +
      '<div class="card"><div class="card-t">Tu sesión</div><p class="page-sub">Por seguridad, la sesión se cierra sola después de 20 minutos sin actividad.</p></div>';

    $('#fc').addEventListener('submit', async (e) => {
      e.preventDefault();
      const act = $('#c_act').value, nva = $('#c_nva').value, rep = $('#c_rep').value;
      if (nva !== rep) return toast('Las contraseñas nuevas no coinciden.', 'wa');
      const problema = revisaClave(nva, act); if (problema) return toast(problema, 'wa');
      const b = $('#c_ok'); b.disabled = true; b.textContent = 'Guardando…';
      try {
        await API.cambiarClave(act, nva);
        toast('Contraseña actualizada.', 'ok');
        if (forzado) setTimeout(() => location.replace('index.html'), 900); else { $('#fc').reset(); b.disabled = false; b.textContent = 'Cambiar contraseña'; }
      } catch (ex) { toast(ex.message, 'no'); b.disabled = false; b.textContent = 'Cambiar contraseña'; }
    });

    const act = $('#m_activar');
    if (act) act.addEventListener('click', async () => {
      act.disabled = true;
      try {
        for (const f of (fx.all || fx.totp || [])) if (f.status !== 'verified') { try { await API.mfa.quitar(f.id); } catch (e) { /* factor sin terminar */ } }
        const r = await API.mfa.enrolar();
        $('#m_zona').innerHTML =
          '<p style="font-size:13px;margin-bottom:10px"><b>1.</b> Abre tu aplicación de verificación y escanea este código QR. <b>2.</b> Escribe el código de 6 dígitos que te muestre.</p>' +
          '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center"><img alt="Código QR" src="' + esc(r.totp.qr_code) + '" width="168" height="168" style="background:#fff;border-radius:10px;padding:8px">' +
          '<div style="flex:1;min-width:220px"><div class="page-sub" style="margin-bottom:6px">¿No puedes escanear? Escribe esta clave en la aplicación:</div>' +
          '<code style="display:block;word-break:break-all;margin-bottom:12px">' + esc(r.totp.secret) + '</code>' +
          '<div class="field"><label for="m_cod">Código de 6 dígitos</label><input id="m_cod" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>' +
          '<div class="btn-row"><button class="btn" id="m_ok">Confirmar y activar</button><button class="btn gh" id="m_cancel">Cancelar</button></div></div></div>';
        $('#m_cancel').addEventListener('click', async () => { try { await API.mfa.quitar(r.id); } catch (e) {} pinta(); });
        $('#m_ok').addEventListener('click', async () => {
          try { await API.mfa.confirmar(r.id, $('#m_cod').value); toast('Verificación en dos pasos activada.', 'ok'); pinta(); }
          catch (ex) { toast(ex.message, 'no'); }
        });
      } catch (ex) { toast(ex.message || 'No se pudo iniciar la activación.', 'no'); act.disabled = false; }
    });
    const quitar = $('#m_quitar');
    if (quitar) quitar.addEventListener('click', async () => {
      ZX.confirmar('Desactivar verificación en dos pasos', 'Tu cuenta quedará protegida sólo con la contraseña. ¿Continuar?', async () => {
        try { await API.mfa.quitar(verificado.id); toast('Verificación en dos pasos desactivada.', 'ok'); pinta(); } catch (ex) { toast(ex.message, 'no'); }
      });
    });
  }
  pinta();
})();

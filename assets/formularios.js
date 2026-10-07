/* ============================================================
   Portal RRHH — Formularios compartidos (se abren en el lugar)
   ------------------------------------------------------------
   Solicitar vacaciones, solicitar banco de horas y agendar cita.
   Los abre la barra superior desde CUALQUIER pantalla sin cambiar
   de página: cada uno trae sus propios datos al abrirse y, al
   terminar, avisa con el evento «zx:datos» para que la pantalla
   donde estés se actualice sola.
   Las reglas se validan aquí y, de nuevo, en la base de datos.
   ============================================================ */
(function (global) {
  'use strict';
  const ZX = global.ZX, API = global.ZX_API;
  if (!ZX || !API) return;
  const { esc, $, toast, fmt, hoyISO, parse, sumaDias, diffDias, modal, cerrarModal, calendario } = ZX;

  const dos = n => String(n).padStart(2, '0');
  const LIMITE_DIA = 4;                                     // horas máximas por solicitud y por día
  const minDe = t => (+t.slice(0, 2)) * 60 + (+t.slice(3));
  const hhmm = m => dos(Math.floor(m / 60) % 24) + ':' + dos(m % 60);
  const uid = () => (API.sesionActual() || {}).id;
  const avisar = () => document.dispatchEvent(new CustomEvent('zx:datos'));
  const falla = e => toast(e && e.message ? e.message : 'No se pudo abrir el formulario.', 'no');

  /* ------------------- VACACIONES ------------------- */
  async function vacaciones() {
    let yo;
    try { yo = await API.empleados.uno(uid()); } catch (e) { return falla(e); }
    if (!yo) return toast('No se encontró tu registro de personal.', 'no');
    const disp = yo.dias + (yo.pendActivos ? yo.diasPend : 0);
    let naturales = 0;
    const body = modal({
      titulo: 'Solicitar vacaciones',
      cuerpo:
        '<div class="disp-big">Tienes <b>' + esc(disp) + '</b> días disponibles</div>' +
        '<div class="disp-sub">Selecciona el rango en el calendario</div>' +
        '<div id="cal"></div>' +
        '<div class="frow" style="margin-top:14px">' +
          '<div class="field"><label>Inicio</label><input id="i" readonly placeholder="—"></div>' +
          '<div class="field"><label>Fin</label><input id="f" readonly placeholder="—"></div>' +
          '<div class="field"><label for="d">Días a tomar</label>' +
            '<input id="d" type="number" min="0.5" step="0.5" placeholder="Ej. 3">' +
          '</div>' +
        '</div>' +
        '<div class="fm-nota" id="dn">Escribe cuántos días se descontarán de tu saldo; puedes usar medios días (0.5). Considera tus días de descanso dentro del rango.</div>' +
        '<div class="field" style="margin-top:12px"><label>Comentario</label><textarea id="c" maxlength="300" placeholder="Motivo o detalles (opcional)"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Enviar solicitud', accion: async (b) => {
            const inicio = $('#i', b).dataset.iso, fin = $('#f', b).dataset.iso;
            const dias = parseFloat(String($('#d', b).value).replace(',', '.'));
            if (!inicio || !fin) return toast('Selecciona el rango de fechas.', 'wa');
            if (!(dias > 0)) return toast('Indica cuántos días vas a tomar.', 'wa');
            if ((dias * 2) % 1 !== 0) return toast('Los días deben ser enteros o medios días (0.5, 1, 1.5…).', 'wa');
            if (dias > naturales) return toast('Pides ' + dias + ' día(s) pero el rango abarca sólo ' + naturales + '.', 'wa');
            if (dias > disp) return toast('Los días solicitados (' + dias + ') exceden tus días disponibles (' + disp + ').', 'wa');
            try {
              await API.vacaciones.solicitar({ empleado: uid(), inicio, fin, dias, comentarioEmpleado: $('#c', b).value });
              cerrarModal(); toast('Solicitud enviada. Queda pendiente de aprobación.', 'ok'); avisar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    const poner = (el, f) => { el.dataset.iso = f || ''; el.value = f ? fmt(f) : ''; };
    calendario($('#cal', body), {
      rango: true,
      onPick: (r) => {
        poner($('#i', body), r.inicio); poner($('#f', body), r.fin);
        naturales = (r.inicio && r.fin) ? diffDias(r.inicio, r.fin) : 0;
        $('#dn', body).textContent = naturales
          ? 'El rango abarca ' + naturales + ' día(s) natural(es). Escribe cuántos se descontarán de tu saldo; puedes usar medios días (0.5).'
          : 'Escribe cuántos días se descontarán de tu saldo; puedes usar medios días (0.5). Considera tus días de descanso dentro del rango.';
      }
    });
  }

  /* ------------------- BANCO DE HORAS ------------------- */
  async function banco() {
    let yo, todas;
    try { [yo, todas] = await Promise.all([API.empleados.uno(uid()), API.vacaciones.banco()]); } catch (e) { return falla(e); }
    if (!yo) return toast('No se encontró tu registro de personal.', 'no');
    const mias = (todas || []).filter(x => x.empleado === uid());
    const desdeOpc = []; for (let m = 0; m < 1440; m += 30) desdeOpc.push(hhmm(m));
    let fecha = null;

    /* Lo que esta persona ya tiene ese día (pendiente o aprobado; lo rechazado no cuenta) */
    const delDia = f => mias.filter(x => x.fecha === f && x.estado !== 'rechazada');
    const usadas = f => Math.max(0, delDia(f).reduce((a, x) => a + (+x.horas || 0), 0));
    const choca = (f, ini, dur) => delDia(f).some(x => {
      if (!/^\d\d:\d\d$/.test(x.horaInicio || '') || !/^\d\d:\d\d$/.test(x.horaFin || '')) return false;
      const e = minDe(x.horaInicio), d = ((minDe(x.horaFin) - e) + 1440) % 1440;
      return d > 0 && d <= LIMITE_DIA * 60 && e < ini + dur && ini < e + d;
    });

    const body = modal({
      titulo: 'Solicitar banco de horas',
      cuerpo:
        '<div class="disp-big">Tienes <b>' + esc(yo.horas) + '</b> h disponibles</div>' +
        '<div class="disp-sub">Selecciona el día en el calendario</div>' +
        '<div id="cal"></div>' +
        '<div class="fm-nota" id="info" style="margin:10px 0 0">Máximo ' + LIMITE_DIA + ' horas por solicitud y por día.</div>' +
        '<div class="frow" style="margin-top:12px">' +
          '<div class="field"><label>Fecha de uso</label><input id="f" readonly placeholder="—"></div>' +
          '<div class="field"><label for="hi">Desde</label><select id="hi">' + desdeOpc.map(h => '<option>' + h + '</option>').join('') + '</select></div>' +
          '<div class="field"><label for="hf">Hasta</label><select id="hf" disabled></select></div>' +
        '</div>' +
        '<div class="fm-total" id="tot"></div>' +
        '<div class="field"><label>Comentario</label><textarea id="c" maxlength="300" placeholder="Opcional"></textarea></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Enviar solicitud', accion: async (b) => {
            const hi = $('#hi', b).value, hf = $('#hf', b).value;
            if (!fecha) return toast('Selecciona la fecha de uso.', 'wa');
            if (!hf) return toast('Selecciona la hora final (Hasta).', 'wa');
            const dur = ((minDe(hf) - minDe(hi)) + 1440) % 1440;
            try {
              await API.vacaciones.solicitarBanco({ empleado: uid(), fecha, horas: dur / 60, horaInicio: hi, horaFin: hf, comentarioEmpleado: $('#c', b).value });
              cerrarModal(); toast('Solicitud de banco de horas enviada.', 'ok'); avisar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });

    /* "Hasta": sólo las siguientes horas permitidas a partir de "Desde", en pasos de media hora */
    function pintaHasta() {
      const sel = $('#hf', body), info = $('#info', body), tot = $('#tot', body);
      if (!fecha) { sel.innerHTML = ''; sel.disabled = true; tot.textContent = ''; return; }
      const ini = minDe($('#hi', body).value);
      const usado = usadas(fecha);
      const queda = Math.max(0, LIMITE_DIA - usado);
      const tope = Math.min(LIMITE_DIA, queda, Math.max(0, +yo.horas || 0));
      info.textContent = usado > 0
        ? 'Ya tienes ' + usado + ' h solicitadas ese día; ' + (queda > 0 ? 'puedes pedir hasta ' + queda + ' h más.' : 'no puedes pedir más.')
        : 'Máximo ' + LIMITE_DIA + ' horas por solicitud y por día.';
      let opciones = '';
      for (let p = 1; p <= tope * 2; p++) {
        const fin = ini + p * 30;
        if (choca(fecha, ini, p * 30)) break;                  // a partir de aquí se encima con otra solicitud
        opciones += '<option value="' + hhmm(fin) + '">' + hhmm(fin) + (fin >= 1440 ? ' (día siguiente)' : '') + '</option>';
      }
      sel.innerHTML = opciones; sel.disabled = !opciones;
      if (!opciones) {
        tot.innerHTML = '<span style="color:var(--dnt)">' + (queda <= 0 ? 'Ya tienes el máximo de horas solicitadas ese día.' :
          (tope <= 0 ? 'No tienes horas disponibles.' : 'Ese horario se encima con otra solicitud tuya del mismo día.')) + '</span>';
      } else pintaTotal();
    }
    function pintaTotal() {
      const hf = $('#hf', body).value; if (!hf) { $('#tot', body).textContent = ''; return; }
      const dur = ((minDe(hf) - minDe($('#hi', body).value)) + 1440) % 1440;
      $('#tot', body).innerHTML = 'Total: <b>' + (dur / 60) + ' h</b>';
    }
    $('#hi', body).addEventListener('change', pintaHasta);
    $('#hf', body).addEventListener('change', pintaTotal);
    calendario($('#cal', body), {
      onPick: f => { fecha = f; $('#f', body).value = fmt(f); pintaHasta(); }
    });
  }

  /* ------------------- CITA MÉDICA ------------------- */
  async function cita() {
    let ag, medico = '';
    try { ag = await API.citas.agenda(); } catch (e) { return falla(e); }
    if (ag.medico) { try { const m = await API.empleados.uno(ag.medico); medico = m ? m.nombre : ''; } catch (e) { /* sin nombre */ } }
    let fecha = null, token = 0;
    const proximoHabil = (f) => {
      let x = f;
      for (let i = 0; i < 30; i++) { if (ag.diasHabiles.indexOf(parse(x).getDay()) >= 0) return x; x = sumaDias(x, 1); }
      return f;
    };
    const body = modal({
      titulo: 'Agendar cita médica',
      cuerpo:
        '<div class="disp-big" style="font-size:19px">Servicio médico de empresa</div>' +
        '<div class="disp-sub" style="margin-bottom:4px">' + esc((medico ? medico + ' · ' : '') + 'consultas de ' + ag.duracionMin + ' minutos') + '</div>' +
        '<div class="disp-sub">Selecciona el día en el calendario</div>' +
        '<div id="cal"></div>' +
        '<div class="fm-nota">Atención de lunes a viernes. Los días sin servicio aparecen deshabilitados.</div>' +
        '<div class="frow" style="margin-top:12px">' +
          '<div class="field"><label>Fecha</label><input id="f" readonly placeholder="—"></div>' +
          '<div class="field"><label for="h">Hora</label><select id="h" disabled><option value="">Selecciona una fecha</option></select></div>' +
        '</div>' +
        '<div class="fm-nota" id="libres" style="margin:-4px 0 10px"></div>' +
        '<div class="field"><label for="motivo">Motivo de la consulta</label>' +
          '<input id="motivo" maxlength="150" placeholder="Ej. Revisión general, seguimiento, malestar"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Confirmar cita', accion: async (b) => {
            const hora = $('#h', b).value, motivo = $('#motivo', b).value.trim();
            if (!fecha || !hora) return toast('Selecciona fecha y hora.', 'wa');
            if (!motivo) return toast('Escribe el motivo de la consulta.', 'wa');
            try {
              await API.citas.agendar({ empleado: uid(), fecha, hora, motivo });
              cerrarModal(); toast('Cita confirmada para el ' + fmt(fecha) + ' a las ' + hora + '.', 'ok'); avisar();
            } catch (e) { toast(e.message, 'no'); }
          } }
      ]
    });
    async function pintaHoras(f) {
      const yo = ++token, sel = $('#h', body), nota = $('#libres', body);
      $('#f', body).value = fmt(f);
      sel.disabled = true; sel.innerHTML = '<option value="">Consultando disponibilidad…</option>'; nota.textContent = '';
      let d;
      try { d = await API.citas.disponibilidad(f); } catch (e) { sel.innerHTML = '<option value="">—</option>'; return toast(e.message, 'no'); }
      if (yo !== token) return;                                        // se eligió otro día mientras tanto
      if (!d.habil) { sel.innerHTML = '<option value="">Sin servicio ese día</option>'; nota.textContent = 'El servicio médico no atiende ese día.'; return; }
      if (d.bloqueo) { sel.innerHTML = '<option value="">Sin servicio</option>'; nota.textContent = 'Sin servicio: ' + d.bloqueo; return; }
      const libres = d.slots.filter(s => s.libre);
      if (!libres.length) { sel.innerHTML = '<option value="">Sin horarios disponibles</option>'; nota.textContent = 'No quedan horarios disponibles el ' + fmt(f) + '.'; return; }
      sel.innerHTML = '<option value="">Selecciona una hora</option>' + libres.map(s => '<option value="' + esc(s.hora) + '">' + esc(s.hora) + ' h</option>').join('');
      sel.disabled = false;
      nota.textContent = libres.length + ' de ' + d.slots.length + ' horarios disponibles el ' + fmt(f) + '.';
    }
    fecha = proximoHabil(hoyISO());
    calendario($('#cal', body), {
      valor: fecha, min: hoyISO(),
      deshabilitado: f => ag.diasHabiles.indexOf(parse(f).getDay()) < 0,
      onPick: f => { fecha = f; pintaHoras(f); }
    });
    pintaHoras(fecha);
  }

  ZX.formularios = { vacaciones, banco, cita };
})(window);

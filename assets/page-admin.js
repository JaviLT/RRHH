/* ============================================================
   Portal RRHH — Administración del sistema
   Usuarios (nivel + perfil), perfiles y módulos, y bitácora.
   ------------------------------------------------------------
   Modelo de dos ejes por persona (ver la tabla empleados):
   · nivel  → jerarquía (empleado / jefe). Fijo,
     no se crea ni se edita aquí.
   · perfil → función/módulos extra. Editable: se pueden crear perfiles
     nuevos y asignarles o quitarles módulos desde la pestaña
     "Perfiles y módulos".
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, fmt, hoyISO, tabla, modal, cerrarModal, confirmar, toast, descargarCSV,
          NIVEL_NOMBRE, PERFIL_NOMBRE, ACCESO_TEXTO } = window.ZX;
  const API = window.ZX_API;
  const NIVELES = window.ZX_CAT.NIVELES;

  /* Módulos que un perfil puede llevar. Los universales (vacaciones,
     medico, citas, privacidad) no aparecen: los tiene todo el mundo,
     asignarlos a un perfil no tendría efecto. */
  const MODULOS_ASIGNABLES = ['analisis', 'aptitud', 'indicadores', 'rrhh', 'admin'];

  const sesion = ZX.requiereSesion('admin');
  if (!sesion) return;

  const vistas = [
    { id: 'usuarios', nombre: 'Usuarios',          ico: '👤' },
    { id: 'equipos',  nombre: 'Jefes y equipos',    ico: '🧭' },
    { id: 'perfiles', nombre: 'Perfiles y módulos', ico: '🧩' },
    { id: 'matriz',   nombre: 'Matriz de permisos', ico: '🔑' },
    { id: 'bitacora', nombre: 'Bitácora de auditoría', ico: '🧾' }
  ];
  const shell = ZX.montarShell('admin', 'Administración del sistema', vistas);
  const main = shell.main;

  let D = { emps: [], log: [], perfiles: [] }, vista = 'usuarios';
  ZX.bindVistas(v => { vista = v; render(); });
  ZX.arranque(async function () { ZX.cargando(main); await cargar(); render(); });

  async function cargar() {
    const [emps, log, perfiles] = await Promise.all([API.empleados.lista(), API.auditoria.lista(), API.admin.perfiles()]);
    D = { emps, log, perfiles };
  }
  async function refrescar() { await cargar(); render(); }
  function render() { ({ usuarios, equipos, perfiles, matriz, bitacora }[vista] || usuarios)(); }

  const perfilDe = id => D.perfiles.find(p => p.id === id) || { id, nombre: id, modulos: [] };
  const nombreModulo = id => (ZX.MODULOS.find(m => m.id === id) || {}).nombre || id;

  /* ---------------------- USUARIOS ---------------------- */
  let q = '', fNivel = '', fPerfil = '';
  function usuarios() {
    const lista = D.emps.filter(e =>
      (!fNivel || e.nivel === fNivel) && (!fPerfil || e.perfil === fPerfil) &&
      (!q || (e.nombre + ' ' + e.id + ' ' + e.correo).toLowerCase().indexOf(q.toLowerCase()) >= 0));

    main.innerHTML =
      cab('Usuarios y acceso', D.emps.length + ' usuarios registrados', '<button class="btn gh" id="csv">⬇ CSV</button>') +
      '<div class="priv">🔑 <div><b>Nivel y perfil son independientes.</b> El nivel es la jerarquía (a quién apruebas, ' +
      'a quién ves como "tu equipo"). El perfil son los módulos extra que ves además de los universales. Cambiar ' +
      'cualquiera de los dos surte efecto en el siguiente inicio de sesión y queda en la bitácora.</div></div>' +
      '<div class="grid g4">' +
        k('Usuarios activos', D.emps.filter(e => e.estatus !== 'baja').length, 'Con acceso al portal') +
        k('Perfiles en uso', new Set(D.emps.map(e => e.perfil)).size + ' de ' + D.perfiles.length, 'Configurados en el sistema') +
        k('Con acceso clínico', D.emps.filter(e => e.perfil === 'medico').length, 'Perfil Salud Ocupacional', 'wn') +
        k('Administradores', D.emps.filter(e => e.perfil === 'admin').length, 'Acceso total al sistema', 'wn') +
      '</div>' +
      '<div class="filters" style="margin-top:14px">' +
        '<div class="field" style="min-width:220px"><label>Buscar</label>' +
          '<input id="q" value="' + esc(q) + '" placeholder="Nombre, número o correo"></div>' +
        '<div class="field"><label>Nivel</label><select id="fn">' +
          [['', 'Todos']].concat(Object.keys(NIVELES).map(n => [n, NIVELES[n].nombre])).map(p =>
            '<option value="' + esc(p[0]) + '"' + (p[0] === fNivel ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Perfil</label><select id="fp">' +
          [['', 'Todos']].concat(D.perfiles.map(p => [p.id, p.nombre])).map(p =>
            '<option value="' + esc(p[0]) + '"' + (p[0] === fPerfil ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      tabla([
        { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Reporta a', v: e => e.jefe ? nombreDe(e.jefe) : '—' },
        { t: 'Departamento', k: 'departamento' }, { t: 'Puesto', k: 'puesto' },
        { t: 'Nivel', html: e => '<span class="chip in">' + esc(NIVEL_NOMBRE(e.nivel)) + '</span>' },
        { t: 'Perfil', html: e => e.perfil !== 'ninguno' ? '<span class="chip wn">' + esc(PERFIL_NOMBRE(e.perfil)) + '</span>' : '<span class="chip nt">—</span>' },
        { t: 'Estatus', html: e => '<span class="chip ' + (e.estatus === 'baja' ? 'no' : 'ok') + '">' + esc(e.estatus || 'activo') + '</span>' },
        { t: '', html: e => '<div class="btn-row"><button class="btn sm" data-acc="' + esc(e.id) + '">Cambiar acceso</button>' +
            '<button class="btn gh sm" data-est="' + esc(e.id) + '">' + (e.estatus === 'baja' ? 'Reactivar' : 'Suspender') + '</button></div>' }
      ], lista, { vacio: 'Sin coincidencias.' });

    ZX.pie(main, 'La lista de usuarios se deriva del maestro de personal. En el modelo final las altas y bajas llegarán desde IBIX y esta pantalla sólo administrará nivel y perfil.');
    const qi = $('#q');
    qi.addEventListener('input', () => { q = qi.value; const p = qi.selectionStart; usuarios(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
    $('#fn').addEventListener('change', e => { fNivel = e.target.value; usuarios(); });
    $('#fp').addEventListener('change', e => { fPerfil = e.target.value; usuarios(); });
    $('#csv').addEventListener('click', () => descargarCSV('Usuarios_Portal_' + hoyISO() + '.csv', [
      { t: 'Número', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Correo', k: 'correo' },
      { t: 'Departamento', k: 'departamento' }, { t: 'Nivel', v: e => NIVEL_NOMBRE(e.nivel) },
      { t: 'Perfil', v: e => PERFIL_NOMBRE(e.perfil) }, { t: 'Estatus', k: 'estatus' }
    ], lista));
    $$('[data-acc]').forEach(b => b.addEventListener('click', () => popupAcceso(b.dataset.acc)));
    $$('[data-est]').forEach(b => b.addEventListener('click', () => cambiarEstatus(b.dataset.est)));
  }

  function popupAcceso(id) {
    const e = D.emps.find(x => x.id === id);
    const body = modal({
      titulo: 'Cambiar acceso · ' + e.nombre,
      cuerpo:
        '<p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">Acceso actual: <b>' + esc(ACCESO_TEXTO(e)) + '</b></p>' +
        '<div class="field"><label for="nv">Nivel (jerarquía)</label><select id="nv">' +
          Object.keys(NIVELES).map(n => '<option value="' + esc(n) + '"' + (n === e.nivel ? ' selected' : '') + '>' +
            esc(NIVELES[n].nombre) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label for="pf">Perfil (módulos)</label><select id="pf">' +
          D.perfiles.map(p => '<option value="' + esc(p.id) + '"' + (p.id === e.perfil ? ' selected' : '') + '>' +
            esc(p.nombre) + '</option>').join('') +
        '</select></div>' +
        '<div id="prev" class="nota"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Aplicar cambio', accion: async (b) => {
            try {
              await API.admin.cambiarAcceso(id, $('#nv', b).value, $('#pf', b).value, sesion.id);
              cerrarModal(); toast('Acceso actualizado.', 'ok'); await refrescar();
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
    const pinta = () => {
      const nivel = $('#nv', body).value, perfilId = $('#pf', body).value;
      const p = perfilDe(perfilId);
      const universales = ZX.MODULOS.filter(m => m.roles === '*').map(m => m.nombre);
      const extra = p.modulos.map(nombreModulo);
      if (nivel === 'jefe') extra.push('Aptitud y restricciones (de su equipo)');
      $('#prev', body).innerHTML = '<b>Con este acceso verá:</b> ' + esc(universales.concat(extra).join(' · ')) +
        (perfilId === 'medico' ? '<br><b style="color:var(--dnt)">Incluye acceso a datos clínicos individuales.</b>' : '') +
        (perfilId === 'admin' ? '<br><b style="color:var(--dnt)">Incluye administración de usuarios y bitácora.</b>' : '');
    };
    $('#nv', body).addEventListener('change', pinta);
    $('#pf', body).addEventListener('change', pinta);
    pinta();
  }

  function cambiarEstatus(id) {
    const e = D.emps.find(x => x.id === id);
    const nuevo = e.estatus === 'baja' ? 'activo' : 'baja';
    confirmar(nuevo === 'baja' ? 'Suspender acceso' : 'Reactivar acceso',
      (nuevo === 'baja'
        ? '¿Suspender el acceso de ' + e.nombre + '? No podrá iniciar sesión, pero su expediente y su historial se conservan.'
        : '¿Reactivar el acceso de ' + e.nombre + '?'),
      async () => {
        try { await API.auditoria.cambiarEstatus(id, nuevo); toast('Estatus actualizado.', 'ok'); await refrescar(); }
        catch (ex) { toast(ex.message, 'no'); }
      });
  }

  /* ---------------------- JEFES Y EQUIPOS ----------------------
     Flujo en cadena: elige una persona → ponle su nivel (Jefe/Gerente,
     Coordinador...) → agrega quién está a su cargo → entra a cualquiera
     de ellos ("Ver su equipo →") y repite para armar el siguiente nivel.
     Lo que se guarda es `jefe` en cada empleado: decide quién aprueba
     vacaciones/banco de horas y qué equipo ve cada jefe. */
  let selId = null, qEq = '', fEq = '';

  const porId = id => D.emps.find(e => e.id === id);
  const equipoDe = id => D.emps.filter(e => e.jefe === id && e.estatus !== 'baja');
  function cadenaArriba(id) {
    const c = []; let a = porId(id) && porId(id).jefe, n = 0;
    while (a && n++ < 50) { const e = porId(a); if (!e) break; c.unshift(e); a = e.jefe; }
    return c;
  }
  function descendientes(id) {
    const out = new Set(), pila = [id];
    while (pila.length) {
      const x = pila.pop();
      D.emps.forEach(e => { if (e.jefe === x && !out.has(e.id)) { out.add(e.id); pila.push(e.id); } });
    }
    return out;
  }
  const coincide = (e, q) => !q || (e.nombre + ' ' + e.id + ' ' + (e.puesto || '') + ' ' + (e.direccion || '') + ' ' + (e.departamento || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0;

  function equipos() {
    const activos = D.emps.filter(e => e.estatus !== 'baja');
    const jefesIds = new Set(D.emps.filter(e => e.jefe).map(e => e.jefe));
    const sinJefe = activos.filter(e => !e.jefe).length;
    const lista = activos.filter(e => coincide(e, qEq) &&
      (!fEq || (fEq === 'sinjefe' ? !e.jefe : jefesIds.has(e.id))));
    const visibles = lista.slice(0, 80);
    const sel = selId ? porId(selId) : null;

    const filas = visibles.map(e =>
      '<div class="eq-row' + (e.id === selId ? ' on' : '') + '" data-pick="' + esc(e.id) + '">' +
        '<b>' + esc(e.nombre) + '</b>' +
        '<div class="eq-sub">' + esc(e.puesto || '—') + (e.departamento ? ' · ' + esc(e.departamento) : '') + '</div>' +
        '<div class="eq-sub"><span class="chip in">' + esc(NIVEL_NOMBRE(e.nivel)) + '</span> ' +
          (e.jefe ? 'Reporta a ' + esc(nombreDe(e.jefe)) : '<span style="color:var(--wnt)">Sin jefe asignado</span>') +
          (jefesIds.has(e.id) ? ' · <b>' + equipoDe(e.id).length + ' a su cargo</b>' : '') + '</div>' +
      '</div>').join('');

    main.innerHTML =
      cab('Jefes y equipos', 'Asigna el nivel de cada persona y quién está a su cargo') +
      '<div class="priv">🧭 <div><b>Cómo se arma el organigrama.</b> Elige a una persona de la izquierda, ' +
      'dale el nivel Jefe y agrega a quienes están a su cargo. Después entra a ' +
      'cualquiera de ellos con <b>"Ver su equipo →"</b> para asignar a quién tiene a su cargo <i>esa</i> persona, ' +
      'y así hacia abajo. Este dato decide quién aprueba vacaciones y banco de horas de cada quien. ' +
      'Al cambiar el jefe de alguien, sus solicitudes pendientes pasan al jefe nuevo.</div></div>' +
      '<div class="grid g4">' +
        k('Personas activas', activos.length, 'En el portal') +
        k('Sin jefe asignado', sinJefe, 'Aún sin cadena de aprobación', sinJefe ? 'wn' : '') +
        k('Jefes con equipo', jefesIds.size, 'Tienen a alguien a su cargo') +
      '</div>' +
      '<div class="eq-grid" style="margin-top:14px">' +
        '<div class="card eq-left">' +
          '<div class="filters" style="margin-bottom:8px">' +
            '<div class="field" style="flex:1"><label>Buscar persona</label>' +
              '<input id="qeq" value="' + esc(qEq) + '" placeholder="Nombre, nómina, puesto, dirección o departamento"></div>' +
            '<div class="field"><label>Mostrar</label><select id="feq">' +
              [['', 'Todos'], ['sinjefe', 'Sin jefe'], ['jefes', 'Sólo jefes']].map(p =>
                '<option value="' + p[0] + '"' + (p[0] === fEq ? ' selected' : '') + '>' + p[1] + '</option>').join('') +
            '</select></div>' +
          '</div>' +
          '<div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">' + lista.length + ' persona(s)' +
            (lista.length > visibles.length ? ' — mostrando las primeras ' + visibles.length + ', afina la búsqueda' : '') + '</div>' +
          '<div class="eq-list">' + (filas || '<div class="empty">Sin coincidencias.</div>') + '</div>' +
        '</div>' +
        '<div class="card eq-right">' + (sel ? detalleEquipo(sel) : '<div class="empty">Elige a una persona de la izquierda.</div>') + '</div>' +
      '</div>';

    ZX.pie(main, 'Un cambio de jefe queda en la bitácora. La base de datos rechaza que alguien sea su propio jefe o jefe de su jefe.');

    const qi = $('#qeq');
    qi.addEventListener('input', () => { qEq = qi.value; const p = qi.selectionStart; equipos(); const n = $('#qeq'); n.focus(); n.setSelectionRange(p, p); });
    $('#feq').addEventListener('change', ev => { fEq = ev.target.value; equipos(); });
    $$('[data-pick]').forEach(r => r.addEventListener('click', () => { selId = r.dataset.pick; equipos(); }));
    $$('[data-sel]').forEach(b => b.addEventListener('click', () => { selId = b.dataset.sel; equipos(); }));
    if (sel) enlazarDetalle(sel);
  }

  function detalleEquipo(e) {
    const arriba = cadenaArriba(e.id);
    const equipo = equipoDe(e.id);
    const migas = arriba.map(x => '<a href="#" data-sel="' + esc(x.id) + '">' + esc(x.nombre) + '</a>').join(' › ');
    return '<div class="card-t">' + esc(e.nombre) + '</div>' +
      '<div style="font-size:12px;color:var(--tx2);margin:-6px 0 10px">Nómina ' + esc(e.id) + ' · ' + esc(e.puesto || '—') +
        (e.departamento ? ' · ' + esc(e.departamento) : '') + '</div>' +
      (arriba.length ? '<div style="font-size:12px;margin-bottom:10px">Cadena hacia arriba: ' + migas + ' › <b>' + esc(e.nombre) + '</b></div>' : '') +

      '<div class="frow">' +
        '<div class="field"><label for="eqniv">Nivel</label><select id="eqniv">' +
          Object.keys(NIVELES).map(n => '<option value="' + esc(n) + '"' + (n === e.nivel ? ' selected' : '') + '>' + esc(NIVELES[n].nombre) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Perfil (módulos)</label><div style="display:flex;gap:8px;align-items:center">' +
          '<span class="chip ' + (e.perfil !== 'ninguno' ? 'wn' : 'nt') + '">' + esc(e.perfil !== 'ninguno' ? PERFIL_NOMBRE(e.perfil) : 'Sin perfil adicional') + '</span>' +
          '<button class="btn gh sm" id="eqperfil">Cambiar perfil</button></div></div>' +
      '</div>' +
      '<div class="btn-row" style="margin-bottom:12px"><button class="btn sm" id="eqguardaniv">Guardar nivel</button></div>' +

      '<div class="field"><label>Reporta a</label><div style="display:flex;gap:8px;align-items:center">' +
        '<b>' + (e.jefe ? esc(nombreDe(e.jefe)) : 'Sin jefe asignado') + '</b>' +
        '<button class="btn gh sm" id="eqjefe">' + (e.jefe ? 'Cambiar jefe' : 'Asignar jefe') + '</button></div></div>' +

      '<div class="card-t" style="margin-top:16px">Tiene a su cargo (' + equipo.length + ')</div>' +
      (equipo.length
        ? '<div class="tbl-wrap"><table><thead><tr><th>Nombre</th><th>Puesto</th><th>Nivel</th><th>A su cargo</th><th></th></tr></thead><tbody>' +
          equipo.map(m => '<tr><td><b>' + esc(m.nombre) + '</b></td><td>' + esc(m.puesto || '—') + '</td>' +
            '<td><span class="chip in">' + esc(NIVEL_NOMBRE(m.nivel)) + '</span></td>' +
            '<td>' + equipoDe(m.id).length + '</td>' +
            '<td><div class="btn-row"><button class="btn sm" data-sel="' + esc(m.id) + '">Ver su equipo →</button>' +
            '<button class="btn gh sm" data-quitar="' + esc(m.id) + '">Quitar</button></div></td></tr>').join('') +
          '</tbody></table></div>'
        : '<div class="empty">Nadie a su cargo todavía.</div>') +
      '<div class="btn-row" style="margin-top:10px"><button class="btn" id="eqagregar">+ Agregar personas a su cargo</button></div>';
  }

  function enlazarDetalle(e) {
    $('#eqguardaniv').addEventListener('click', async () => {
      const nivel = $('#eqniv').value;
      if (nivel === e.nivel) return toast('Ya tiene ese nivel.', 'wa');
      try { await API.admin.cambiarAcceso(e.id, nivel, e.perfil, sesion.id); toast('Nivel actualizado.', 'ok'); await refrescar(); }
      catch (ex) { toast(ex.message, 'no'); }
    });
    $('#eqperfil').addEventListener('click', () => popupAcceso(e.id));
    $('#eqjefe').addEventListener('click', () => popupElegirJefe(e));
    $('#eqagregar').addEventListener('click', () => popupAgregarEquipo(e));
    $$('[data-quitar]').forEach(b => b.addEventListener('click', () => {
      const m = porId(b.dataset.quitar);
      confirmar('Quitar del equipo', '¿Quitar a ' + m.nombre + ' del equipo de ' + e.nombre + '? Quedará sin jefe asignado.', async () => {
        try { await API.admin.cambiarJefe(m.id, null, sesion.id); toast('Listo.', 'ok'); await refrescar(); }
        catch (ex) { toast(ex.message, 'no'); }
      });
    }));
  }

  /* Elegir (o quitar) el jefe de una persona. No se ofrecen ella misma ni
     quienes dependen de ella: formarían un ciclo. */
  function popupElegirJefe(e) {
    const prohibidos = descendientes(e.id); prohibidos.add(e.id);
    let elegido = e.jefe || '', q = '';
    const body = modal({
      titulo: 'Jefe de ' + e.nombre, ancho: 'lg',
      cuerpo: '<div class="field"><label for="qj">Buscar</label><input id="qj" placeholder="Nombre, nómina o puesto"></div>' +
        '<div id="lstj" class="eq-list" style="max-height:340px"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Guardar', accion: async () => {
            try { await API.admin.cambiarJefe(e.id, elegido || null, sesion.id); cerrarModal(); toast('Jefe actualizado.', 'ok'); await refrescar(); }
            catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
    const pinta = () => {
      const cand = D.emps.filter(x => x.estatus !== 'baja' && !prohibidos.has(x.id) && coincide(x, q)).slice(0, 60);
      $('#lstj', body).innerHTML =
        '<label class="chk"><input type="radio" name="jf" value=""' + (!elegido ? ' checked' : '') + '><span><b>Sin jefe</b></span></label>' +
        cand.map(x => '<label class="chk"><input type="radio" name="jf" value="' + esc(x.id) + '"' + (x.id === elegido ? ' checked' : '') + '>' +
          '<span><b>' + esc(x.nombre) + '</b> · ' + esc(x.puesto || '—') + ' <i style="color:var(--tx3)">(' + esc(NIVEL_NOMBRE(x.nivel)) + ')</i></span></label>').join('');
    };
    $('#lstj', body).addEventListener('change', ev => { if (ev.target.name === 'jf') elegido = ev.target.value; });
    $('#qj', body).addEventListener('input', ev => { q = ev.target.value; pinta(); });
    pinta();
  }

  /* Agregar varias personas al equipo de `e`. Si e todavía es "Empleado",
     se le sube de nivel en el mismo paso: sin el nivel Jefe
     no puede aprobar nada aunque tenga gente a su cargo. */
  function popupAgregarEquipo(e) {
    const ancestros = new Set(cadenaArriba(e.id).map(x => x.id)); ancestros.add(e.id);
    const yaSuyos = new Set(equipoDe(e.id).map(x => x.id));
    const marcados = new Set(); let q = '';
    const body = modal({
      titulo: 'Agregar personas al equipo de ' + e.nombre, ancho: 'lg',
      cuerpo:
        '<div class="hint" style="margin:0 0 10px">Quien tiene gente a su cargo debe tener el nivel <b>Jefe</b> para aprobar vacaciones y banco de horas de su equipo' + (e.nivel === 'jefe' ? '.' : '; como ' + esc(e.nombre) + ' aún es Empleado, se le sube a Jefe al agregar a su equipo.') + '</div>' +
        '<div class="field"><label for="qa">Buscar</label><input id="qa" placeholder="Nombre, nómina, puesto, dirección o departamento"></div>' +
        '<div id="cnt" style="font-size:12px;margin:4px 0"></div>' +
        '<div id="lsta" class="eq-list" style="max-height:320px"></div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Agregar al equipo', accion: async () => {
            if (!marcados.size) return toast('Marca al menos a una persona.', 'wa');
            try {
              if (e.nivel !== 'jefe') await API.admin.cambiarAcceso(e.id, 'jefe', e.perfil, sesion.id);
              const n = await API.admin.asignarEquipo(e.id, Array.from(marcados), sesion.id);
              cerrarModal(); toast(n + ' persona(s) agregadas al equipo.', 'ok'); await refrescar();
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
    const pinta = () => {
      const cand = D.emps.filter(x => x.estatus !== 'baja' && !ancestros.has(x.id) && !yaSuyos.has(x.id) && coincide(x, q));
      const vis = cand.slice(0, 80);
      $('#lsta', body).innerHTML = vis.map(x =>
        '<label class="chk"><input type="checkbox" data-id="' + esc(x.id) + '"' + (marcados.has(x.id) ? ' checked' : '') + '>' +
        '<span><b>' + esc(x.nombre) + '</b> · ' + esc(x.puesto || '—') +
        (x.jefe ? ' <i style="color:var(--wnt)">(hoy reporta a ' + esc(nombreDe(x.jefe)) + ' — pasará a este equipo)</i>' : ' <i style="color:var(--tx3)">(sin jefe)</i>') +
        '</span></label>').join('') || '<div class="empty">Sin coincidencias.</div>';
      $('#cnt', body).innerHTML = '<b>' + marcados.size + '</b> seleccionada(s) · ' + cand.length + ' disponible(s)' +
        (cand.length > vis.length ? ' (mostrando ' + vis.length + ', afina la búsqueda)' : '');
    };
    $('#lsta', body).addEventListener('change', ev => {
      const id = ev.target.dataset.id; if (!id) return;
      if (ev.target.checked) marcados.add(id); else marcados.delete(id);
      $('#cnt', body).querySelector('b').textContent = marcados.size;
    });
    $('#qa', body).addEventListener('input', ev => { q = ev.target.value; pinta(); });
    pinta();
  }

  /* ---------------------- PERFILES Y MÓDULOS ---------------------- */
  function perfiles() {
    main.innerHTML =
      cab('Perfiles y módulos', D.perfiles.length + ' perfiles configurados', '<button class="btn" id="nuevo">+ Nuevo perfil</button>') +
      '<div class="priv">🧩 <div><b>Un perfil es un paquete de módulos.</b> Los universales (Vacaciones, Servicio médico, ' +
      'Citas, Aviso de privacidad) los tiene todo el mundo y no aparecen aquí. Crea un perfil nuevo para agrupar los ' +
      'módulos que un tipo de puesto necesita, y asígnalo desde "Usuarios". Los perfiles marcados como <b>de sistema</b> ' +
      'no se pueden eliminar porque el código depende de que existan (por ejemplo, el acceso clínico individual sólo lo ' +
      'da el perfil <code>medico</code>) — pero sus módulos sí son editables.</div></div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Perfil</th><th>Módulos asignados</th><th>Personas</th><th>Origen</th><th></th></tr></thead><tbody>' +
      D.perfiles.map(p => {
        const n = D.emps.filter(e => e.perfil === p.id).length;
        return '<tr><td><b>' + esc(p.nombre) + '</b></td>' +
          '<td>' + (p.modulos.length ? p.modulos.map(m => '<span class="chip in" style="margin:2px">' + esc(nombreModulo(m)) + '</span>').join('') : '<span class="chip nt">Ninguno</span>') + '</td>' +
          '<td>' + n + '</td>' +
          '<td>' + (p.sistema ? '<span class="chip wn">De sistema</span>' : '<span class="chip nt">Personalizado</span>') + '</td>' +
          '<td><div class="btn-row">' +
            '<button class="btn gh sm" data-editar="' + esc(p.id) + '">Editar módulos</button>' +
            (p.sistema || p.id === 'ninguno' ? '' : '<button class="btn no sm" data-borrar="' + esc(p.id) + '">Eliminar</button>') +
          '</div></td></tr>';
      }).join('') +
      '</tbody></table></div>';

    ZX.pie(main, 'Los perfiles viven en la base de datos. Un perfil de sistema no se puede eliminar, ni uno que tenga personas asignadas.');
    $('#nuevo').addEventListener('click', () => popupPerfil(null));
    $$('[data-editar]').forEach(b => b.addEventListener('click', () => popupPerfil(b.dataset.editar)));
    $$('[data-borrar]').forEach(b => b.addEventListener('click', () => borrarPerfil(b.dataset.borrar)));
  }

  function popupPerfil(id) {
    const p = id ? perfilDe(id) : null;
    modal({
      titulo: p ? 'Editar perfil · ' + p.nombre : 'Nuevo perfil',
      cuerpo:
        '<div class="field"><label for="nom">Nombre del perfil</label><input id="nom" maxlength="60" value="' + esc(p ? p.nombre : '') + '"></div>' +
        '<div class="field"><label>Módulos que otorga</label>' +
          MODULOS_ASIGNABLES.map(mid => {
            const chk = p && p.modulos.indexOf(mid) >= 0;
            return '<label class="chk"><input type="checkbox" value="' + esc(mid) + '"' + (chk ? ' checked' : '') + '>' +
              '<span>' + esc(nombreModulo(mid)) + '</span></label>';
          }).join('') +
        '</div>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: p ? 'Guardar cambios' : 'Crear perfil', accion: async (b) => {
            const nombre = $('#nom', b).value.trim();
            const modulos = Array.from(b.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
            if (!nombre) return toast('Ponle un nombre al perfil.', 'wa');
            try {
              if (p) await API.admin.actualizarPerfil(p.id, { nombre, modulos }, sesion.id);
              else await API.admin.crearPerfil(nombre, modulos, sesion.id);
              cerrarModal(); toast(p ? 'Perfil actualizado.' : 'Perfil creado.', 'ok'); await refrescar();
            } catch (ex) { toast(ex.message, 'no'); }
          } }
      ]
    });
  }

  function borrarPerfil(id) {
    const p = perfilDe(id);
    const enUso = D.emps.filter(e => e.perfil === id).length;
    if (enUso) return toast('Hay ' + enUso + ' persona(s) con este perfil. Reasígnalas primero en Usuarios.', 'wa');
    confirmar('Eliminar perfil', '¿Eliminar el perfil "' + p.nombre + '"? Esta acción no se puede deshacer.', async () => {
      try { await API.admin.eliminarPerfil(id, sesion.id); toast('Perfil eliminado.', 'ok'); await refrescar(); }
      catch (ex) { toast(ex.message, 'no'); }
    });
  }

  /* ---------------------- MATRIZ ---------------------- */
  function matriz() {
    const mods = ZX.modulosVisibles();
    const universales = mods.filter(m => m.roles === '*');
    const porPerfil = mods.filter(m => m.roles !== '*' && !m.nivelExtra);
    const aptitud = mods.find(m => m.id === 'aptitud');

    let filasNivel = '';
    Object.keys(NIVELES).forEach(n => {
      const persona = { nivel: n, perfil: 'ninguno' };
      filasNivel += '<tr><td><b>' + esc(NIVELES[n].nombre) + '</b></td>' +
        universales.map(() => '<td style="text-align:center"><span class="chip ok">Sí</span></td>').join('') +
        (aptitud ? '<td style="text-align:center">' + (ZX.puede(persona, 'aptitud') ? '<span class="chip ok">Sí (su equipo)</span>' : '<span class="chip nt">—</span>') + '</td>' : '') +
        '<td>' + D.emps.filter(e => e.nivel === n).length + '</td></tr>';
    });

    let filasPerfil = '';
    D.perfiles.forEach(p => {
      const persona = { nivel: 'empleado', perfil: p.id };
      filasPerfil += '<tr><td><b>' + esc(p.nombre) + '</b></td>' +
        porPerfil.map(m => '<td style="text-align:center">' + (ZX.puede(persona, m.id)
          ? '<span class="chip ok">Sí</span>' : '<span class="chip nt">—</span>') + '</td>').join('') +
        (aptitud ? '<td style="text-align:center">' + (ZX.puede(persona, 'aptitud') ? '<span class="chip ok">Sí (planta completa)</span>' : '<span class="chip nt">—</span>') + '</td>' : '') +
        '<td>' + D.emps.filter(e => e.perfil === p.id).length + '</td></tr>';
    });

    main.innerHTML =
      cab('Matriz de permisos', 'Qué módulo ve cada nivel y cada perfil') +
      '<div class="card"><div class="card-t">Universales — todos los tienen</div>' +
        '<p style="font-size:13px">' + universales.map(m => m.ico + ' ' + esc(m.nombre)).join(' · ') + '</p></div>' +
      '<div class="card"><div class="card-t">Por nivel (jerarquía)</div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Nivel</th>' +
        universales.map(m => '<th style="text-align:center">' + m.ico + '<br>' + esc(m.nombre) + '</th>').join('') +
        (aptitud ? '<th style="text-align:center">' + aptitud.ico + '<br>' + esc(aptitud.nombre) + '</th>' : '') +
        '<th>Personas</th></tr></thead><tbody>' + filasNivel + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-t">Por perfil (función)</div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Perfil</th>' +
        porPerfil.map(m => '<th style="text-align:center">' + m.ico + '<br>' + esc(m.nombre) + '</th>').join('') +
        (aptitud ? '<th style="text-align:center">' + aptitud.ico + '<br>' + esc(aptitud.nombre) + '</th>' : '') +
        '<th>Personas</th></tr></thead><tbody>' + filasPerfil + '</tbody></table></div></div>' +
      '<div class="nota"><b>Regla de oro del proyecto.</b> El acceso a datos clínicos individuales está limitado al perfil ' +
      '<b>Salud Ocupacional</b>. Seguridad Industrial ve aptitud y restricciones, no diagnósticos; Recursos Humanos no ve ' +
      'el expediente médico; el administrador gestiona accesos y bitácora, no contenido clínico. Esta matriz es la ' +
      'referencia del cliente: <b>el servidor debe aplicar la misma matriz en cada endpoint</b>, porque ocultar un menú ' +
      'no impide que alguien escriba la URL directamente.</div>';
    ZX.pie(main, 'Los módulos universales y la excepción de Aptitud se definen en assets/app.js (constante MODULOS). Los módulos por perfil se definen en la pestaña "Perfiles y módulos" y se reflejan aquí automáticamente.');
  }

  /* ---------------------- BITÁCORA ---------------------- */
  let fAccion = '', fUsuario = '';
  function bitacora() {
    const acciones = Array.from(new Set(D.log.map(l => l.accion))).sort();
    const lista = D.log.filter(l => (!fAccion || l.accion === fAccion) && (!fUsuario || l.usuario === fUsuario));
    const cols = [
      { t: 'Fecha y hora', k: 'fecha' }, { t: 'Usuario', v: l => nombreDe(l.usuario) },
      { t: 'Acción', k: 'accion' }, { t: 'Registro', k: 'entidad' },
      { t: 'Colaborador afectado', v: l => l.afectado ? nombreDe(l.afectado) : '—' }, { t: 'Detalle', k: 'detalle' }
    ];
    const accesosClinicos = D.log.filter(l => l.accion === 'expediente.consultar').length;

    main.innerHTML =
      cab('Bitácora de auditoría', D.log.length + ' movimientos registrados', '<button class="btn gh" id="csv">⬇ CSV</button>') +
      '<div class="priv">🧾 <div><b>La bitácora la escribe el servidor</b> y nadie puede modificarla ni borrarla desde el portal, ' +
      'ni siquiera Administración. Hoy registra cambios de nivel, perfil, jefe y estatus de las personas, altas/cambios/bajas de ' +
      'perfiles, consentimientos y solicitudes ARCO. Todavía no registra consultas, evaluaciones, movimientos RHF-34 ni la ' +
      'validación de análisis.</div></div>' +
      '<div class="grid g4">' +
        k('Movimientos', D.log.length, 'En el periodo almacenado') +
        k('Aperturas de expediente', accesosClinicos, 'Accesos a información clínica') +
        k('Usuarios distintos', new Set(D.log.map(l => l.usuario)).size, 'Con actividad registrada') +
        k('Tipos de acción', acciones.length, 'Operaciones auditadas') +
      '</div>' +
      '<div class="filters" style="margin-top:14px">' +
        '<div class="field"><label>Acción</label><select id="fa">' +
          [['', 'Todas']].concat(acciones.map(a => [a, a])).map(p =>
            '<option value="' + esc(p[0]) + '"' + (p[0] === fAccion ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Usuario</label><select id="fu">' +
          [['', 'Todos']].concat(D.emps.map(e => [e.id, e.nombre])).map(p =>
            '<option value="' + esc(p[0]) + '"' + (p[0] === fUsuario ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      tabla(cols, lista, { vacio: 'Sin movimientos con esos filtros.' });

    ZX.pie(main, 'Toda apertura de expediente clínico queda registrada. Este registro es la evidencia de que el acceso a datos personales sensibles está controlado, como exige la LFPDPPP.');
    $('#fa').addEventListener('change', e => { fAccion = e.target.value; bitacora(); });
    $('#fu').addEventListener('change', e => { fUsuario = e.target.value; bitacora(); });
    $('#csv').addEventListener('click', () => descargarCSV('Bitacora_' + hoyISO() + '.csv', cols, lista));
  }

  /* ---------------------- helpers ---------------------- */
  const nombreDe = id => (D.emps.find(e => e.id === id) || {}).nombre || id;
  function cab(t, sub, acciones) {
    return '<div class="page-head"><div><h1 class="page-t">' + esc(t) + '</h1>' +
           '<div class="page-sub">' + esc(sub || '') + '</div></div><div class="btn-row">' + (acciones || '') + '</div></div>';
  }
  function k(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v ' + (clase || '') + '">' + esc(v) +
           '</div><div class="kpi-d">' + esc(d) + '</div></div>';
  }
})();

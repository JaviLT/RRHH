/* ============================================================
   Portal Zubex — Administración del sistema
   Usuarios (nivel + perfil), perfiles y módulos, y bitácora.
   ------------------------------------------------------------
   Modelo de dos ejes por persona (ver data.demo.js):
   · nivel  → jerarquía (empleado / coordinador / supervisor). Fijo,
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
  const NIVELES = window.ZX_DEMO.NIVELES;

  /* Módulos que un perfil puede llevar. Los universales (vacaciones,
     medico, citas, privacidad) no aparecen: los tiene todo el mundo,
     asignarlos a un perfil no tendría efecto. */
  const MODULOS_ASIGNABLES = ['analisis', 'aptitud', 'indicadores', 'rrhh', 'admin'];

  const sesion = ZX.requiereSesion('admin');
  if (!sesion) return;

  const vistas = [
    { id: 'usuarios', nombre: 'Usuarios',          ico: '👤' },
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
  function render() { ({ usuarios, perfiles, matriz, bitacora }[vista] || usuarios)(); }

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
        { t: 'Nº', k: 'id' }, { t: 'Nombre', k: 'nombre' }, { t: 'Correo', k: 'correo' },
        { t: 'Departamento', k: 'depto' }, { t: 'Puesto', k: 'puesto' },
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
      { t: 'Departamento', k: 'depto' }, { t: 'Nivel', v: e => NIVEL_NOMBRE(e.nivel) },
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
      if (nivel === 'supervisor') extra.push('Aptitud y restricciones (de su equipo)');
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

    ZX.pie(main, 'Los perfiles se guardan en el store del portal (modo demo). Al conectar backend real, esta pantalla debe escribir contra una tabla de perfiles con las mismas reglas: no borrar uno de sistema ni uno con personas asignadas.');
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
      '<div class="priv">🧾 <div><b>Esta bitácora es de demostración.</b> Hoy la escribe el navegador y por eso puede borrarse ' +
      'o alterarse desde el propio equipo. En producción debe escribirla el servidor dentro de la transacción de cada operación, ' +
      'ser inmutable para los usuarios (incluido el administrador) y conservarse con el mismo plazo que el expediente.</div></div>' +
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

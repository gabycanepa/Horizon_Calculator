import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

const cleanNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  let s = String(val);
  s = s.replace(/[$€£\s]/g, '');
  s = s.replace(/[^\d,.\-]/g, '');
  if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const normalizeKey = (k) => {
  if (!k && k !== 0) return '';
  const s = String(k).toLowerCase().trim();
  const accentMap = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
  let out = s.replace(/[áéíóúñ]/g, m => accentMap[m]);
  out = out.replace(/[^a-z0-9]/g, '');
  return out;
};

const tolerantGet = (mapObj, key) => {
  if (!mapObj) return 0;
  const nk = normalizeKey(key);
  for (const k of Object.keys(mapObj)) {
    if (normalizeKey(k) === nk) return mapObj[k];
  }
  return mapObj[key] !== undefined ? mapObj[key] : 0;
};

const fetchSheet = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const parseCSVLine = (line) => {
    const re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)|;(?=(?:(?:[^"]*"){2})*[^"]*$)/g;
    return line.split(re).map(cell => cell.replace(/^"|"$/g, '').trim());
  };
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const obj = {};
    headers.forEach((header, i) => { obj[header] = cells[i] !== undefined ? cells[i] : ''; });
    return obj;
  });
};

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
function LoginScreen({ usuarios, onLogin }) {
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const user = usuarios.find(u =>
      u.nombre.toLowerCase().trim() === nombre.toLowerCase().trim() &&
      u.password.trim() === password.trim()
    );
    if (user) { onLogin(user); }
    else { setError('Usuario o contraseña incorrectos'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm">
        <h1 className="text-2xl font-black text-center bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent uppercase mb-1">
          Horizon Finance Engine
        </h1>
        <p className="text-center text-slate-400 text-xs mb-8">Ingresá tus credenciales para continuar</p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-purple-500 uppercase block mb-1">Usuario</label>
            <input type="text" value={nombre} onChange={e => { setNombre(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border-2 border-purple-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-purple-500"
              placeholder="Tu nombre de usuario" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-purple-500 uppercase block mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border-2 border-purple-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-purple-500"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          <button onClick={handleLogin}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-lg font-black text-sm uppercase hover:shadow-lg transition">
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL VALORES SERVICIOS ──────────────────────────────────────────────────
function ModalValoresServicios({ datos, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white">
          <h2 className="font-black text-sm uppercase">🔍 Valores de Servicios Actuales</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white font-black text-lg">✕</button>
        </div>
        <div className="overflow-auto max-h-[calc(80vh-60px)]">
          {datos.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm italic">Sin datos disponibles</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-purple-50">
                <tr>{Object.keys(datos[0]).map(h => (
                  <th key={h} className="p-3 text-left font-bold text-purple-600 uppercase border-b border-purple-100 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {datos.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="p-3 border-b border-slate-100 text-slate-700">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function App() {
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {},
    usuarios: [], valoresServicios: [], loading: true, error: null
  });

  const [usuarioActual, setUsuarioActual] = useState(null);
  const [mostrarModalValores, setMostrarModalValores] = useState(false);
  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);

  const [isReady, setIsReady] = useState(false);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);

  const [objVentasTotal] = useState(2195176117);
  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hzn_lineasVenta')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }
  });
  const [objRenovacion] = useState(1225673502);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hzn_lineasReno')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }
  });
  const [objIncremental] = useState(969002614);
  const [lineasIncremental, setLineasIncremental] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hzn_lineasIncr')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }
  });

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);
  const [mostrarAporte, setMostrarAporte] = useState(true);

  // ─── PERMISOS ───────────────────────────────────────────────────────────────
  const tienePermiso = (modulo) => {
    if (!usuarioActual) return false;
    const modulos = (usuarioActual.modulos || '').toLowerCase();
    return modulos.includes('todos') || modulos.includes(modulo.toLowerCase());
  };

  // ─── CARGA DE DATOS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [precios, clientes, cfg, eerr, usuarios, valoresServ] = await Promise.all([
          fetchSheet('PreciosNuevos'),
          fetchSheet('Clientes'),
          fetchSheet('Configuracion'),
          fetchSheet('EERRBase'),
          fetchSheet('Usuarios'),
          fetchSheet('Valores_Servicios')
        ]);

        const configObj = {};
        cfg.forEach(row => {
          const key = row['Parámetro'] ?? row['Parametro'] ?? row['Key'] ?? Object.values(row)[0];
          const valCell = row['Valor'] ?? row['Value'] ?? Object.values(row)[1];
          if (key) configObj[String(key).trim()] = cleanNum(valCell);
        });

        const eerrObj = {};
        eerr.forEach(row => {
          const concepto = row['Concepto'] ?? Object.values(row)[0];
          const montoCell = row['Monto (ARS)'] ?? row['Monto'] ?? Object.values(row)[1];
          if (concepto !== undefined) eerrObj[String(concepto).trim()] = cleanNum(montoCell);
        });

        const eerrNorm = {};
        Object.keys(eerrObj).forEach(k => { eerrNorm[normalizeKey(k)] = eerrObj[k]; });

        const preciosProcesados = precios.map(p => ({
          categoria: p['Categoria'] ?? p['Categoría'] ?? Object.values(p)[0] ?? 'Otros',
          tipo: p['Tipo'] ?? Object.values(p)[1] ?? 'Default',
          valor: cleanNum(p['Valor (ARS)'] ?? p['Valor'] ?? Object.values(p)[2]),
          sueldoSugerido: cleanNum(p['Sueldo Sugerido (ARS)'] ?? p['Sueldo Sugerido'] ?? Object.values(p)[3]),
          costoFijo: cleanNum(p['Costo Fijo (ARS)'] ?? p['Costo Fijo'] ?? Object.values(p)[4])
        }));

        const clientesProcesados = clientes.map(c =>
          c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0] ?? ''
        ).filter(Boolean);

        const usuariosProcesados = usuarios.map(u => ({
          nombre: u['Nombre'] ?? u['nombre'] ?? Object.values(u)[0] ?? '',
          password: u['Password'] ?? u['password'] ?? Object.values(u)[1] ?? '',
          modulos: u['Modulos'] ?? u['modulos'] ?? u['Módulos'] ?? Object.values(u)[2] ?? 'todos'
        })).filter(u => u.nombre);

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: clientesProcesados,
          config: configObj,
          eerrBase: eerrObj,
          eerrBaseNorm: eerrNorm,
          usuarios: usuariosProcesados,
          valoresServicios: valoresServ,
          loading: false,
          error: null
        });

        setPctIndirectos(configObj['% Indirectos'] ?? configObj['Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? configObj['Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        try {
          const resNube = await fetch(`${SCRIPT_URL}?sheet=HistorialCompartido`);
          const dataNube = await resNube.json();
          if (dataNube && Array.isArray(dataNube)) {
            const findKey = (obj, k) => Object.keys(obj).find(key => key.toLowerCase() === k.toLowerCase());
            const historialSincronizado = dataNube.map(item => {
              const dEsc = item[findKey(item, 'DatosEscenario')];
              const conf = item[findKey(item, 'Configuracion')];
              const eerrData = item[findKey(item, 'EERR')];
              let escenariosParseados = [];
              if (Array.isArray(dEsc)) { escenariosParseados = dEsc; }
              else if (typeof dEsc === 'string' && dEsc.trim() !== '') {
                try { escenariosParseados = JSON.parse(dEsc); } catch(e) { escenariosParseados = []; }
              }
              let configParseada = {};
              if (typeof conf === 'object' && conf !== null && !Array.isArray(conf)) { configParseada = conf; }
              else if (typeof conf === 'string' && conf.trim() !== '') {
                try { configParseada = JSON.parse(conf); } catch(e) { configParseada = {}; }
              }
              let eerrParseada = {};
              if (typeof eerrData === 'object' && eerrData !== null && !Array.isArray(eerrData)) { eerrParseada = eerrData; }
              else if (typeof eerrData === 'string' && eerrData.trim() !== '') {
                try { eerrParseada = JSON.parse(eerrData); } catch(e) { eerrParseada = {}; }
              }
              return {
                id: item[findKey(item, 'ID')] ? String(item[findKey(item, 'ID')]).replace(/'/g, "") : Date.now(),
                nombre: item[findKey(item, 'Nombre')] || "Sin nombre",
                fecha: item[findKey(item, 'Fecha')] || "",
                escenarios: escenariosParseados,
                config: configParseada,
                eerr: eerrParseada
              };
            });
            setHistorial(historialSincronizado);
            const ultimo = historialSincronizado[historialSincronizado.length - 1];
            if (ultimo && Array.isArray(ultimo.escenarios) && ultimo.escenarios.length > 0) {
              setEscenarios(ultimo.escenarios);
              if (ultimo.config && typeof ultimo.config === 'object') {
                setPctIndirectos(ultimo.config.pctIndirectos ?? 37);
                setPctCostoLaboral(ultimo.config.pctCostoLaboral ?? 45);
                setGastosOperativos(ultimo.config.gastosOperativos ?? 46539684.59);
                setMargenObjetivo(ultimo.config.margenObjetivo ?? 25);
                if(ultimo.config.lineasVentaTotal) setLineasVentaTotal(ultimo.config.lineasVentaTotal);
                if(ultimo.config.lineasRenovacion) setLineasRenovacion(ultimo.config.lineasRenovacion);
                if(ultimo.config.lineasIncremental) setLineasIncremental(ultimo.config.lineasIncremental);
              }
            }
          }
        } catch(e) { console.error("Error cargando historial:", e); }

        if (preciosProcesados.length > 0 && escenarios.length === 0) {
          setEscenarios([{
            id: Date.now(),
            cliente: clientesProcesados[0] || 'Nuevo Cliente',
            tipoIdx: 0, cantidad: 1,
            sueldoBruto: preciosProcesados[0].sueldoSugerido || 0,
            ventaUnit: preciosProcesados[0].valor || 0,
            costoDirecto: preciosProcesados[0].costoFijo || 0
          }]);
        }
        setIsReady(true);
      } catch (error) {
        console.error('Error cargando sheets', error);
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos desde Google Sheets.' }));
        setIsReady(true);
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!isReady || isLoadingFromCloud) return;
    if (!Array.isArray(escenarios)) return;
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental, isReady, isLoadingFromCloud]);

  // ─── ACCIONES ───────────────────────────────────────────────────────────────
  const agregarFila = () => {
    if (dataSheets.loading) { alert('Aún cargando datos. Intentá de nuevo en un momento.'); return; }
    const precioDefault = (dataSheets.preciosNuevos && dataSheets.preciosNuevos.length > 0)
      ? dataSheets.preciosNuevos[0]
      : { sueldoSugerido: 0, valor: 0, costoFijo: 0 };
    setEscenarios(prev => ([...prev, {
      id: Date.now(),
      cliente: (dataSheets.clientes && dataSheets.clientes[0]) || 'Nuevo Cliente',
      tipoIdx: 0, cantidad: 1,
      sueldoBruto: precioDefault.sueldoSugerido || 0,
      ventaUnit: precioDefault.valor || 0,
      costoDirecto: precioDefault.costoFijo || 0
    }]));
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e };
      if (campo === 'ventaUnit' || campo === 'sueldoBruto' || campo === 'costoDirecto') {
        const num = typeof valor === 'string' ? parseInt(valor.replace(/\D/g, '')) || 0 : Number(valor || 0);
        updated[campo] = num;
      } else if (campo === 'tipoIdx') {
        updated.tipoIdx = Number(valor) || 0;
        const p = dataSheets.preciosNuevos[Number(valor)];
        if (p) {
          updated.sueldoBruto = p.sueldoSugerido ?? 0;
          updated.ventaUnit = p.valor ?? 0;
          updated.costoDirecto = p.costoFijo ?? 0;
        }
      } else if (campo === 'cantidad') {
        updated.cantidad = Number(valor) || 0;
      } else if (campo === 'cliente') {
        updated.cliente = valor;
      }
      return updated;
    }));
  };

  const agregarLineaVenta = (tipo) => {
    const nuevaLinea = { id: Date.now(), cliente: '', monto: '' };
    if (tipo === 'total') setLineasVentaTotal(prev => [...prev, nuevaLinea]);
    if (tipo === 'renovacion') setLineasRenovacion(prev => [...prev, nuevaLinea]);
    if (tipo === 'incremental') setLineasIncremental(prev => [...prev, nuevaLinea]);
  };

  const actualizarLineaVenta = (tipo, id, campo, valor) => {
    const actualizar = (lineas) => lineas.map(l => l.id === id ? { ...l, [campo]: valor } : l);
    if (tipo === 'total') setLineasVentaTotal(prev => actualizar(prev));
    if (tipo === 'renovacion') setLineasRenovacion(prev => actualizar(prev));
    if (tipo === 'incremental') setLineasIncremental(prev => actualizar(prev));
  };

  const eliminarLineaVenta = (tipo, id) => {
    if (tipo === 'total') setLineasVentaTotal(prev => prev.filter(l => l.id !== id));
    if (tipo === 'renovacion') setLineasRenovacion(prev => prev.filter(l => l.id !== id));
    if (tipo === 'incremental') setLineasIncremental(prev => prev.filter(l => l.id !== id));
  };

  const calcularTotalLineas = (lineas) => lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);

  // ─── CÁLCULOS ───────────────────────────────────────────────────────────────
  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    const porCliente = {};
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const ventaFila = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
      let costoTotalFila = 0;
      const isStaff = (p.categoria || '').toLowerCase().includes('staff');
      const isWorkshop = (p.categoria || '').toLowerCase().includes('workshop') ||
                         (p.tipo || '').toLowerCase().includes('workshop') ||
                         (p.tipo || '').toLowerCase().includes('worshop');
      if (isStaff) {
        const sueldoTotal = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
        costoTotalFila = sueldoTotal + (sueldoTotal * pctCostoLaboral / 100) + (sueldoTotal * pctIndirectos / 100);
      } else if (isWorkshop) {
        costoTotalFila = (Number(e.cantidad) || 0) * (Number(e.costoDirecto) || 0);
      } else {
        const base = (Number(e.cantidad) || 0) * (Number(p.costoFijo) || 0);
        costoTotalFila = base + (base * pctIndirectos / 100);
      }
      ventasTotales += ventaFila;
      costosTotales += costoTotalFila;
      if (!porCliente[e.cliente]) porCliente[e.cliente] = { ventas: 0, costos: 0 };
      porCliente[e.cliente].ventas += ventaFila;
      porCliente[e.cliente].costos += costoTotalFila;
    });
    const margenBruto = ventasTotales - costosTotales;
    const margenBrutoPct = ventasTotales > 0 ? (margenBruto / ventasTotales) * 100 : 0;
    return { ventasTotales, costosTotales, margenBruto, margenBrutoPct, porCliente };
  };

  const calcularEERRTotal = () => {
    const propuesta = calcularPropuesta();
    const eerr = dataSheets.eerrBase ?? {};
    const ingresoBase = tolerantGet(eerr, 'Ingreso') || 0;
    const costoIngresoBase = tolerantGet(eerr, 'Costo de ingresos') || 0;
    const gananciaBrutaBase = tolerantGet(eerr, 'Ganancia bruta') || 0;
    const gastoOperacionBase = tolerantGet(eerr, 'Menos gasto de operación') || 0;
    const otrosIngresosBase = tolerantGet(eerr, 'Más otros ingresos') || 0;
    const otrosGastosBase = tolerantGet(eerr, 'Menos gastos de otro tipo') || 0;
    const gananciaNetaBase = tolerantGet(eerr, 'Ganancia neta') || 0;
    const ingresoTotal = ingresoBase + propuesta.ventasTotales;
    const costoIngresosTotal = costoIngresoBase + propuesta.costosTotales;
    const gananciaBrutaTotal = ingresoTotal - costoIngresosTotal;
    const gastoOperacionTotal = gastosOperativos || gastoOperacionBase;
    const ingresoOperacionTotal = gananciaBrutaTotal - gastoOperacionTotal;
    const otrosIngresosTotal = otrosIngresosBase;
    const otrosGastosTotal = otrosGastosBase;
    const gananciaNetaTotal = ingresoOperacionTotal + otrosIngresosTotal - otrosGastosTotal;
    return {
      ingresoBase, costoIngresoBase, gananciaBrutaBase, gastoOperacionBase,
      otrosIngresosBase, otrosGastosBase, gananciaNetaBase,
      ingresoTotal, costoIngresosTotal, gananciaBrutaTotal, gastoOperacionTotal,
      ingresoOperacionTotal, otrosIngresosTotal, otrosGastosTotal, gananciaNetaTotal,
      margenBrutoPct: ingresoTotal > 0 ? (gananciaBrutaTotal / ingresoTotal) * 100 : 0,
      margenOperacionPct: ingresoTotal > 0 ? (ingresoOperacionTotal / ingresoTotal) * 100 : 0,
      margenNetoPct: ingresoTotal > 0 ? (gananciaNetaTotal / ingresoTotal) * 100 : 0,
      desvioIngreso: propuesta.ventasTotales,
      desvioCosto: propuesta.costosTotales,
      desvioGananciaNeta: gananciaNetaTotal - gananciaNetaBase,
      propuesta
    };
  };

  const desvioVsBase = useMemo(() => {
    const propuesta = calcularPropuesta();
    const eerr = calcularEERRTotal();
    return { ingreso: propuesta.ventasTotales, costo: propuesta.costosTotales, gananciaNeta: eerr.gananciaNetaTotal - (eerr.gananciaNetaBase || 0) };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, dataSheets.eerrBase]);

  const guardarEscenario = async () => {
    const nombre = window.prompt("Ingrese un nombre para este escenario:", `Escenario ${historial.length + 1}`);
    if (!nombre) return;
    const eerrActual = calcularEERRTotal();
    const timestamp = new Date().toLocaleString('es-AR');
    const nuevoRegistro = {
      id: Date.now(), nombre, fecha: timestamp, escenarios,
      config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental },
      eerr: eerrActual
    };
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify(nuevoRegistro));
      params.append('sheet', 'HistorialCompartido');
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      setHistorial(prev => [nuevoRegistro, ...prev]);
      alert(`✅ Sincronizado en la base de datos "OK"`);
    } catch(e) { alert("Error al sincronizar."); }
  };

  const cargarEscenarioDesdeHistorial = (item) => {
    if(!window.confirm(`¿Cargar el escenario "${item.nombre}"? Se perderán los cambios actuales.`)) return;
    setIsLoadingFromCloud(true);
    const escenariosValidos = Array.isArray(item.escenarios) ? item.escenarios : [];
    const configValida = (typeof item.config === 'object' && item.config !== null) ? item.config : {};
    setEscenarios(escenariosValidos);
    setPctIndirectos(configValida.pctIndirectos ?? 37);
    setPctCostoLaboral(configValida.pctCostoLaboral ?? 45);
    setGastosOperativos(configValida.gastosOperativos ?? 46539684.59);
    setMargenObjetivo(configValida.margenObjetivo ?? 25);
    if(configValida.lineasVentaTotal) setLineasVentaTotal(configValida.lineasVentaTotal);
    if(configValida.lineasRenovacion) setLineasRenovacion(configValida.lineasRenovacion);
    if(configValida.lineasIncremental) setLineasIncremental(configValida.lineasIncremental);
    setMostrarHistorial(false);
    setTimeout(() => setIsLoadingFromCloud(false), 200);
  };

  const descargarPDF = () => {
    const eerr = calcularEERRTotal();
    const propuesta = eerr.propuesta;
    const timestamp = new Date().toLocaleString('es-AR');
    let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Horizon - Proyección ${timestamp}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:auto}h1{color:#7c3aed;border-bottom:3px solid #a78bfa;padding-bottom:10px}.section{background:#f5f3ff;padding:20px;border-radius:8px;margin:20px 0}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#e9d5ff;padding:10px;text-align:left;border:1px solid #cbd5e1;font-size:12px}td{padding:10px;border:1px solid #e2e8f0;font-size:12px}.right{text-align:right}.bold{font-weight:bold}.green{color:#16a34a}.red{color:#dc2626}.footer{margin-top:30px;padding:20px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:white;border-radius:8px;text-align:center}</style>
    </head><body><h1>HORIZON - Estado de Resultados Proyectado 2026</h1><p>Generado: ${timestamp}</p>
    <div class="section"><h3>Resumen Financiero</h3><table>
    <tr><td class="bold">Ingreso Base (Dic-25):</td><td class="right">${format(dataSheets.eerrBase['Ingreso']||0)}</td></tr>
    <tr><td class="bold">Ingreso Propuesta:</td><td class="right green">${format(propuesta.ventasTotales)}</td></tr>
    <tr><td class="bold">Ingreso Total:</td><td class="right bold">${format(eerr.ingresoTotal)}</td></tr>
    <tr><td class="bold">Costo Total:</td><td class="right red">-${format(eerr.costoIngresosTotal)}</td></tr>
    <tr><td class="bold">Ganancia Bruta:</td><td class="right green bold">${format(eerr.gananciaBrutaTotal)} (${eerr.margenBrutoPct.toFixed(1)}%)</td></tr>
    <tr><td class="bold">Gastos Operativos:</td><td class="right red">-${format(gastosOperativos)}</td></tr>
    <tr><td class="bold">Ganancia Neta:</td><td class="right bold ${eerr.gananciaNetaTotal>=0?'green':'red'}">${format(eerr.gananciaNetaTotal)} (${eerr.margenNetoPct.toFixed(1)}%)</td></tr>
    </table></div>
    <h3>Detalle de Servicios Propuestos</h3><table><thead><tr><th>Cliente</th><th>Servicio</th><th>Cant</th><th>Venta Unit</th><th>Sueldo Bruto</th><th>Costo Total</th><th>Resultado</th><th>Margen %</th></tr></thead><tbody>
    ${escenarios.map(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return '';
      const isStaff = (p.categoria||'').toLowerCase().includes('staff');
      const isWorkshop = (p.categoria||'').toLowerCase().includes('workshop')||(p.tipo||'').toLowerCase().includes('workshop');
      let costoTotal = 0;
      if (isStaff) { const s = e.cantidad*e.sueldoBruto; costoTotal = s+(s*pctCostoLaboral/100)+(s*pctIndirectos/100); }
      else if (isWorkshop) { costoTotal = e.cantidad*(e.costoDirecto||0); }
      else { const b = e.cantidad*p.costoFijo; costoTotal = b+(b*pctIndirectos/100); }
      const venta = e.cantidad*e.ventaUnit;
      const res = venta-costoTotal;
      const mgn = venta>0?(res/venta)*100:0;
      return `<tr><td>${e.cliente}</td><td>${p.categoria} - ${p.tipo}</td><td class="right">${e.cantidad}</td><td class="right">${format(e.ventaUnit)}</td><td class="right">${isStaff?format(e.sueldoBruto):isWorkshop?format(e.costoDirecto||0):'-'}</td><td class="right red">-${format(costoTotal)}</td><td class="right green bold">${format(res)}</td><td class="right bold">${mgn.toFixed(1)}%</td></tr>`;
    }).join('')}
    </tbody></table>
    <div class="section"><h3>Configuración Utilizada</h3><p><strong>Indirectos:</strong> ${pctIndirectos}% | <strong>Costo Laboral:</strong> ${pctCostoLaboral}% | <strong>Margen Objetivo:</strong> ${margenObjetivo}%</p></div>
    <div class="footer"><h2>Ganancia Neta Proyectada: ${format(eerr.gananciaNetaTotal)}</h2><p>Margen Neto: ${eerr.margenNetoPct.toFixed(1)}% | Desvío vs Dic-25: ${eerr.desvioGananciaNeta>=0?'+':''}${format(eerr.desvioGananciaNeta)}</p></div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Horizon_Proyeccion_${Date.now()}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  const formatPct = (n) => `${n.toFixed(0)}%`;

  // ─── VELOCÍMETRO (diseño original) ──────────────────────────────────────────
  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = calcularTotalLineas(lineas);
    const pctCumplimiento = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const angle = -90 + (pctCumplimiento * 1.8);
    const totalArcLength = 251.2;
    const filledLength = (pctCumplimiento / 100) * totalArcLength;
    const gapLength = totalArcLength - filledLength;
    const getColor = () => {
      if (pctCumplimiento >= 100) return '#16a34a';
      if (pctCumplimiento >= 75) return '#eab308';
      if (pctCumplimiento >= 50) return '#f97316';
      return '#dc2626';
    };
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color }}>{titulo}</h3>
        <div className="relative w-full flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
            {pctCumplimiento < 100 && (<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#fee2e2" strokeWidth="20" strokeLinecap="round" />)}
            {pctCumplimiento < 100 && (
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#6b6a6a" strokeWidth="20" strokeLinecap="round"
                strokeDasharray={`${gapLength} ${totalArcLength}`} strokeDashoffset={`-${filledLength}`}
                style={{ transition: 'all 0.8s ease-out' }} />
            )}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={getColor()} strokeWidth="20" strokeLinecap="round"
              strokeDasharray={`${filledLength} ${totalArcLength}`} style={{ transition: 'all 0.8s ease-out' }} />
            <line x1="100" y1="100" x2="100" y2="30" stroke={getColor()} strokeWidth="3" strokeLinecap="round"
              transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 0.8s ease-out' }} />
            <circle cx="100" cy="100" r="8" fill={getColor()} />
          </svg>
        </div>
        <div className="text-center mb-4">
          <p className="text-4xl font-black" style={{ color: getColor() }}>{pctCumplimiento.toFixed(1)}%</p>
          {pctCumplimiento < 100 && <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Cumplimiento</p>}
        </div>
        <div className="space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg">
          <div>
            <label className="text-[10px] font-bold text-purple-600 uppercase block mb-1">Objetivo 2026</label>
            <div className="w-full bg-white border border-purple-200 rounded px-3 py-2 text-sm font-bold text-purple-700">{formatNum(objetivo)}</div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-blue-600 uppercase">Ventas por Cliente</label>
              <button onClick={() => agregarLineaVenta(tipo)} className="text-blue-600 hover:text-blue-800 font-black text-lg leading-none">+</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lineas.map((linea) => (
                <div key={linea.id} className="flex gap-2 items-center">
                  <select value={linea.cliente} onChange={(e) => actualizarLineaVenta(tipo, linea.id, 'cliente', e.target.value)}
                    className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none">
                    {dataSheets.clientes && dataSheets.clientes.length > 0
                      ? dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)
                      : <option value="">Cargando...</option>}
                  </select>
                  <input type="text" value={linea.monto === '' ? '' : formatNum(linea.monto)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\s/g, '');
                      actualizarLineaVenta(tipo, linea.id, 'monto', raw === '' ? '' : parseFloat(raw) || 0);
                    }}
                    className="w-32 bg-white border-2 border-blue-400 rounded px-2 py-1 text-xs font-bold text-blue-700 focus:outline-none" placeholder="0" />
                  {lineas.length > 1 && <button onClick={() => eliminarLineaVenta(tipo, linea.id)} className="text-slate-400 hover:text-red-500 text-sm font-bold">✕</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-bold uppercase">Total Real:</span>
              <span className="font-black text-blue-700">{format(calcularTotalLineas(lineas))}</span>
            </div>
            <p className="text-[10px] font-bold text-red-500 uppercase mt-1">Restan: {format(objetivo - totalReal)}</p>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">SINCRONIZANDO CON HORIZON CLOUD...</div>;
  if (dataSheets.error) return <div className="p-20 text-center font-black text-red-600">{dataSheets.error}</div>;
  if (!usuarioActual) return <LoginScreen usuarios={dataSheets.usuarios} onLogin={setUsuarioActual} />;

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans text-slate-900">
      {mostrarModalValores && (
        <ModalValoresServicios datos={dataSheets.valoresServicios} onClose={() => setMostrarModalValores(false)} />
      )}
      <div className="max-w-7xl mx-auto">

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2026</h1>
            <p className="text-slate-500 text-sm mt-1">Estado de Resultados Proyectado (Base Dic-25 + Propuesta)</p>
          </div>
          <div className="flex gap-3 items-center">
            {tienePermiso('busqueda') && (
              <button onClick={() => setMostrarModalValores(true)} title="Ver Valores de Servicios"
                className="bg-white border border-purple-200 rounded-lg px-3 py-2 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition shadow-sm text-lg">🔍</button>
            )}
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
              <span className="text-[10px] font-bold text-purple-400 block uppercase">Gastos Op.</span>
              <input type="text" value={gastosOperativos === 0 ? '' : formatNum(gastosOperativos)}
                onChange={e => { const r = e.target.value.replace(/\./g, '').replace(/\s/g, ''); setGastosOperativos(r === '' ? 0 : parseFloat(r) || 0); }}
                className="w-32 font-bold text-red-600 focus:outline-none text-xs bg-transparent" />
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-100">
              <span className="text-[10px] font-bold text-blue-400 block uppercase">Indirectos</span>
              <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(cleanNum(e.target.value))} className="w-16 font-bold text-blue-600 focus:outline-none" />%
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-pink-100">
              <span className="text-[10px] font-bold text-pink-400 block uppercase">Costo Lab.</span>
              <input type="number" value={pctCostoLaboral} onChange={e => setPctCostoLaboral(cleanNum(e.target.value))} className="w-16 font-bold text-pink-600 focus:outline-none" />%
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
              <span className="text-[10px] font-bold text-purple-400 block uppercase">Margen Obj.</span>
              <input type="number" value={margenObjetivo} onChange={e => setMargenObjetivo(cleanNum(e.target.value))} className="w-16 font-bold text-purple-600 focus:outline-none" />%
            </div>
            <div className="bg-purple-100 px-3 py-2 rounded-lg text-xs font-bold text-purple-700 flex items-center gap-2">
              👤 {usuarioActual.nombre}
              <button onClick={() => setUsuarioActual(null)} className="text-purple-400 hover:text-red-500 ml-1" title="Cerrar sesión">✕</button>
            </div>
          </div>
        </div>

        {/* ── SIMULACIÓN DE SERVICIOS ── */}
        {tienePermiso('simulacion') && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
              <h2 className="font-bold text-slate-700 text-sm">💼 Simulación de Servicios (Propuesta)</h2>
              <div className="flex gap-2">
                <button onClick={() => setMostrarHistorial(!mostrarHistorial)}
                  className={`text-xs font-bold px-3 py-1 border rounded-lg transition ${mostrarHistorial ? 'bg-purple-600 text-white border-purple-600' : 'text-slate-600 border-purple-200 hover:text-purple-600'}`}>
                  📋 Historial ({historial.length})
                </button>
                <button onClick={guardarEscenario} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition">💾 Guardar Escenario</button>
                <button onClick={descargarPDF} className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition">📄 Descargar PDF</button>
                <button onClick={() => { if(window.confirm('¿Limpiar todos los campos?')) setEscenarios([]); }} className="text-slate-400 hover:text-slate-600 text-xs font-bold px-3 py-1">Limpiar</button>
                <button onClick={agregarFila} disabled={dataSheets.loading} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition disabled:opacity-60">+ Agregar</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Servicio</th>
                    <th className="p-4 text-center">Cant</th>
                    <th className="p-4 text-right">Venta Unit</th>
                    <th className="p-4 text-right">Sueldo Bruto</th>
                    <th className="p-4 text-right">Costo Directo</th>
                    <th className="p-4 text-right">Costo Total</th>
                    <th className="p-4 text-right">Resultado</th>
                    <th className="p-4 text-center">Margen</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {escenarios.map(e => {
                    const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
                    const isStaff = p && (p.categoria || '').toLowerCase().includes('staff');
                    const isWorkshop = p && (
                      (p.categoria || '').toLowerCase().includes('workshop') ||
                      (p.tipo || '').toLowerCase().includes('workshop') ||
                      (p.tipo || '').toLowerCase().includes('worshop')
                    );
                    let costoTotal = 0;
                    if (p) {
                      if (isStaff) {
                        const sueldo = (Number(e.cantidad)||0) * (Number(e.sueldoBruto)||0);
                        costoTotal = sueldo + (sueldo * pctCostoLaboral/100) + (sueldo * pctIndirectos/100);
                      } else if (isWorkshop) {
                        costoTotal = (Number(e.cantidad)||0) * (Number(e.costoDirecto)||0);
                      } else {
                        const base = (Number(e.cantidad)||0) * (Number(p.costoFijo)||0);
                        costoTotal = base + (base * pctIndirectos/100);
                      }
                    }
                    const venta = (Number(e.cantidad)||0) * (Number(e.ventaUnit)||0);
                    const res = venta - costoTotal;
                    const mgn = venta > 0 ? (res / venta) * 100 : 0;
                    return (
                      <tr key={e.id} className="border-t border-purple-50 hover:bg-purple-50/30 transition">
                        <td className="p-4">
                          <select value={e.cliente} onChange={(ev) => actualizarFila(e.id, 'cliente', ev.target.value)} className="bg-transparent focus:outline-none font-medium">
                            {dataSheets.clientes && dataSheets.clientes.length > 0 ? dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>) : <option value="">Sin clientes</option>}
                          </select>
                        </td>
                        <td className="p-4">
                          <select value={e.tipoIdx} onChange={(ev) => actualizarFila(e.id, 'tipoIdx', ev.target.value)} className="bg-transparent focus:outline-none text-purple-600 font-bold text-xs">
                            {dataSheets.preciosNuevos && dataSheets.preciosNuevos.length > 0 ? dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>) : <option value={0}>Sin servicios</option>}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <input type="number" value={e.cantidad} onChange={(ev) => actualizarFila(e.id, 'cantidad', ev.target.value)} className="w-10 text-center bg-purple-50 rounded font-bold" min="0" />
                        </td>
                        <td className="p-4 text-right">
                          <input type="text" value={(Number(e.ventaUnit)||0).toLocaleString('es-AR')}
                            onChange={(ev) => { const val = ev.target.value.replace(/\D/g, ''); actualizarFila(e.id, 'ventaUnit', val === '' ? 0 : Number(val)); }}
                            className="w-28 text-right bg-blue-50 text-blue-700 font-bold rounded px-2 border border-blue-200" />
                        </td>
                        <td className="p-4 text-right">
                          {isStaff ? (
                            <input type="text" value={(Number(e.sueldoBruto)||0).toLocaleString('es-AR')}
                              onChange={(ev) => { const val = ev.target.value.replace(/\D/g, ''); actualizarFila(e.id, 'sueldoBruto', val === '' ? 0 : Number(val)); }}
                              className="w-24 text-right bg-pink-50 text-pink-700 font-bold rounded px-2 border border-pink-200" />
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-4 text-right">
                          {isWorkshop ? (
                            <input type="text" value={(Number(e.costoDirecto)||0).toLocaleString('es-AR')}
                              onChange={(ev) => { const val = ev.target.value.replace(/\D/g, ''); actualizarFila(e.id, 'costoDirecto', val === '' ? 0 : Number(val)); }}
                              className="w-28 text-right bg-orange-50 text-orange-700 font-bold rounded px-2 border border-orange-300" title="Costo directo editable (sin indirectos)" />
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-4 text-right font-mono text-red-500 text-xs">-{format(costoTotal)}</td>
                        <td className="p-4 text-right font-bold text-green-600">{format(res)}</td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {mgn.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 text-sm">📋 Historial de Escenarios Guardados</h2>
              <button onClick={() => setMostrarHistorial(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cerrar</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historial.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-400 text-sm italic">No hay escenarios guardados.</div>
              ) : historial.map(item => (
                <div key={item.id} className="border border-purple-100 rounded-lg p-4 hover:border-purple-400 transition bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-purple-700 text-sm uppercase truncate pr-2">{item.nombre}</h3>
                    <button onClick={() => { if(window.confirm('¿Eliminar?')) setHistorial(prev => prev.filter(h => h.id !== item.id)); }} className="text-slate-300 hover:text-red-500">✕</button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mb-3">{item.fecha}</p>
                  <div className="space-y-1 mb-4">
                    {item.eerr && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Ingreso propuesta:</span>
                          <span className="font-bold text-green-600">{format(item.eerr.propuesta?.ventasTotales || 0)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Ganancia neta:</span>
                          <span className={`font-bold ${(item.eerr.gananciaNetaTotal||0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{format(item.eerr.gananciaNetaTotal || 0)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Margen neto:</span>
                          <span className="font-bold text-purple-600">{(item.eerr.margenNetoPct || 0).toFixed(1)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => cargarEscenarioDesdeHistorial(item)} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg text-xs font-black hover:shadow-lg transition uppercase">
                    Cargar Escenario
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── KPIs EERR ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Ingreso Total', value: format(eerr.ingresoTotal), sub: `Base: ${format(eerr.ingresoBase)}`, color: 'blue' },
            { label: 'Ganancia Bruta', value: format(eerr.gananciaBrutaTotal), sub: `${eerr.margenBrutoPct.toFixed(1)}% margen`, color: 'green' },
            { label: 'Ingreso Operación', value: format(eerr.ingresoOperacionTotal), sub: `${eerr.margenOperacionPct.toFixed(1)}% margen`, color: 'purple' },
            { label: 'Ganancia Neta', value: format(eerr.gananciaNetaTotal), sub: `${eerr.margenNetoPct.toFixed(1)}% margen`, color: eerr.gananciaNetaTotal >= 0 ? 'green' : 'red' }
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-purple-100 p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{kpi.label}</p>
              <p className={`text-xl font-black ${kpi.color === 'green' ? 'text-green-600' : kpi.color === 'red' ? 'text-red-600' : kpi.color === 'blue' ? 'text-blue-600' : 'text-purple-600'}`}>{kpi.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ── EERR DETALLE ── */}
        {tienePermiso('eerr') && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
              <h2 className="font-bold text-slate-700 text-sm">📊 Estado de Resultados Proyectado</h2>
              <button onClick={() => setMostrarEERR(!mostrarEERR)} className="text-xs text-purple-500 font-bold">{mostrarEERR ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            {mostrarEERR && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                    <th className="p-4 text-left">Concepto</th>
                    <th className="p-4 text-right">Base (Dic-25)</th>
                    <th className="p-4 text-right">Propuesta</th>
                    <th className="p-4 text-right">Total Proyectado</th>
                    <th className="p-4 text-right">% Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Ingreso', base: eerr.ingresoBase, prop: propuesta.ventasTotales, total: eerr.ingresoTotal, pct: 100 },
                    { label: 'Costo de ingresos', base: eerr.costoIngresoBase, prop: propuesta.costosTotales, total: eerr.costoIngresosTotal, pct: eerr.ingresoTotal > 0 ? (eerr.costoIngresosTotal/eerr.ingresoTotal)*100 : 0, neg: true },
                    { label: 'Ganancia bruta', base: eerr.gananciaBrutaBase, prop: propuesta.margenBruto, total: eerr.gananciaBrutaTotal, pct: eerr.margenBrutoPct, bold: true },
                    { label: 'Gastos operativos', base: eerr.gastoOperacionBase, prop: 0, total: eerr.gastoOperacionTotal, pct: eerr.ingresoTotal > 0 ? (eerr.gastoOperacionTotal/eerr.ingresoTotal)*100 : 0, neg: true },
                    { label: 'Ingreso operación', base: 0, prop: 0, total: eerr.ingresoOperacionTotal, pct: eerr.margenOperacionPct, bold: true },
                    { label: 'Otros ingresos', base: eerr.otrosIngresosBase, prop: 0, total: eerr.otrosIngresosTotal, pct: eerr.ingresoTotal > 0 ? (eerr.otrosIngresosTotal/eerr.ingresoTotal)*100 : 0 },
                    { label: 'Ganancia neta', base: eerr.gananciaNetaBase, prop: eerr.desvioGananciaNeta, total: eerr.gananciaNetaTotal, pct: eerr.margenNetoPct, bold: true, highlight: true }
                  ].map((row, i) => (
                    <tr key={i} className={`border-t border-purple-50 ${row.highlight ? 'bg-purple-50' : ''}`}>
                      <td className={`p-4 ${row.bold ? 'font-black text-slate-800' : 'text-slate-600'}`}>{row.label}</td>
                      <td className="p-4 text-right text-slate-400 font-mono text-xs">{format(row.base)}</td>
                      <td className={`p-4 text-right font-mono text-xs font-bold ${row.prop >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.prop !== 0 ? (row.prop >= 0 ? '+' : '') + format(row.prop) : '-'}</td>
                      <td className={`p-4 text-right font-mono text-xs font-bold ${row.neg ? 'text-red-600' : row.total >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{format(row.total)}</td>
                      <td className="p-4 text-right text-xs font-bold text-purple-500">{row.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── APORTE POR CLIENTE ── */}
        {tienePermiso('simulacion') && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
              <h2 className="font-bold text-slate-700 text-sm">🏢 Aporte por Cliente (Propuesta)</h2>
              <button onClick={() => setMostrarAporte(!mostrarAporte)} className="text-xs text-purple-500 font-bold">{mostrarAporte ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            {mostrarAporte && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                    <th className="p-4 text-left">Cliente</th>
                    <th className="p-4 text-right">Ventas</th>
                    <th className="p-4 text-right">Costos</th>
                    <th className="p-4 text-right">Resultado</th>
                    <th className="p-4 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(propuesta.porCliente).map(([cliente, data], i) => {
                    const res = data.ventas - data.costos;
                    const mgn = data.ventas > 0 ? (res / data.ventas) * 100 : 0;
                    return (
                      <tr key={i} className="border-t border-purple-50 hover:bg-purple-50/30">
                        <td className="p-4 font-bold text-slate-700">{cliente}</td>
                        <td className="p-4 text-right text-blue-600 font-bold">{format(data.ventas)}</td>
                        <td className="p-4 text-right text-red-500 font-mono text-xs">-{format(data.costos)}</td>
                        <td className="p-4 text-right font-bold text-green-600">{format(res)}</td>
                        <td className="p-4 text-right">
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {mgn.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── OBJETIVOS ── */}
        {tienePermiso('objetivos') && (
          <div className="mb-6">
            <h2 className="font-bold text-slate-700 text-sm mb-4">🎯 Objetivos de Ventas 2026</h2>
            <div className="flex gap-4">
              {renderVelocimetro('Ventas Totales', objVentasTotal, lineasVentaTotal, setLineasVentaTotal, 'total', '#7c3aed')}
              {renderVelocimetro('Renovación', objRenovacion, lineasRenovacion, setLineasRenovacion, 'renovacion', '#2563eb')}
              {renderVelocimetro('Incremental', objIncremental, lineasIncremental, setLineasIncremental, 'incremental', '#db2777')}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;

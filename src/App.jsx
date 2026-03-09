import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

// ─── UTILS GLOBALES ─────────────────────────────────────────────────────────
const cleanNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  let s = String(val).replace(/[$€£\s]/g, '').replace(/[^\d,.\-]/g, '');
  s = (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const normalizeKey = (k) => {
  if (!k && k !== 0) return '';
  const accentMap = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
  return String(k).toLowerCase().trim().replace(/[áéíóúñ]/g, m => accentMap[m]).replace(/[^a-z0-9]/g, '');
};

const tolerantGet = (mapObj, key) => {
  if (!mapObj) return 0;
  const nk = normalizeKey(key);
  const found = Object.keys(mapObj).find(k => normalizeKey(k) === nk);
  return found ? mapObj[found] : (mapObj[key] || 0);
};

const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
const formatPct = (n) => `${Number(n).toFixed(0)}%`;

const fetchSheet = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const text = await (await fetch(url)).text();
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const parseCSVLine = (line) => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)|;(?=(?:(?:[^"]*"){2})*[^"]*$)/g).map(c => c.replace(/^"|"$/g, '').trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: cells[i] !== undefined ? cells[i] : '' }), {});
  });
};

// ─── SUBCOMPONENTES UI ──────────────────────────────────────────────────────
const HeaderMetric = ({ label, value, onChange, isCurrency, borderClass, labelClass, inputClass }) => (
  <div className={`bg-white px-3 sm:px-4 py-2 rounded-lg shadow-sm border ${borderClass} flex-1 min-w-[80px]`}>
    <span className={`text-[10px] font-bold ${labelClass} block uppercase`}>{label}</span>
    <div className="flex items-center">
      {isCurrency ? (
        <input type="text" value={value === 0 ? '' : formatNum(value)} onChange={e => {
          const raw = e.target.value.replace(/\./g, '').replace(/\s/g, '');
          onChange(raw === '' ? 0 : parseFloat(raw) || 0);
        }} className={`w-full font-bold ${inputClass} focus:outline-none text-xs sm:text-sm bg-transparent`} />
      ) : (
        <><input type="number" value={value} onChange={e => onChange(cleanNum(e.target.value))} className={`w-full font-bold ${inputClass} focus:outline-none text-xs sm:text-sm`} />%</>
      )}
    </div>
  </div>
);

const EERRRow = ({ label, base, prop, tot, refBase, refProp, refTot, isNegProp, isNegTot, cProp="", cTot="", indent, isTotalRow }) => {
  const pBase = refBase ? (base / refBase) * 100 : 0;
  const pProp = refProp ? (prop / refProp) * 100 : 0;
  const pTot = refTot ? (tot / refTot) * 100 : 0;
  
  if (isTotalRow) {
    return (
      <tr className="bg-gradient-to-r from-purple-100 to-pink-100 border-t-2 sm:border-t-4 border-purple-400">
        <td className="p-3 sm:p-4 font-black text-slate-900 text-xs sm:text-sm">{label}</td>
        <td className="p-3 sm:p-4 text-right font-mono font-black text-purple-700 border-r border-purple-200 text-[10px] sm:text-xs">{format(base)}</td>
        <td className="p-3 sm:p-4 text-right font-black border-r border-purple-200">{formatPct(pBase)}</td>
        <td className="p-3 sm:p-4 text-right font-mono font-black text-green-700 bg-green-100 border-r border-green-300 text-[10px] sm:text-xs">{format(prop)}</td>
        <td className="p-3 sm:p-4 text-right font-black bg-green-100 border-r border-green-300">{formatPct(pProp)}</td>
        <td className="p-3 sm:p-4 text-right font-mono font-black text-blue-700 bg-blue-100 border-r border-blue-300 text-[10px] sm:text-xs">{format(tot)}</td>
        <td className="p-3 sm:p-4 text-right font-black bg-blue-100">{formatPct(pTot)}</td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
      <td className={`p-2 sm:p-3 font-bold text-slate-700 ${indent ? 'pl-4 sm:pl-6' : ''}`}>{label}</td>
      <td className={`p-2 sm:p-3 text-right font-mono border-r border-purple-100 ${cProp.includes('red') && isNegTot ? 'text-red-600' : ''}`}>{format(base)}</td>
      <td className="p-2 sm:p-3 text-right font-bold border-r border-purple-100">{formatPct(pBase)}</td>
      <td className={`p-2 sm:p-3 text-right font-mono font-bold bg-green-50 border-r border-green-200 ${cProp}`}>
        {prop === 0 ? <span className="text-slate-400">0.00</span> : `${isNegProp ? '-' : ''}${format(prop)}`}
      </td>
      <td className="p-2 sm:p-3 text-right font-bold bg-green-50 border-r border-green-200">{formatPct(pProp)}</td>
      <td className={`p-2 sm:p-3 text-right font-mono font-bold bg-blue-50 border-r border-blue-200 ${cTot}`}>
        {`${isNegTot ? '-' : ''}${format(tot)}`}
      </td>
      <td className="p-2 sm:p-3 text-right font-bold bg-blue-50">{formatPct(pTot)}</td>
    </tr>
  );
};

// ─── LOGIN SCREEN ───────────────────────────────────────────────────────────
function LoginScreen({ usuarios, onLogin }) {
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const user = usuarios.find(u => u.nombre.toLowerCase().trim() === nombre.toLowerCase().trim() && u.password.trim() === password.trim());
    user ? onLogin(user) : setError('Usuario o contraseña incorrectos');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-sm">
        <h1 className="text-2xl font-black text-center bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent uppercase mb-1">Horizon Finance Engine</h1>
        <p className="text-center text-slate-400 text-xs mb-8">Ingresá tus credenciales para continuar</p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-purple-500 uppercase block mb-1">Usuario</label>
            <input type="text" value={nombre} onChange={e => { setNombre(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full border-2 border-purple-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500" placeholder="Usuario" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-purple-500 uppercase block mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full border-2 border-purple-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500" placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-lg font-black text-sm uppercase hover:shadow-lg transition">Ingresar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL VALORES SERVICIOS ─────────────────────────────────────────────────
function ModalValoresServicios({ datos, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white shrink-0">
          <h2 className="font-black text-sm uppercase">🔍 Valores de Servicios Actuales</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white font-black text-lg print:hidden">✕</button>
        </div>
        <div className="overflow-auto p-2">
          {datos.length === 0 ? <p className="text-center text-slate-400 py-10 text-sm italic">Sin datos disponibles</p> : (
            <table className="w-full text-xs border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-purple-50 shadow-sm">
                <tr>{Object.keys(datos[0]).map(h => <th key={h} className="p-3 text-left font-bold text-purple-600 uppercase border-b border-purple-100 whitespace-nowrap bg-purple-50">{h}</th>)}</tr>
              </thead>
              <tbody>
                {datos.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                    {Object.values(row).map((val, j) => <td key={j} className="p-3 border-b border-slate-100 text-slate-700">{val}</td>)}
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

// ─── APP PRINCIPAL ───────────────────────────────────────────────────────────
function App() {
  const [dataSheets, setDataSheets] = useState({ preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {}, usuarios: [], valoresServicios: [], loading: true, error: null });
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
  const [isRefreshing, setIsRefreshing] = useState(false); // Nuevo estado para el botón refrescar

  const [objVentasTotal] = useState(2195176117);
  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => { try { return JSON.parse(localStorage.getItem('hzn_lineasVenta')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }});
  const [objRenovacion] = useState(1225673502);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => { try { return JSON.parse(localStorage.getItem('hzn_lineasReno')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }});
  const [objIncremental] = useState(969002614);
  const [lineasIncremental, setLineasIncremental] = useState(() => { try { return JSON.parse(localStorage.getItem('hzn_lineasIncr')) || [{ id: 1, cliente: '', monto: '' }]; } catch(e){ return [{ id:1, cliente:'', monto:'' }]; }});

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);
  const [mostrarAporte, setMostrarAporte] = useState(true);

  const tienePermiso = (modulo) => usuarioActual && ((usuarioActual.modulos || '').toLowerCase().includes('todos') || (usuarioActual.modulos || '').toLowerCase().includes(modulo.toLowerCase()));

  // Extraemos la lógica de carga para poder llamarla desde el botón
  const recargarDatosDesdeNube = async () => {
    setIsRefreshing(true);
    try {
      const [precios, clientes, cfg, eerr, usuarios, valoresServ] = await Promise.all([
        fetchSheet('PreciosNuevos'), fetchSheet('Clientes'), fetchSheet('Configuracion'), fetchSheet('EERRBase'), fetchSheet('Usuarios'), fetchSheet('Valores_Servicios')
      ]);

      const configObj = {};
      cfg.forEach(row => { const k = row['Parámetro'] ?? row['Parametro'] ?? row['Key'] ?? Object.values(row)[0]; if (k) configObj[String(k).trim()] = cleanNum(row['Valor'] ?? row['Value'] ?? Object.values(row)[1]); });

      const eerrObj = {}, eerrNorm = {};
      eerr.forEach(row => { const c = row['Concepto'] ?? Object.values(row)[0]; if (c) eerrObj[String(c).trim()] = cleanNum(row['Monto (ARS)'] ?? row['Monto'] ?? Object.values(row)[1]); });
      Object.keys(eerrObj).forEach(k => eerrNorm[normalizeKey(k)] = eerrObj[k]);

      const preciosProcesados = precios.map(p => ({
        categoria: p['Categoria'] ?? p['Categoría'] ?? Object.values(p)[0] ?? 'Otros', tipo: p['Tipo'] ?? Object.values(p)[1] ?? 'Default',
        valor: cleanNum(p['Valor (ARS)'] ?? p['Valor'] ?? Object.values(p)[2]), sueldoSugerido: cleanNum(p['Sueldo Sugerido (ARS)'] ?? p['Sueldo Sugerido'] ?? Object.values(p)[3]), costoFijo: cleanNum(p['Costo Fijo (ARS)'] ?? p['Costo Fijo'] ?? Object.values(p)[4])
      }));

      const clientesProcesados = clientes.map(c => c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0] ?? '').filter(Boolean);
      const usuariosProcesados = usuarios.map(u => ({ nombre: u['Nombre'] ?? u['nombre'] ?? Object.values(u)[0] ?? '', password: u['Password'] ?? u['password'] ?? Object.values(u)[1] ?? '', modulos: u['Modulos'] ?? u['modulos'] ?? u['Módulos'] ?? Object.values(u)[2] ?? 'todos' })).filter(u => u.nombre);

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

      // Actualizamos solo si no había valores previos, o si forzamos refresco total
      setPctIndirectos(tolerantGet(configObj, 'Indirectos') || 37);
      setPctCostoLaboral(tolerantGet(configObj, 'Costo Laboral') || 45);
      setGastosOperativos(tolerantGet(configObj, 'Gastos Operativos') || 46539684.59);
      setMargenObjetivo(tolerantGet(configObj, 'Margen Objetivo') || tolerantGet(configObj, 'Margen Objetivo (%)') || 25);

      try {
        const dataNube = await (await fetch(`${SCRIPT_URL}?sheet=HistorialCompartido`)).json();
        if (dataNube && Array.isArray(dataNube)) {
          const findKey = (obj, k) => Object.keys(obj).find(key => key.toLowerCase() === k.toLowerCase());
          const hSync = dataNube.map(item => {
            const dEsc = item[findKey(item, 'DatosEscenario')], conf = item[findKey(item, 'Configuracion')], eerrD = item[findKey(item, 'EERR')];
            const parseJson = (val, def) => { try { return typeof val === 'string' && val.trim() ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : def); } catch { return def; } };
            return { id: item[findKey(item, 'ID')]?.toString().replace(/'/g, "") || Date.now(), nombre: item[findKey(item, 'Nombre')] || "Sin nombre", fecha: item[findKey(item, 'Fecha')] || "", escenarios: parseJson(dEsc, []), config: parseJson(conf, {}), eerr: parseJson(eerrD, {}) };
          });
          setHistorial(hSync);
          // Si es la carga inicial, cargamos el último escenario
          if (!isReady) {
            const ult = hSync[hSync.length - 1];
            if (ult && ult.escenarios.length > 0) {
              setEscenarios(ult.escenarios);
            }
          }
        }
      } catch(e) {}

      try {
        const dTrack = await (await fetch(`${SCRIPT_URL}?sheet=TrackingObjetivos`)).json();
        if (dTrack && Array.isArray(dTrack) && dTrack.length > 0) {
          const ult = dTrack[dTrack.length - 1], fk = (obj, k) => Object.keys(obj).find(key => key.toLowerCase() === k.toLowerCase());
          const parseL = (v) => { try { return typeof v === 'string' && v.trim() ? JSON.parse(v) : (Array.isArray(v) ? v : null); } catch { return null; } };
          const kT = fk(ult, 'lineastotal') || fk(ult, 'ventastotales'), kR = fk(ult, 'lineasreno') || fk(ult, 'renovacion'), kI = fk(ult, 'lineasincr') || fk(ult, 'incremental');
          if(kT) { const lt = parseL(ult[kT]); if(lt) setLineasVentaTotal(lt); }
          if(kR) { const lr = parseL(ult[kR]); if(lr) setLineasRenovacion(lr); }
          if(kI) { const li = parseL(ult[kI]); if(li) setLineasIncremental(li); }
        }
      } catch(e) {}

      if (!isReady && preciosProcesados.length > 0 && escenarios.length === 0) {
        setEscenarios([{ id: Date.now(), cliente: clientesProcesados[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: preciosProcesados[0].sueldoSugerido || 0, ventaUnit: preciosProcesados[0].valor || 0, costoDirecto: preciosProcesados[0].costoFijo || 0 }]);
      }
      setIsReady(true);
    } catch (err) {
      setDataSheets(p => ({ ...p, loading: false, error: 'Error cargando datos.' })); setIsReady(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    recargarDatosDesdeNube();
  }, []); // Carga inicial

  useEffect(() => {
    if (!isReady || isLoadingFromCloud || !Array.isArray(escenarios)) return;
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios)); localStorage.setItem('hzn_pctInd', pctIndirectos); localStorage.setItem('hzn_pctLab', pctCostoLaboral); localStorage.setItem('hzn_gastosOp', gastosOperativos); localStorage.setItem('hzn_margenObj', margenObjetivo); localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal)); localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion)); localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental, isReady, isLoadingFromCloud]);

  const agregarFila = () => {
    if (dataSheets.loading) return alert('Cargando...');
    const p = dataSheets.preciosNuevos[0] || { sueldoSugerido: 0, valor: 0, costoFijo: 0, categoria: 'Otros', tipo: 'Default' };
    setEscenarios(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: p.sueldoSugerido || 0, ventaUnit: p.valor || 0, costoDirecto: p.costoFijo || 0 }]);
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const upd = { ...e };
      if (['ventaUnit', 'sueldoBruto', 'costoDirecto'].includes(campo)) upd[campo] = typeof valor === 'string' ? parseInt(valor.replace(/\D/g, '')) || 0 : Number(valor || 0);
      else if (campo === 'tipoIdx') { upd.tipoIdx = Number(valor) || 0; const p = dataSheets.preciosNuevos[Number(valor)]; if (p) { upd.sueldoBruto = p.sueldoSugerido ?? 0; upd.ventaUnit = p.valor ?? 0; upd.costoDirecto = p.costoFijo ?? 0; } }
      else if (campo === 'cantidad') upd.cantidad = Number(valor) || 0;
      else if (campo === 'cliente') upd.cliente = valor;
      return upd;
    }));
  };

  const setLinea = (setter, action, payload) => setter(prev => action === 'add' ? [...prev, { id: Date.now(), cliente: '', monto: '' }] : action === 'upd' ? prev.map(l => l.id === payload.id ? { ...l, [payload.campo]: payload.valor } : l) : prev.filter(l => l.id !== payload));
  const agregarLineaVenta = (t) => { t === 'total' ? setLinea(setLineasVentaTotal, 'add') : t === 'renovacion' ? setLinea(setLineasRenovacion, 'add') : setLinea(setLineasIncremental, 'add'); };
  const actualizarLineaVenta = (t, id, c, v) => { const p = {id, campo:c, valor:v}; t === 'total' ? setLinea(setLineasVentaTotal, 'upd', p) : t === 'renovacion' ? setLinea(setLineasRenovacion, 'upd', p) : setLinea(setLineasIncremental, 'upd', p); };
  const eliminarLineaVenta = (t, id) => { t === 'total' ? setLinea(setLineasVentaTotal, 'del', id) : t === 'renovacion' ? setLinea(setLineasRenovacion, 'del', id) : setLinea(setLineasIncremental, 'del', id); };
  const calcularTotalLineas = (lineas) => lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);

  const calcularPropuesta = () => {
    let vTot = 0, cTot = 0, pCli = {};
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx]; if (!p) return;
      const isStaff = (p.categoria || '').toLowerCase().includes('staff'), isWks = (p.categoria + p.tipo).toLowerCase().includes('workshop');
      const vFila = (e.cantidad || 0) * (e.ventaUnit || 0);
      let cFila = 0;
      if (isStaff) { const s = e.cantidad * e.sueldoBruto; cFila = s + (s * pctCostoLaboral/100) + (s * pctIndirectos/100); }
      else if (isWks) { cFila = e.cantidad * e.costoDirecto; }
      else { const b = e.cantidad * p.costoFijo; cFila = b + (b * pctIndirectos/100); }
      vTot += vFila; cTot += cFila;
      if (!pCli[e.cliente]) pCli[e.cliente] = { ventas: 0, costos: 0 };
      pCli[e.cliente].ventas += vFila; pCli[e.cliente].costos += cFila;
    });
    return { ventasTotales: vTot, costosTotales: cTot, margenBruto: vTot - cTot, margenBrutoPct: vTot > 0 ? ((vTot - cTot) / vTot) * 100 : 0, porCliente: pCli };
  };

  const calcularEERRTotal = () => {
    const prop = calcularPropuesta(), e = dataSheets.eerrBase ?? {}, n = dataSheets.eerrBaseNorm ?? {};
    const tg = (k) => tolerantGet(e, k) || tolerantGet(n, normalizeKey(k)) || 0;
    const iB = tg('Ingreso'), ciB = tg('Costo de ingresos'), opB = tg('Menos gasto de operación'), oiB = tg('Más otros ingresos'), ogB = tg('Menos gastos de otro tipo'), gnB = tg('Ganancia neta');
    const iT = iB + prop.ventasTotales, ciT = ciB + prop.costosTotales, gbT = iT - ciT, opT = gastosOperativos || opB, ioT = gbT - opT, gnT = ioT + oiB - ogB;
    return { ingresoBase: iB, costoIngresoBase: ciB, gananciaBrutaBase: iB - ciB, gastoOperacionBase: opB, otrosIngresosBase: oiB, otrosGastosBase: ogB, gananciaNetaBase: gnB, ingresoTotal: iT, costoIngresosTotal: ciT, gananciaBrutaTotal: gbT, gastoOperacionTotal: opT, ingresoOperacionTotal: ioT, otrosIngresosTotal: oiB, otrosGastosTotal: ogB, gananciaNetaTotal: gnT, margenBrutoPct: iT > 0 ? (gbT / iT) * 100 : 0, margenOperacionPct: iT > 0 ? (ioT / iT) * 100 : 0, margenNetoPct: iT > 0 ? (gnT / iT) * 100 : 0, desvioGananciaNeta: gnT - gnB, propuesta: prop };
  };

  const syncNube = async (payload, sheet, successMsg) => {
    try {
      const p = new URLSearchParams(); p.append('payload', JSON.stringify(payload)); p.append('sheet', sheet);
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
      alert(successMsg);
    } catch { alert("Error al sincronizar."); }
  };

  const guardarEscenario = () => {
    const nom = window.prompt("Ingrese un nombre para este escenario:", `Escenario ${historial.length + 1}`);
    if (!nom) return;
    const nR = { id: Date.now(), nombre: nom, fecha: new Date().toLocaleString('es-AR'), escenarios, config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo }, eerr: calcularEERRTotal() };
    setHistorial(p => [nR, ...p]); syncNube(nR, 'HistorialCompartido', '✅ Sincronizado en la base de datos "OK"');
  };

  const cargarEscenarioDesdeHistorial = (item) => {
    if(!window.confirm(`¿Cargar el escenario "${item.nombre}"? Se perderán los cambios actuales.`)) return;
    setIsLoadingFromCloud(true);
    setEscenarios(Array.isArray(item.escenarios) ? item.escenarios : []);
    const c = item.config || {}; setPctIndirectos(c.pctIndirectos ?? 37); setPctCostoLaboral(c.pctCostoLaboral ?? 45); setGastosOperativos(c.gastosOperativos ?? 46539684.59); setMargenObjetivo(c.margenObjetivo ?? 25);
    setMostrarHistorial(false); setTimeout(() => setIsLoadingFromCloud(false), 200);
  };

  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const tReal = calcularTotalLineas(lineas), pct = objetivo > 0 ? Math.min((tReal / objetivo) * 100, 100) : 0, angle = -90 + (pct * 1.8), arc = 251.2, fill = (pct / 100) * arc, gap = arc - fill;
    const cStr = pct >= 100 ? '#16a34a' : pct >= 75 ? '#eab308' : pct >= 50 ? '#f97316' : '#dc2626';
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-4 sm:p-6 flex-1 w-full overflow-hidden">
        <h3 className="text-xs sm:text-sm font-black text-center mb-2 uppercase truncate" style={{ color }}>{titulo}</h3>
        <div className="relative w-full flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-[200px] sm:max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
            {pct < 100 && <><path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#fee2e2" strokeWidth="20" strokeLinecap="round" /><path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#6b6a6a" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${gap} ${arc}`} strokeDashoffset={`-${fill}`} style={{ transition: 'all 0.8s' }} /></>}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={cStr} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${fill} ${arc}`} style={{ transition: 'all 0.8s' }} />
            <line x1="100" y1="100" x2="100" y2="30" stroke={cStr} strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 0.8s' }} />
            <circle cx="100" cy="100" r="8" fill={cStr} />
          </svg>
        </div>
        <div className="text-center mb-4">
          <p className="text-3xl sm:text-4xl font-black" style={{ color: cStr }}>{pct.toFixed(1)}%</p>
          {pct < 100 && <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Cumplimiento</p>}
        </div>
        <div className="space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-4 rounded-lg">
          <div><label className="text-[10px] font-bold text-purple-600 uppercase block mb-1">Objetivo 2026</label><div className="w-full bg-white border border-purple-200 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold text-purple-700 truncate">{formatNum(objetivo)}</div></div>
          <div>
            <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold text-blue-600 uppercase">Ventas por Cliente</label><button onClick={() => agregarLineaVenta(tipo)} className="text-blue-600 hover:text-blue-800 font-black text-lg leading-none print:hidden">+</button></div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lineas.map(l => (
                <div key={l.id} className="flex gap-1 sm:gap-2 items-center">
                  <select value={l.cliente} onChange={e => actualizarLineaVenta(tipo, l.id, 'cliente', e.target.value)} className="flex-1 min-w-[80px] bg-white border border-blue-200 rounded px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-medium text-slate-700 focus:outline-none truncate">{dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  <input type="text" value={l.monto === '' ? '' : formatNum(l.monto)} onChange={e => { const v = e.target.value.replace(/\./g, '').replace(/\s/g, ''); actualizarLineaVenta(tipo, l.id, 'monto', v === '' ? '' : parseFloat(v) || 0); }} className="w-20 sm:w-28 bg-white border-2 border-blue-400 rounded px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-bold text-blue-700 focus:outline-none" placeholder="0" />
                  {lineas.length > 1 && <button onClick={() => eliminarLineaVenta(tipo, l.id)} className="text-slate-400 hover:text-red-500 text-sm font-bold print:hidden px-1">✕</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between text-[10px] sm:text-xs mb-1"><span className="text-slate-500 font-bold uppercase">Total Real:</span><span className="font-black text-blue-700 truncate">{format(tReal)}</span></div>
            <p className="text-[10px] font-bold text-red-500 uppercase mt-1 truncate">Restan: {format(objetivo - tReal)}</p>
          </div>
        </div>
      </div>
    );
  };

  if (dataSheets.loading && !isReady) return <div className="p-10 sm:p-20 text-center font-black text-purple-600 animate-pulse text-sm sm:text-base">SINCRONIZANDO CON HORIZON CLOUD...</div>;
  if (dataSheets.error) return <div className="p-10 sm:p-20 text-center font-black text-red-600 text-sm sm:text-base">{dataSheets.error}</div>;
  if (!usuarioActual) return <LoginScreen usuarios={dataSheets.usuarios} onLogin={setUsuarioActual} />;

  const eerr = calcularEERRTotal(), { propuesta } = eerr;

  return (
    <div className="p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans text-slate-900 overflow-x-hidden">
      <style>{`@media print { @page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #f8fafc !important; } .overflow-x-auto, .overflow-y-auto, .overflow-auto, .max-h-48, .max-h-[80vh], .max-h-[90vh] { overflow: visible !important; max-height: none !important; } .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; border: 1px solid #e2e8f0; } }`}</style>
      {mostrarModalValores && <ModalValoresServicios datos={dataSheets.valoresServicios} onClose={() => setMostrarModalValores(false)} />}
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="w-full lg:w-auto">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent uppercase break-words">Horizon Finance Engine 2026</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">Resultados Proyectado </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full lg:w-auto">
            {tienePermiso('busqueda') && <button onClick={() => setMostrarModalValores(true)} title="Ver Valores" className="bg-white border border-purple-200 rounded-lg px-3 py-2 text-purple-600 hover:bg-purple-50 transition shadow-sm text-lg print:hidden shrink-0">🔍</button>}
            
            {/* Botón Refrescar */}
            <button 
              onClick={recargarDatosDesdeNube} 
              disabled={isRefreshing}
              className={`bg-white border border-blue-200 rounded-lg px-3 py-2 text-blue-600 hover:bg-blue-50 transition shadow-sm text-sm font-bold uppercase flex items-center gap-1 print:hidden shrink-0 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRefreshing ? '⏳ Recargando...' : '🔄 Refrescar'}
            </button>

            <HeaderMetric label="Gastos Op." value={gastosOperativos} onChange={setGastosOperativos} isCurrency={true} borderClass="border-purple-100" labelClass="text-purple-400" inputClass="text-red-600" />
            <HeaderMetric label="Indirectos" value={pctIndirectos} onChange={setPctIndirectos} isCurrency={false} borderClass="border-blue-100" labelClass="text-blue-400" inputClass="text-blue-600" />
            <HeaderMetric label="Costo Lab." value={pctCostoLaboral} onChange={setPctCostoLaboral} isCurrency={false} borderClass="border-pink-100" labelClass="text-pink-400" inputClass="text-pink-600" />
            <HeaderMetric label="Margen Obj." value={margenObjetivo} onChange={setMargenObjetivo} isCurrency={false} borderClass="border-purple-100" labelClass="text-purple-400" inputClass="text-purple-600" />
            
            {/* Info Usuario con link para Cerrar Sesión */}
            <div className="bg-purple-100 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold text-purple-700 flex flex-col items-center shrink-0 min-w-[100px] border border-purple-200">
              <div className="flex items-center gap-1">
                👤 <span className="max-w-[80px] truncate">{usuarioActual.nombre}</span>
              </div>
              <button 
                onClick={() => setUsuarioActual(null)} 
                className="text-red-500 hover:text-red-700 text-[9px] mt-0.5 uppercase tracking-wider print:hidden font-black"
                title="Cerrar sesión"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {tienePermiso('simulacion') && (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-3 sm:p-4 border-b border-purple-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="font-bold text-slate-700 text-xs sm:text-sm">💼 Simulación de Servicios (Propuesta)</h2>
            <div className="flex flex-wrap gap-2 print:hidden w-full xl:w-auto">
               <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 border rounded-lg transition shrink-0 ${mostrarHistorial ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-purple-600'}`}>📋 Historial ({historial.length})</button>
               <button onClick={guardarEscenario} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:shadow-lg transition shrink-0">💾 Guardar Escenario</button>
               <button onClick={() => window.print()} className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:shadow-lg transition shrink-0">📄 Descargar PDF</button>
               <button onClick={() => window.confirm('¿Limpiar todos los campos?') && setEscenarios([])} className="text-slate-400 hover:text-slate-600 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 shrink-0">Limpiar</button>
               <button onClick={agregarFila} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:shadow-lg transition shrink-0">+ Agregar</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                  <th className="p-3 sm:p-4">Cliente</th><th className="p-3 sm:p-4">Servicio</th><th className="p-3 sm:p-4 text-center">Cant</th>
                  <th className="p-3 sm:p-4 text-right">Venta Unit</th><th className="p-3 sm:p-4 text-right">Sueldo Bruto</th>
                  <th className="p-3 sm:p-4 text-right">Costo Directo</th><th className="p-3 sm:p-4 text-right">Costo Total</th>
                  <th className="p-3 sm:p-4 text-right">Resultado</th><th className="p-3 sm:p-4 text-center">Margen</th><th className="p-3 sm:p-4 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm">
                {escenarios.map(e => {
                  const p = dataSheets.preciosNuevos[e.tipoIdx];
                  const isStaff = p && (p.categoria || '').toLowerCase().includes('staff'), isWks = p && (p.categoria + p.tipo).toLowerCase().includes('workshop');
                  let cTot = 0;
                  if (p) { if(isStaff) { const s = e.cantidad * e.sueldoBruto; cTot = s + s*pctCostoLaboral/100 + s*pctIndirectos/100; } else if(isWks) { cTot = e.cantidad * e.costoDirecto; } else { const b = e.cantidad * p.costoFijo; cTot = b + b*pctIndirectos/100; } }
                  const res = (e.cantidad * e.ventaUnit) - cTot, mgn = e.ventaUnit ? (res / (e.cantidad * e.ventaUnit)) * 100 : 0;
                  return (
                    <tr key={e.id} className="border-t border-purple-50 hover:bg-purple-50/30 transition">
                      <td className="p-2 sm:p-4"><select value={e.cliente} onChange={(ev) => actualizarFila(e.id, 'cliente', ev.target.value)} className="w-full bg-transparent focus:outline-none font-medium truncate">{dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                      <td className="p-2 sm:p-4"><select value={e.tipoIdx} onChange={(ev) => actualizarFila(e.id, 'tipoIdx', ev.target.value)} className="w-full bg-transparent focus:outline-none text-purple-600 font-bold text-[10px] sm:text-xs truncate">{dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>)}</select></td>
                      <td className="p-2 sm:p-4 text-center"><input type="number" value={e.cantidad} onChange={(ev) => actualizarFila(e.id, 'cantidad', ev.target.value)} className="w-10 sm:w-12 text-center bg-purple-50 rounded font-bold" min="0" /></td>
                      <td className="p-2 sm:p-4 text-right"><input type="text" value={Number(e.ventaUnit||0).toLocaleString('es-AR')} onChange={(ev) => actualizarFila(e.id, 'ventaUnit', ev.target.value)} className="w-20 sm:w-28 text-right bg-blue-50 text-blue-700 font-bold rounded px-1 sm:px-2 border border-blue-200" /></td>
                      <td className="p-2 sm:p-4 text-right">{isStaff ? <input type="text" value={Number(e.sueldoBruto||0).toLocaleString('es-AR')} onChange={(ev) => actualizarFila(e.id, 'sueldoBruto', ev.target.value)} className="w-20 sm:w-24 text-right bg-pink-50 text-pink-700 font-bold rounded px-1 sm:px-2 border border-pink-200" /> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2 sm:p-4 text-right">{isWks ? <input type="text" value={Number(e.costoDirecto||0).toLocaleString('es-AR')} onChange={(ev) => actualizarFila(e.id, 'costoDirecto', ev.target.value)} className="w-20 sm:w-28 text-right bg-orange-50 text-orange-700 font-bold rounded px-1 sm:px-2 border border-orange-300" /> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-2 sm:p-4 text-right font-mono text-red-500 text-[10px] sm:text-xs">-{format(cTot)}</td>
                      <td className="p-2 sm:p-4 text-right font-bold text-green-600 text-xs sm:text-sm">{format(res)}</td>
                      <td className="p-2 sm:p-4 text-center"><span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{mgn.toFixed(1)}%</span></td>
                      <td className="p-2 sm:p-4 text-right print:hidden"><button onClick={() => setEscenarios(p => p.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500 font-bold">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-3 sm:p-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center"><h2 className="font-bold text-slate-700 text-xs sm:text-sm">📋 Historial de Escenarios Guardados</h2><button onClick={() => setMostrarHistorial(false)} className="text-slate-400 hover:text-slate-600 text-[10px] sm:text-xs print:hidden">Cerrar</button></div>
            <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {historial.length === 0 ? <div className="col-span-full text-center py-8 text-slate-400 text-[10px] sm:text-sm italic">No hay escenarios guardados en la nube de Horizon.</div> : historial.map(i => (
                  <div key={i.id} className="border border-purple-100 rounded-lg p-3 sm:p-4 hover:border-purple-400 transition bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2"><h3 className="font-black text-purple-700 text-xs sm:text-sm uppercase truncate pr-2">{i.nombre}</h3><button onClick={() => window.confirm('¿Eliminar este escenario?') && setHistorial(p => p.filter(h => h.id !== i.id))} className="text-slate-300 hover:text-red-500 print:hidden font-bold">✕</button></div>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold mb-3">{i.fecha}</p>
                    <div className="space-y-1 mb-4"><div className="flex justify-between text-[10px] sm:text-xs"><span className="text-slate-500">Venta Propuesta:</span><span className="font-bold text-green-600">{format(i.eerr?.propuesta?.ventasTotales||0)}</span></div><div className="flex justify-between text-[10px] sm:text-xs"><span className="text-slate-500">Ganancia Neta:</span><span className="font-bold text-blue-600">{format(i.eerr?.gananciaNetaTotal||0)}</span></div></div>
                    <button onClick={() => cargarEscenarioDesdeHistorial(i)} className="w-full bg-purple-50 text-purple-700 py-1.5 sm:py-2 rounded font-black text-[9px] sm:text-[10px] uppercase hover:bg-purple-600 hover:text-white transition print:hidden">Cargar Escenario</button>
                  </div>
              ))}
            </div>
          </div>
        )}

        {tienePermiso('simulacion') && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 mb-6 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-blue-50 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50"><h2 className="font-bold text-blue-700 text-xs sm:text-sm uppercase">Aporte por Cliente (Propuesta)</h2><button onClick={() => setMostrarAporte(!mostrarAporte)} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-black uppercase transition print:hidden">{mostrarAporte ? '✕ Ocultar' : '👁️ Mostrar'}</button></div>
          {mostrarAporte && (
            <div className="p-4 sm:p-6 space-y-4">
              {Object.keys(propuesta.porCliente).length === 0 ? <p className="text-center text-slate-300 text-[10px] sm:text-xs py-4 italic">Sin datos de simulación</p> : Object.entries(propuesta.porCliente).map(([nombre, datos]) => {
                const res = datos.ventas - datos.costos, mgn = datos.ventas ? (res / datos.ventas) * 100 : 0;
                return (
                  <div key={nombre} className="group">
                    <div className="flex justify-between items-center mb-1"><span className="text-xs sm:text-sm font-bold text-slate-700 truncate pr-2">{nombre}</span><span className="text-[10px] sm:text-xs font-black text-green-600 shrink-0">{format(res)}</span></div>
                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 mb-2"><span className="truncate">Venta: {format(datos.ventas)}</span><span className="shrink-0 pl-2">Margen: {mgn.toFixed(1)}%</span></div>
                    <div className="w-full bg-slate-100 h-2 sm:h-3 rounded-full overflow-hidden relative flex">
                      <div className={`h-full transition-all duration-500 z-10 ${mgn >= margenObjetivo ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`} style={{ width: `${Math.min(100, Math.max(0, mgn * 2))}%` }}></div>
                      {mgn < margenObjetivo && <div className="h-full bg-red-500/80 transition-all duration-500 animate-pulse" style={{ width: `${(margenObjetivo - mgn) * 2}%` }}></div>}
                      <div className="absolute top-0 h-full border-l-[1px] sm:border-l-2 border-white/50 z-20" style={{ left: `${margenObjetivo * 2}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {tienePermiso('eerr') && (
        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-3 sm:p-4 border-b border-purple-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600 text-white"><h2 className="font-bold text-xs sm:text-sm">📊 Estado de Resultados Comparativo</h2><button onClick={() => setMostrarEERR(!mostrarEERR)} className="bg-white/20 hover:bg-white/40 px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-black uppercase transition print:hidden">{mostrarEERR ? '✕ Ocultar' : '👁️ Mostrar'}</button></div>
          {mostrarEERR && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] sm:text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-purple-50 text-purple-600 font-bold uppercase text-[9px] sm:text-[10px]">
                    <th className="p-2 sm:p-3 border-r border-purple-100"></th><th className="p-2 sm:p-3 text-right border-r border-purple-100">EERR Enero-26</th><th className="p-2 sm:p-3 text-right border-r border-purple-100">%</th>
                    <th className="p-2 sm:p-3 text-right bg-green-50 border-r border-green-200">Propuesta</th><th className="p-2 sm:p-3 text-right bg-green-50 border-r border-green-200">%</th>
                    <th className="p-2 sm:p-3 text-right bg-blue-50 border-r border-blue-200">EERR Total</th><th className="p-2 sm:p-3 text-right bg-blue-50">%</th>
                  </tr>
                </thead>
                <tbody>
                  <EERRRow label="Ingreso" base={eerr.ingresoBase} prop={propuesta.ventasTotales} tot={eerr.ingresoTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} cProp="text-green-700" cTot="text-blue-700" />
                  <EERRRow label="Costo de ingresos" base={eerr.costoIngresoBase} prop={propuesta.costosTotales} tot={eerr.costoIngresosTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} isNegProp={true} isNegTot={true} cProp="text-red-600" cTot="text-red-600" />
                  <EERRRow label="Ganancia bruta" base={eerr.gananciaBrutaBase} prop={propuesta.margenBruto} tot={eerr.gananciaBrutaTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} />
                  <EERRRow label="Menos gasto de operación" base={eerr.gastoOperacionBase} prop={0} tot={eerr.gastoOperacionTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} indent={true} isNegTot={true} cProp="text-slate-400" cTot="text-red-600" />
                  <EERRRow label="Ingreso de operación (o pérdida)" base={eerr.ingresoOperacionBase || (eerr.gananciaBrutaBase - eerr.gastoOperacionBase)} prop={eerr.ingresoOperacionTotal - (eerr.gananciaBrutaBase - eerr.gastoOperacionBase)} tot={eerr.ingresoOperacionTotal} refBase={eerr.ingresoBase} refProp={eerr.ingresoTotal} refTot={eerr.ingresoTotal} cProp="text-green-700" cTot="text-blue-700" />
                  <EERRRow label="Más otros ingresos" base={eerr.otrosIngresosBase} prop={0} tot={eerr.otrosIngresosTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} cProp="text-slate-400" />
                  <EERRRow label="Menos gastos de otro tipo" base={eerr.otrosGastosBase} prop={0} tot={eerr.otrosGastosTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} isNegTot={true} cProp="text-slate-400" cTot="text-red-600" />
                  <EERRRow label="Ganancia neta" base={eerr.gananciaNetaBase} prop={propuesta.margenBruto} tot={eerr.gananciaNetaTotal} refBase={eerr.ingresoBase} refProp={propuesta.ventasTotales} refTot={eerr.ingresoTotal} isTotalRow={true} />
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {tienePermiso('objetivos') && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-black text-slate-700 uppercase">🎯 Objetivos 2026 - Tracking de Ventas</h2>
            <button onClick={() => syncNube({ID: Date.now(), Fecha: new Date().toLocaleString('es-AR'), LineasTotal: JSON.stringify(lineasVentaTotal), LineasReno: JSON.stringify(lineasRenovacion), LineasIncr: JSON.stringify(lineasIncremental)}, 'TrackingObjetivos', '✅ Objetivos guardados exitosamente en la base de datos.')} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-black hover:shadow-lg transition flex items-center gap-2 print:hidden w-full sm:w-auto justify-center">💾 Guardar Avance</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {renderVelocimetro("Objetivo Ventas Total 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
            {renderVelocimetro("Objetivo Renovación 2026", objRenovacion, lineasRenovacion, setLineasRenovacion, "renovacion", "#ec4899")}
            {renderVelocimetro("Objetivo Ventas Incremental 2026", objIncremental, lineasIncremental, setLineasIncremental, "incremental", "#3b82f6")}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default App;

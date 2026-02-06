import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

const cleanNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  let s = String(val).replace(/[$€£\s]/g, '').replace(/[^\d,.\-]/g, '');
  if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const normalizeKey = (k) => {
  if (!k && k !== 0) return '';
  const s = String(k).toLowerCase().trim();
  const accentMap = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
  return s.replace(/[áéíóúñ]/g, m => accentMap[m]).replace(/[^a-z0-9]/g, '');
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

function App() {
  const [dataSheets, setDataSheets] = useState({ preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {}, loading: true, error: null });
  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);
  const [objVentasTotal] = useState(2195176117);
  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasVenta')) || [{ id: 1, cliente: '', monto: '' }]);
  const [objRenovacion] = useState(1225673502);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasReno')) || [{ id: 1, cliente: '', monto: '' }]);
  const [objIncremental] = useState(969002614);
  const [lineasIncremental, setLineasIncremental] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasIncr')) || [{ id: 1, cliente: '', monto: '' }]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);
  const [mostrarAporte, setMostrarAporte] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [precios, clientes, cfg, eerr] = await Promise.all([
          fetchSheet('PreciosNuevos'), fetchSheet('Clientes'), fetchSheet('Configuracion'), fetchSheet('EERRBase')
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
        const clientesProcesados = clientes.map(c => c['Cliente'] ?? c['cliente'] ?? Object.values(c)[0] ?? '').filter(Boolean);

        setDataSheets({ preciosNuevos: preciosProcesados, clientes: clientesProcesados, config: configObj, eerrBase: eerrObj, eerrBaseNorm: eerrNorm, loading: false, error: null });
        setPctIndirectos(configObj['% Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        try {
          const resNube = await fetch(`${SCRIPT_URL}?sheet=HistorialCompartido`);
          const dataNube = await resNube.json();
          if (dataNube && Array.isArray(dataNube)) {
            const historialSincronizado = dataNube.map(item => ({
              id: item.ID.toString().replace("'", ""), // Limpia el ID
              nombre: item.Nombre,
              fecha: item.Fecha,
              // TRUCO: Parseamos solo si es string, si ya es objeto lo dejamos
              escenarios: typeof item.DatosEscenario === 'string' ? JSON.parse(item.DatosEscenario) : item.DatosEscenario,
              config: typeof item.Configuracion === 'string' ? JSON.parse(item.Configuracion) : item.Configuracion,
              eerr: typeof item.EERR === 'string' ? JSON.parse(item.EERR) : item.EERR
            }));
            setHistorial(historialSincronizado);
          }
        } catch(e) { console.error("Error nube:", e); }
        
        if (preciosProcesados.length > 0) {
          setEscenarios([{ id: Date.now(), cliente: clientesProcesados[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: preciosProcesados[0].sueldoSugerido || 0, ventaUnit: preciosProcesados[0].valor || 0 }]);
        }
      } catch (error) { setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos.' })); }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental]);

  const agregarFila = () => {
    const pDef = dataSheets.preciosNuevos[0] || { sueldoSugerido: 0, valor: 0 };
    setEscenarios(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || 'Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: pDef.sueldoSugerido, ventaUnit: pDef.valor }]);
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const up = { ...e };
      if (campo === 'ventaUnit' || campo === 'sueldoBruto') up[campo] = parseInt(String(valor).replace(/\D/g, '')) || 0;
      else if (campo === 'tipoIdx') {
        up.tipoIdx = Number(valor);
        const p = dataSheets.preciosNuevos[up.tipoIdx];
        if (p) { up.sueldoBruto = p.sueldoSugerido; up.ventaUnit = p.valor; }
      } else up[campo] = valor;
      return up;
    }));
  };

  const agregarLineaVenta = (t) => {
    const n = { id: Date.now(), cliente: '', monto: '' };
    if (t === 'total') setLineasVentaTotal(p => [...p, n]);
    if (t === 'renovacion') setLineasRenovacion(p => [...p, n]);
    if (t === 'incremental') setLineasIncremental(p => [...p, n]);
  };

  const actualizarLineaVenta = (t, id, c, v) => {
    const f = (ls) => ls.map(l => l.id === id ? { ...l, [c]: v } : l);
    if (t === 'total') setLineasVentaTotal(p => f(p));
    if (t === 'renovacion') setLineasRenovacion(p => f(p));
    if (t === 'incremental') setLineasIncremental(p => f(p));
  };

  const eliminarLineaVenta = (t, id) => {
    if (t === 'total') setLineasVentaTotal(p => p.filter(l => l.id !== id));
    if (t === 'renovacion') setLineasRenovacion(p => p.filter(l => l.id !== id));
    if (t === 'incremental') setLineasIncremental(p => p.filter(l => l.id !== id));
  };

  const calcularTotalLineas = (ls) => ls.reduce((s, l) => s + (Number(l.monto) || 0), 0);

  const calcularPropuesta = () => {
    let vt = 0, ct = 0; const pc = {};
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx]; if (!p) return;
      const vF = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
      let cF = 0;
      if (p.categoria.toLowerCase().includes('staff')) {
        const sT = e.cantidad * e.sueldoBruto;
        cF = sT + (sT * pctCostoLaboral/100) + (sT * pctIndirectos/100);
      } else {
        const b = e.cantidad * p.costoFijo;
        cF = b + (b * pctIndirectos/100);
      }
      vt += vF; ct += cF;
      if (!pc[e.cliente]) pc[e.cliente] = { ventas: 0, costos: 0 };
      pc[e.cliente].ventas += vF; pc[e.cliente].costos += cF;
    });
    return { ventasTotales: vt, costosTotales: ct, margenBruto: vt - ct, margenBrutoPct: vt > 0 ? ((vt - ct) / vt) * 100 : 0, porCliente: pc };
  };

  const calcularEERRTotal = () => {
    const pr = calcularPropuesta();
    const eb = dataSheets.eerrBase, en = dataSheets.eerrBaseNorm;
    const iB = tolerantGet(eb, 'Ingreso') || 0, cB = tolerantGet(eb, 'Costo de ingresos') || 0, gO = tolerantGet(eb, 'Menos gasto de operación') || 0;
    const nB = tolerantGet(eb, 'Ganancia neta') || 0;
    const iT = iB + pr.ventasTotales, cT = cB + pr.costosTotales, gB = iT - cT, gOT = gastosOperativos || gO;
    const nT = gB - gOT + (tolerantGet(eb, 'Más otros ingresos') || 0) - (tolerantGet(eb, 'Menos gastos de otro tipo') || 0);
    return { ingresoBase: iB, ingresoTotal: iT, costoIngresosTotal: cT, gananciaBrutaTotal: gB, gananciaNetaTotal: nT, gananciaNetaBase: nB, margenNetoPct: iT > 0 ? (nT / iT) * 100 : 0, propuesta: pr };
  };

  const guardarEscenario = async () => {
    const nombre = window.prompt("Nombre escenario:", `Escenario ${historial.length + 1}`);
    if (!nombre) return;
    const eerrActual = calcularEERRTotal();
    const nuevo = { id: Date.now(), nombre, fecha: new Date().toLocaleString('es-AR'), escenarios, config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental }, eerr: eerrActual };
    try {
      const p = new URLSearchParams(); p.append('payload', JSON.stringify(nuevo));
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p.toString() });
      setHistorial(prev => [nuevo, ...prev]);
      alert("✅ Sincronizado");
    } catch(e) { alert("Error"); }
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);

  const renderVelocimetro = (titulo, obj, ls, setL, tipo, color) => {
    const total = calcularTotalLineas(ls);
    const pct = obj > 0 ? Math.min((total / obj) * 100, 100) : 0;
    const arc = 251.2, filled = (pct / 100) * arc;
    const getColor = () => pct >= 100 ? '#16a34a' : pct >= 50 ? '#f97316' : '#dc2626';
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color }}>{titulo}</h3>
        <div className="relative flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={getColor()} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${filled} ${arc}`} style={{ transition: 'all 0.8s' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-8"><span className="text-3xl font-black" style={{ color: getColor() }}>{pct.toFixed(0)}%</span></div>
        </div>
        <div className="space-y-3 bg-purple-50 p-4 rounded-lg">
          <label className="text-[10px] font-bold text-purple-600 uppercase">Objetivo: {formatNum(obj)}</label>
          <div className="flex justify-between items-center"><span className="text-[10px] font-bold">Ventas:</span><button onClick={() => agregarLineaVenta(tipo)} className="text-blue-600 font-black">+</button></div>
          {ls.map(l => (
            <div key={l.id} className="flex gap-1 mb-1">
              <input className="flex-1 text-[10px] p-1 rounded border" value={l.cliente} onChange={e => actualizarLineaVenta(tipo, l.id, 'cliente', e.target.value)} />
              <input className="w-20 text-[10px] p-1 rounded border font-bold" value={l.monto} onChange={e => actualizarLineaVenta(tipo, l.id, 'monto', e.target.value)} />
              <button onClick={() => eliminarLineaVenta(tipo, l.id)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
          <div className="text-right font-black text-blue-700 text-xs pt-2 border-t border-purple-200">Total: {format(total)}</div>
        </div>
      </div>
    );
  };

  const ee = calcularEERRTotal();
  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse uppercase">Horizon Cloud Syncing...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2026</h1>
          <div className="flex gap-2">
            <div className="bg-white p-2 rounded shadow-sm border border-purple-100 text-center">
              <span className="text-[9px] font-bold text-purple-400 block">GASTOS OP.</span>
              <input className="w-24 font-bold text-xs text-red-600 text-center focus:outline-none" value={formatNum(gastosOperativos)} onChange={e => setGastosOperativos(Number(e.target.value.replace(/\D/g, '')))} />
            </div>
            <div className="bg-white p-2 rounded shadow-sm border border-blue-100 text-center">
              <span className="text-[9px] font-bold text-blue-400 block">MARGIN OBJ.</span>
              <input className="w-12 font-bold text-xs text-blue-600 text-center focus:outline-none" type="number" value={margenObjetivo} onChange={e => setMargenObjetivo(Number(e.target.value))} />%
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-purple-100 mb-6">
          <div className="p-4 bg-purple-50 flex justify-between items-center border-b">
            <h2 className="font-bold text-sm">💼 Simulación Propuesta</h2>
            <div className="flex gap-2">
              <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className="text-xs font-bold px-3 py-1 border rounded bg-white">📋 Historial ({historial.length})</button>
              <button onClick={guardarEscenario} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold">💾 Guardar</button>
              <button onClick={agregarFila} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold">+ Agregar</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-slate-400 font-bold uppercase"><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Servicio</th><th className="p-3">Cant</th><th className="p-3 text-right">Venta</th><th className="p-3 text-right">Sueldo</th><th className="p-3 text-center">Margen</th><th></th></tr></thead>
            <tbody>
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx] || {};
                const res = (e.cantidad * e.ventaUnit) - ((e.cantidad * e.sueldoBruto) * (1 + (pctCostoLaboral+pctIndirectos)/100));
                const mgn = (e.cantidad * e.ventaUnit) > 0 ? (res / (e.cantidad * e.ventaUnit)) * 100 : 0;
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-3"><select className="bg-transparent font-medium" value={e.cliente} onChange={ev => actualizarFila(e.id, 'cliente', ev.target.value)}>{dataSheets.clientes.map(c => <option key={c}>{c}</option>)}</select></td>
                    <td className="p-3"><select className="bg-transparent text-purple-600 font-bold" value={e.tipoIdx} onChange={ev => actualizarFila(e.id, 'tipoIdx', ev.target.value)}>{dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>)}</select></td>
                    <td className="p-3 text-center"><input className="w-8 bg-slate-50 text-center font-bold" type="number" value={e.cantidad} onChange={ev => actualizarFila(e.id, 'cantidad', ev.target.value)} /></td>
                    <td className="p-3 text-right"><input className="w-24 text-right bg-blue-50 font-bold" value={e.ventaUnit.toLocaleString()} onChange={ev => actualizarFila(e.id, 'ventaUnit', ev.target.value)} /></td>
                    <td className="p-3 text-right"><input className="w-24 text-right bg-pink-50 font-bold" value={e.sueldoBruto.toLocaleString()} onChange={ev => actualizarFila(e.id, 'sueldoBruto', ev.target.value)} /></td>
                    <td className="p-3 text-center"><span className={`px-2 py-1 rounded font-black ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mgn.toFixed(0)}%</span></td>
                    <td className="p-3"><button onClick={() => setEscenarios(p => p.filter(x => x.id !== e.id))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mostrarHistorial && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {historial.map(h => (
              <div key={h.id} className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
                <h4 className="font-black text-purple-700 uppercase text-xs truncate">{h.nombre}</h4>
                <p className="text-[10px] text-slate-400 mb-4">{h.fecha}</p>
                <button className="w-full bg-purple-600 text-white py-2 rounded font-black text-[10px] uppercase" onClick={() => {
                  setEscenarios([...h.escenarios]);
                  setPctIndirectos(h.config.pctIndirectos);
                  setPctCostoLaboral(h.config.pctCostoLaboral);
                  setGastosOperativos(h.config.gastosOperativos);
                  setLineasVentaTotal(h.config.lineasVentaTotal);
                  setMostrarHistorial(false);
                }}>Cargar Escenario</button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-8">
          <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm uppercase">Estado de Resultados Comparativo</div>
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase"><tr><th className="p-3 text-left">Concepto</th><th className="p-3">EERR Dic-25</th><th className="p-3 bg-green-50 text-green-700">Propuesta</th><th className="p-3 bg-blue-50 text-blue-700">Total 2026</th></tr></thead>
            <tbody>
              <tr className="border-t"><td className="p-3 text-left font-bold">Ingresos</td><td className="p-3">{format(ee.ingresoBase)}</td><td className="p-3 bg-green-50">{format(ee.propuesta.ventasTotales)}</td><td className="p-3 bg-blue-50 font-black">{format(ee.ingresoTotal)}</td></tr>
              <tr className="border-t"><td className="p-3 text-left font-bold">Ganancia Neta</td><td className="p-3">{format(ee.gananciaNetaBase)}</td><td className="p-3 bg-green-50">{format(ee.propuesta.margenBruto)}</td><td className="p-3 bg-blue-50 font-black">{format(ee.gananciaNetaTotal)}</td></tr>
              <tr className="border-t bg-purple-50"><td className="p-3 text-left font-black">MARGEN NETO %</td><td className="p-3">---</td><td className="p-3 bg-green-100 font-black">---</td><td className="p-3 bg-blue-100 font-black">{ee.margenNetoPct.toFixed(1)}%</td></tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {renderVelocimetro("Ventas Total 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
          {renderVelocimetro("Renovación 2026", objRenovacion, lineasRenovacion, setLineasRenovacion, "renovacion", "#ec4899")}
          {renderVelocimetro("Incremental 2026", objIncremental, lineasIncremental, setLineasIncremental, "incremental", "#3b82f6")}
        </div>
      </div>
    </div>
  );
}

export default App;

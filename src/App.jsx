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
    headers.forEach((header, i) => {
      obj[header] = cells[i] !== undefined ? cells[i] : '';
    });
    return obj;
  });
};

function App() {
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {}, loading: true, error: null
  });

  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);
  const [isReady, setIsReady] = useState(false);

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

  // CORRECCIÓN 1: Mapeo robusto e insensible a mayúsculas para la nube
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
          if (concepto !== undefined) { eerrObj[String(concepto).trim()] = cleanNum(montoCell); }
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

        const clientesProcesados = clientes.map(c => c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0] ?? '').filter(Boolean);

        setDataSheets({
          preciosNuevos: preciosProcesados, clientes: clientesProcesados, config: configObj, eerrBase: eerrObj, eerrBaseNorm: eerrNorm, loading: false, error: null
        });

        try {
          const resNube = await fetch(`${SCRIPT_URL}?sheet=HistorialCompartido`);
          const dataNube = await resNube.json();
          
          if (dataNube && Array.isArray(dataNube) && dataNube.length > 0) {
            const getProp = (obj, key) => {
              const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
              return found ? obj[found] : null;
            };

            const historialSincronizado = dataNube.map(item => {
              const rawEscenarios = getProp(item, 'DatosEscenario');
              const rawConfig = getProp(item, 'Configuracion');
              const rawEerr = getProp(item, 'EERR');
              return {
                id: getProp(item, 'ID')?.toString().replace(/'/g, "") || Date.now(),
                nombre: getProp(item, 'Nombre') || "Sin nombre",
                fecha: getProp(item, 'Fecha') || "",
                escenarios: typeof rawEscenarios === 'string' ? JSON.parse(rawEscenarios) : (rawEscenarios || []),
                config: typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig || {}),
                eerr: typeof rawEerr === 'string' ? JSON.parse(rawEerr) : (rawEerr || {})
              };
            });
            
            setHistorial(historialSincronizado);
            const ultimo = historialSincronizado[historialSincronizado.length - 1];
            if (ultimo && ultimo.escenarios.length > 0) {
              setEscenarios(ultimo.escenarios);
              setPctIndirectos(ultimo.config.pctIndirectos ?? 37);
              setPctCostoLaboral(ultimo.config.pctCostoLaboral ?? 45);
              setGastosOperativos(ultimo.config.gastosOperativos ?? 46539684);
              setMargenObjetivo(ultimo.config.margenObjetivo ?? 25);
              if(ultimo.config.lineasVentaTotal) setLineasVentaTotal(ultimo.config.lineasVentaTotal);
              if(ultimo.config.lineasRenovacion) setLineasRenovacion(ultimo.config.lineasRenovacion);
              if(ultimo.config.lineasIncremental) setLineasIncremental(ultimo.config.lineasIncremental);
            }
          } else {
            setPctIndirectos(configObj['% Indirectos'] ?? 37);
            setPctCostoLaboral(configObj['% Costo Laboral'] ?? 45);
            setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
            setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);
            if (preciosProcesados.length > 0) {
              setEscenarios([{ id: Date.now(), cliente: clientesProcesados[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: preciosProcesados[0].sueldoSugerido || 0, ventaUnit: preciosProcesados[0].valor || 0 }]);
            }
          }
        } catch(e) { console.error("Error nube:", e); }
        setIsReady(true);
      } catch (error) {
        console.error('Error general:', error);
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos.' }));
      }
    };
    cargarDatos();
  }, []);

  // CORRECCIÓN 2: Eliminado duplicado de useEffect. Solo queda el protegido por isReady.
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental, isReady]);

  const agregarFila = () => {
    if (dataSheets.loading) return;
    const precioDefault = (dataSheets.preciosNuevos && dataSheets.preciosNuevos.length > 0) ? dataSheets.preciosNuevos[0] : { sueldoSugerido: 0, valor: 0, costoFijo: 0, categoria: 'Otros', tipo: 'Default' };
    setEscenarios(prev => ([...prev, { id: Date.now(), cliente: (dataSheets.clientes && dataSheets.clientes[0]) || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: precioDefault.sueldoSugerido || 0, ventaUnit: precioDefault.valor || 0 }]));
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e };
      if (campo === 'ventaUnit' || campo === 'sueldoBruto') {
        updated[campo] = typeof valor === 'string' ? parseInt(valor.replace(/\D/g, '')) || 0 : Number(valor || 0);
      } else if (campo === 'tipoIdx') {
        updated.tipoIdx = Number(valor);
        const p = dataSheets.preciosNuevos[updated.tipoIdx];
        if (p) { updated.sueldoBruto = p.sueldoSugerido ?? 0; updated.ventaUnit = p.valor ?? 0; }
      } else { updated[campo] = valor; }
      return updated;
    }));
  };

  const agregarLineaVenta = (tipo) => {
    const nueva = { id: Date.now(), cliente: '', monto: '' };
    if (tipo === 'total') setLineasVentaTotal(prev => [...prev, nueva]);
    if (tipo === 'renovacion') setLineasRenovacion(prev => [...prev, nueva]);
    if (tipo === 'incremental') setLineasIncremental(prev => [...prev, nueva]);
  };

  const actualizarLineaVenta = (tipo, id, campo, valor) => {
    const act = (ls) => ls.map(l => l.id === id ? { ...l, [campo]: valor } : l);
    if (tipo === 'total') setLineasVentaTotal(prev => act(prev));
    if (tipo === 'renovacion') setLineasRenovacion(prev => act(prev));
    if (tipo === 'incremental') setLineasIncremental(prev => act(prev));
  };

  const eliminarLineaVenta = (tipo, id) => {
    if (tipo === 'total') setLineasVentaTotal(prev => prev.filter(l => l.id !== id));
    if (tipo === 'renovacion') setLineasRenovacion(prev => prev.filter(l => l.id !== id));
    if (tipo === 'incremental') setLineasIncremental(prev => prev.filter(l => l.id !== id));
  };

  const calcularTotalLineas = (ls) => ls.reduce((s, l) => s + (Number(l.monto) || 0), 0);

  const calcularPropuesta = () => {
    let vt = 0, ct = 0; const pc = {};
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx]; if (!p) return;
      const vF = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
      let cF = 0;
      if ((p.categoria || '').toLowerCase().includes('staff')) {
        const sT = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
        cF = sT + (sT * pctCostoLaboral / 100) + (sT * pctIndirectos / 100);
      } else {
        const b = (Number(e.cantidad) || 0) * (Number(p.costoFijo) || 0);
        cF = b + (b * pctIndirectos / 100);
      }
      vt += vF; ct += cF;
      if (!pc[e.cliente]) pc[e.cliente] = { ventas: 0, costos: 0 };
      pc[e.cliente].ventas += vF; pc[e.cliente].costos += cF;
    });
    return { ventasTotales: vt, costosTotales: ct, margenBruto: vt - ct, margenBrutoPct: vt > 0 ? ((vt - ct) / vt) * 100 : 0, porCliente: pc };
  };

  const calcularEERRTotal = () => {
    const prop = calcularPropuesta();
    const eb = dataSheets.eerrBase; const en = dataSheets.eerrBaseNorm;
    const iB = tolerantGet(eb, 'Ingreso') || tolerantGet(en, normalizeKey('Ingreso')) || 0;
    const cIB = tolerantGet(eb, 'Costo de ingresos') || tolerantGet(en, normalizeKey('Costo de ingresos')) || 0;
    const gOB = tolerantGet(eb, 'Menos gasto de operación') || tolerantGet(en, normalizeKey('Menos gasto de operación')) || 0;
    const iT = iB + prop.ventasTotales; const cIT = cIB + prop.costosTotales;
    const gBT = iT - cIT; const gOT = gastosOperativos || gOB;
    const iOT = gBT - gOT;
    const oIB = tolerantGet(eb, 'Más otros ingresos') || 0;
    const oGB = tolerantGet(eb, 'Menos gastos de otro tipo') || 0;
    const gNT = iOT + oIB - oGB;
    return {
      ingresoBase: iB, gananciaNetaBase: tolerantGet(eb, 'Ganancia neta'), ingresoTotal: iT, costoIngresosTotal: cIT, gananciaBrutaTotal: gBT, gastoOperacionTotal: gOT, ingresoOperacionTotal: iOT, otrosIngresosTotal: oIB, otrosGastosTotal: oGB, gananciaNetaTotal: gNT,
      margenBrutoPct: iT > 0 ? (gBT / iT) * 100 : 0, margenNetoPct: iT > 0 ? (gNT / iT) * 100 : 0, desvioGananciaNeta: gNT - (tolerantGet(eb, 'Ganancia neta') || 0), propuesta: prop
    };
  };

  const desvioVsBase = useMemo(() => {
    const p = calcularPropuesta(); const e = calcularEERRTotal();
    return { ingreso: p.ventasTotales, costo: p.costosTotales, gananciaNeta: e.gananciaNetaTotal - (e.gananciaNetaBase || 0) };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, dataSheets.eerrBase]);

  const guardarEscenario = async () => {
    const n = window.prompt("Nombre del escenario:", `Escenario ${historial.length + 1}`); if (!n) return;
    const reg = { id: Date.now(), nombre: n, fecha: new Date().toLocaleString('es-AR'), escenarios, config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental }, eerr: calcularEERRTotal() };
    try {
      const p = new URLSearchParams(); p.append('payload', JSON.stringify(reg)); p.append('sheet', 'HistorialCompartido');
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
      setHistorial(prev => [reg, ...prev]); alert("✅ Sincronizado");
    } catch(e) { alert("Error"); }
  };

  const descargarPDF = () => {
    const eerr = calcularEERRTotal(); const prop = eerr.propuesta; const ts = new Date().toLocaleString('es-AR');
    let h = `<html><head><style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.bold{font-weight:bold}.green{color:green}.red{color:red}</style></head><body><h1>Horizon 2026</h1><p>Generado: ${ts}</p><table><tr><td class="bold">Ingreso Total:</td><td class="right">${format(eerr.ingresoTotal)}</td></tr><tr><td class="bold">Ganancia Neta:</td><td class="right bold">${format(eerr.gananciaNetaTotal)}</td></tr></table></body></html>`;
    const b = new Blob([h], { type: 'text/html' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `Horizon_${Date.now()}.html`; a.click();
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  const formatPct = (n) => `${n.toFixed(0)}%`;

  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = calcularTotalLineas(lineas);
    const pctCumplimiento = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const angle = -90 + (pctCumplimiento * 1.8);
    const totalArcLength = 251.2;
    const filledLength = (pctCumplimiento / 100) * totalArcLength;
    const gapLength = totalArcLength - filledLength;
    const getColor = () => { if (pctCumplimiento >= 100) return '#16a34a'; if (pctCumplimiento >= 75) return '#eab308'; if (pctCumplimiento >= 50) return '#f97316'; return '#dc2626'; };
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color: color }}>{titulo}</h3>
        <div className="relative w-full flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
            {pctCumplimiento < 100 && <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#6b6a6a" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${gapLength} ${totalArcLength}`} strokeDashoffset={`-${filledLength}`} style={{ transition: 'all 0.8s' }} />}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={getColor()} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${filledLength} ${totalArcLength}`} style={{ transition: 'all 0.8s' }} />
            <line x1="100" y1="100" x2="100" y2="30" stroke={getColor()} strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 0.8s' }} />
            <circle cx="100" cy="100" r="8" fill={getColor()} />
          </svg>
        </div>
        <div className="text-center mb-4"><p className="text-4xl font-black" style={{ color: getColor() }}>{pctCumplimiento.toFixed(1)}%</p></div>
        <div className="space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg">
          <div><label className="text-[10px] font-bold text-purple-600 uppercase block mb-1">Objetivo</label><div className="w-full bg-white border border-purple-200 rounded px-3 py-2 text-sm font-bold text-purple-700">{formatNum(objetivo)}</div></div>
          <div><div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold text-blue-600 uppercase">Clientes</label><button onClick={() => agregarLineaVenta(tipo)} className="text-blue-600 font-black">+</button></div>
          <div className="space-y-2 max-h-48 overflow-y-auto">{lineas.map((l) => (<div key={l.id} className="flex gap-2 items-center"><select value={l.cliente} onChange={(e) => actualizarLineaVenta(tipo, l.id, 'cliente', e.target.value)} className="flex-1 text-xs">{dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input type="text" value={l.monto === '' ? '' : formatNum(l.monto)} onChange={(e) => { const n = parseFloat(e.target.value.replace(/\D/g, '')) || 0; actualizarLineaVenta(tipo, l.id, 'monto', n); }} className="w-24 text-xs font-bold" />
          <button onClick={() => eliminarLineaVenta(tipo, l.id)} className="text-red-500">✕</button></div>))}</div></div>
        </div>
      </div>
    );
  };

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">SINCRONIZANDO...</div>;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2026</h1></div>
          <div className="flex gap-3">
            <div className="bg-white p-2 rounded border"> <span className="text-[10px] font-bold text-purple-400 block">Gastos Op.</span><input type="text" value={formatNum(gastosOperativos)} onChange={e => setGastosOperativos(parseFloat(e.target.value.replace(/\D/g, '')) || 0)} className="w-28 font-bold text-xs" /></div>
            <div className="bg-white p-2 rounded border"> <span className="text-[10px] font-bold text-blue-400 block">Indirectos</span><input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(cleanNum(e.target.value))} className="w-12 font-bold" />%</div>
            <div className="bg-white p-2 rounded border"> <span className="text-[10px] font-bold text-pink-400 block">Laboral</span><input type="number" value={pctCostoLaboral} onChange={e => setPctCostoLaboral(cleanNum(e.target.value))} className="w-12 font-bold" />%</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-purple-100 mb-6">
          <div className="p-4 border-b flex justify-between items-center bg-purple-50/50">
            <h2 className="font-bold text-sm uppercase">Simulación de Propuesta</h2>
            <div className="flex gap-2">
              <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className="text-xs font-bold px-3 py-1 border rounded">📋 Historial ({historial.length})</button>
              <button onClick={guardarEscenario} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold">💾 Guardar</button>
              <button onClick={descargarPDF} className="bg-purple-600 text-white px-4 py-1.5 rounded text-xs font-bold">📄 PDF</button>
              <button onClick={agregarFila} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold">+ Agregar</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/20"><th className="p-4">Cliente</th><th className="p-4">Servicio</th><th className="p-4">Cant</th><th className="p-4">Venta</th><th className="p-4">Sueldo</th><th className="p-4">Margen</th><th className="p-4"></th></tr></thead>
            <tbody>
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx]; const isStaff = p?.categoria.toLowerCase().includes('staff');
                const v = e.cantidad * e.ventaUnit;
                const c = isStaff ? (e.cantidad * e.sueldoBruto * (1 + (pctCostoLaboral+pctIndirectos)/100)) : (e.cantidad * p?.costoFijo * (1 + pctIndirectos/100));
                const m = v > 0 ? ((v - c) / v * 100) : 0;
                return (
                  <tr key={e.id} className="border-t hover:bg-slate-50">
                    <td className="p-4"><select value={e.cliente} onChange={ev => actualizarFila(e.id, 'cliente', ev.target.value)} className="bg-transparent">{dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                    <td className="p-4"><select value={e.tipoIdx} onChange={ev => actualizarFila(e.id, 'tipoIdx', ev.target.value)} className="text-xs">{dataSheets.preciosNuevos.map((pr, i) => <option key={i} value={i}>{pr.categoria}-{pr.tipo}</option>)}</select></td>
                    <td className="p-4"><input type="number" value={e.cantidad} onChange={ev => actualizarFila(e.id, 'cantidad', ev.target.value)} className="w-10 text-center" /></td>
                    <td className="p-4"><input type="text" value={e.ventaUnit.toLocaleString('es-AR')} onChange={ev => actualizarFila(e.id, 'ventaUnit', ev.target.value)} className="w-24 text-right font-bold" /></td>
                    <td className="p-4">{isStaff ? <input type="text" value={e.sueldoBruto.toLocaleString('es-AR')} onChange={ev => actualizarFila(e.id, 'sueldoBruto', ev.target.value)} className="w-24 text-right" /> : '-'}</td>
                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-black ${m >= margenObjetivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.toFixed(1)}%</span></td>
                    <td className="p-4"><button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 mb-6 p-4">
            <h2 className="font-bold text-sm uppercase mb-4">Escenarios en la Nube</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {historial.map(item => (
                <div key={item.id} className="border p-4 rounded-lg">
                  <h3 className="font-black text-purple-700 text-xs uppercase">{item.nombre}</h3>
                  <p className="text-[10px] text-slate-400 mb-3">{item.fecha}</p>
                  <button onClick={() => {
                    // CORRECCIÓN 3: Función de carga desde historial restaurando todos los estados.
                    if(window.confirm(`¿Cargar "${item.nombre}"?`)) {
                      setEscenarios(JSON.parse(JSON.stringify(item.escenarios)));
                      const c = item.config || {};
                      setPctIndirectos(c.pctIndirectos ?? 37);
                      setPctCostoLaboral(c.pctCostoLaboral ?? 45);
                      setGastosOperativos(c.gastosOperativos ?? 46539684);
                      setMargenObjetivo(c.margenObjetivo ?? 25);
                      if(c.lineasVentaTotal) setLineasVentaTotal(c.lineasVentaTotal);
                      if(c.lineasRenovacion) setLineasRenovacion(c.lineasRenovacion);
                      if(c.lineasIncremental) setLineasIncremental(c.lineasIncremental);
                      setMostrarHistorial(false);
                    }
                  }} className="w-full bg-purple-50 text-purple-700 py-2 rounded text-[10px] font-black uppercase">Cargar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm">📊 Comparativo Proyectado</div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr><th className="p-3"></th><th className="p-3 text-right">Dic-25</th><th className="p-3 text-right">Propuesta</th><th className="p-3 text-right">Total</th></tr></thead>
            <tbody>
              <tr><td className="p-3 font-bold">Ingresos</td><td className="p-3 text-right">{format(eerr.ingresoBase)}</td><td className="p-3 text-right text-green-600 font-bold">+{format(propuesta.ventasTotales)}</td><td className="p-3 text-right font-black">{format(eerr.ingresoTotal)}</td></tr>
              <tr className="bg-slate-50/50"><td className="p-3 font-bold">Ganancia Neta</td><td className="p-3 text-right">{format(eerr.gananciaNetaBase)}</td><td className="p-3 text-right text-green-600 font-bold">+{format(eerr.desvioGananciaNeta)}</td><td className="p-3 text-right font-black text-blue-700">{format(eerr.gananciaNetaTotal)}</td></tr>
            </tbody>
          </table>
          <div className="p-4 bg-purple-900 text-white flex justify-between items-center">
            <span className="font-black text-xs uppercase">Margen Neto Proyectado</span>
            <span className="text-2xl font-black">{eerr.margenNetoPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderVelocimetro("Total 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
          {renderVelocimetro("Renovación", objRenovacion, lineasRenovacion, setLineasRenovacion, "renovacion", "#ec4899")}
          {renderVelocimetro("Incremental", objIncremental, lineasIncremental, setLineasIncremental, "incremental", "#3b82f6")}
        </div>
      </div>
    </div>
  );
}

export default App;

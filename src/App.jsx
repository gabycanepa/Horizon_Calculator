import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
// URL de tu Apps Script para persistencia compartida
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

// --- FUNCIONES DE UTILIDAD ---
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

const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
const formatPct = (n) => `${n.toFixed(0)}%`;

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
    preciosNuevos: [],
    clientes: [],
    config: {},
    eerrBase: {},
    eerrBaseNorm: {},
    loading: true,
    error: null
  });

  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados de configuración
  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);

  // Objetivos Fijos
  const [objVentasTotal] = useState(2195176117);
  const [objRenovacion] = useState(1225673502);
  const [objIncremental] = useState(969002614);

  // Estados de tracking (velocímetros)
  const [lineasVentaTotal, setLineasVentaTotal] = useState([{ id: 1, cliente: '', monto: '' }]);
  const [lineasRenovacion, setLineasRenovacion] = useState([{ id: 1, cliente: '', monto: '' }]);
  const [lineasIncremental, setLineasIncremental] = useState([{ id: 1, cliente: '', monto: '' }]);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);
  const [mostrarAporte, setMostrarAporte] = useState(true);

  // --- CARGA INICIAL (SHEETS + NUBE) ---
  useEffect(() => {
    const cargarTodo = async () => {
      try {
        // 1. Cargar datos de referencia del Sheet principal
        const [precios, clientes, cfg, eerr] = await Promise.all([
          fetchSheet('PreciosNuevos'),
          fetchSheet('Clientes'),
          fetchSheet('Configuracion'),
          fetchSheet('EERRBase')
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

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: clientes.map(c => c['Cliente'] ?? Object.values(c)[0] ?? '').filter(Boolean),
          config: configObj,
          eerrBase: eerrObj,
          eerrBaseNorm: eerrNorm,
          loading: false,
          error: null
        });

        // Valores por defecto
        setPctIndirectos(configObj['% Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        // 2. Cargar historial compartido desde la Nube (Apps Script)
        const resNube = await fetch(SCRIPT_URL);
        const dataNube = await resNube.json();
        const historialSincronizado = dataNube.map(item => ({
          id: item.ID,
          nombre: item.Nombre,
          fecha: item.Fecha,
          escenarios: JSON.parse(item.DatosEscenario),
          config: JSON.parse(item.Configuracion),
          eerr: { propuesta: { ventasTotales: 0 } } // Placeholder para UI
        }));
        setHistorial(historialSincronizado);

      } catch (error) {
        console.error('Error en sincronización', error);
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error de conexión con Horizon Cloud.' }));
      }
    };
    cargarTodo();
  }, []);

  // --- LÓGICA DE CÁLCULO ---
  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    const porCliente = {};

    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const ventaFila = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
      let costoTotalFila = 0;
      if ((p.categoria || '').toLowerCase().includes('staff')) {
        const sueldoTotal = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
        costoTotalFila = sueldoTotal + (sueldoTotal * (pctCostoLaboral / 100)) + (sueldoTotal * (pctIndirectos / 100));
      } else {
        const base = (Number(e.cantidad) || 0) * (Number(p.costoFijo) || 0);
        costoTotalFila = base + (base * (pctIndirectos / 100));
      }
      ventasTotales += ventaFila;
      costosTotales += costoTotalFila;
      if (!porCliente[e.cliente]) porCliente[e.cliente] = { ventas: 0, costos: 0 };
      porCliente[e.cliente].ventas += ventaFila;
      porCliente[e.cliente].costos += costoTotalFila;
    });

    return { ventasTotales, costosTotales, margenBruto: ventasTotales - costosTotales, porCliente };
  };

  const calcularEERRTotal = () => {
    const prop = calcularPropuesta();
    const eerrB = dataSheets.eerrBase;
    const ingresoBase = tolerantGet(eerrB, 'Ingreso');
    const costoBase = tolerantGet(eerrB, 'Costo de ingresos');
    const netaBase = tolerantGet(eerrB, 'Ganancia neta');

    const ingresoTotal = ingresoBase + prop.ventasTotales;
    const costoTotal = costoBase + prop.costosTotales;
    const gananciaBruta = ingresoTotal - costoTotal;
    const gananciaNeta = gananciaBruta - gastosOperativos + (tolerantGet(eerrB, 'Más otros ingresos')) - (tolerantGet(eerrB, 'Menos gastos de otro tipo'));

    return {
      ingresoTotal,
      costoIngresosTotal: costoTotal,
      gananciaBrutaTotal: gananciaBruta,
      gananciaNetaTotal: gananciaNeta,
      gananciaNetaBase: netaBase,
      margenNetoPct: ingresoTotal > 0 ? (gananciaNeta / ingresoTotal) * 100 : 0,
      propuesta: prop
    };
  };

  const eerrCalculado = calcularEERRTotal();

  // --- PERSISTENCIA NUBE ---
  const guardarEscenario = async () => {
    const nombre = window.prompt("Nombre del escenario para compartir:");
    if (!nombre) return;
    setIsSyncing(true);

    const dataParaGuardar = {
      id: Date.now(),
      nombre: nombre,
      fecha: new Date().toLocaleString('es-AR'),
      escenarios: escenarios,
      config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental }
    };

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(dataParaGuardar)
      });
      setHistorial(prev => [dataParaGuardar, ...prev]);
      alert("✅ Sincronizado en Google Sheets para todo el equipo.");
    } catch (e) {
      alert("Error al guardar en la nube.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- RENDERS ---
  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);
    const pct = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const arcTotal = 251.2;
    const filled = (pct / 100) * arcTotal;
    const gap = arcTotal - filled;
    const angle = -90 + (pct * 1.8);

    const getStatusColor = () => {
      if (pct >= 100) return '#16a34a';
      if (pct >= 75) return '#eab308';
      return '#dc2626';
    };

    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-[10px] font-black text-center mb-2 uppercase" style={{ color }}>{titulo}</h3>
        <svg viewBox="0 0 200 120" className="w-full mb-4">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
          {pct < 100 && (
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${gap} ${arcTotal}`} strokeDashoffset={`-${filled}`} opacity="0.2" />
          )}
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={getStatusColor()} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${filled} ${arcTotal}`} style={{ transition: 'all 0.8s' }} />
          <line x1="100" y1="100" x2="100" y2="40" stroke="#334155" strokeWidth="3" transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 0.8s' }} />
        </svg>
        <div className="text-center font-black text-2xl mb-4" style={{ color: getStatusColor() }}>{pct.toFixed(1)}%</div>
        <div className="bg-slate-50 p-3 rounded-lg space-y-2">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">TOTAL REAL:</span>
            <span className="text-blue-700">{format(totalReal)}</span>
          </div>
          {pct < 100 && (
            <div className="flex justify-between text-[10px] font-bold border-t pt-1">
              <span className="text-red-400">RESTAN:</span>
              <span className="text-red-600">{format(objetivo - totalReal)}</span>
            </div>
          )}
          <button onClick={() => setLineas(prev => [...prev, { id: Date.now(), cliente: '', monto: '' }])} className="w-full text-[10px] font-black text-blue-500 hover:bg-blue-50 py-1 rounded">+</button>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {lineas.map(l => (
              <div key={l.id} className="flex gap-1">
                <input className="flex-1 text-[10px] border p-1 rounded" placeholder="Cliente" value={l.cliente} onChange={e => setLineas(prev => prev.map(x => x.id === l.id ? {...x, cliente: e.target.value} : x))} />
                <input className="w-20 text-[10px] border p-1 rounded font-bold" placeholder="Monto" value={l.monto} onChange={e => setLineas(prev => prev.map(x => x.id === l.id ? {...x, monto: e.target.value.replace(/\D/g,'')} : x))} />
                <button onClick={() => setLineas(prev => prev.filter(x => x.id !== l.id))} className="text-red-300">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (dataSheets.loading) return <div className="flex h-screen items-center justify-center font-black text-purple-600 animate-pulse">SINCRONIZANDO HORIZON CLOUD...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2.0</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cloud Sincronizado</p>
          </div>
          <div className="flex gap-3">
             <div className="bg-white p-3 rounded-xl shadow-sm border border-purple-100">
                <span className="text-[10px] font-black text-purple-400 block uppercase mb-1">Gastos Op.</span>
                <input type="text" value={gastosOperativos === 0 ? '' : formatNum(gastosOperativos)} onChange={e => setGastosOperativos(cleanNum(e.target.value))} className="w-32 font-black text-red-600 focus:outline-none text-sm" />
             </div>
             <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100 flex flex-col items-center">
                <span className="text-[10px] font-black text-blue-400 block uppercase mb-1">Indirectos</span>
                <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(Number(e.target.value))} className="w-12 font-black text-blue-600 focus:outline-none text-center" />
             </div>
             <button onClick={guardarEscenario} disabled={isSyncing} className="bg-purple-600 text-white px-6 rounded-xl font-black text-xs uppercase hover:bg-purple-700 transition shadow-lg">
                {isSyncing ? 'Sincronizando...' : '💾 Guardar en Nube'}
             </button>
          </div>
        </div>

        {/* TABLA DE SIMULACIÓN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
           <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h2 className="font-black text-xs uppercase text-slate-500 tracking-tighter">Simulación de Propuesta Comercial</h2>
              <div className="flex gap-2">
                <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className="text-[10px] font-black uppercase px-3 py-1 bg-white border rounded-lg">Historial ({historial.length})</button>
                <button onClick={() => setEscenarios([...escenarios, { id: Date.now(), cliente: dataSheets.clientes[0], tipoIdx: 0, cantidad: 1, sueldoBruto: 0, ventaUnit: 0 }])} className="text-[10px] font-black uppercase px-3 py-1 bg-blue-600 text-white rounded-lg">+ Agregar Fila</button>
              </div>
           </div>
           <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Servicio</th>
                  <th className="p-4 text-center">Cant</th>
                  <th className="p-4 text-right">Venta Unit</th>
                  <th className="p-4 text-right">Sueldo Bruto</th>
                  <th className="p-4 text-right">Margen</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {escenarios.map(e => {
                  const p = dataSheets.preciosNuevos[e.tipoIdx];
                  const venta = e.cantidad * e.ventaUnit;
                  const sueldoTotal = e.cantidad * e.sueldoBruto;
                  const costo = sueldoTotal + (sueldoTotal * (pctCostoLaboral/100)) + (sueldoTotal * (pctIndirectos/100));
                  const mgn = venta > 0 ? ((venta - costo) / venta) * 100 : 0;
                  return (
                    <tr key={e.id} className="border-t hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-xs">{e.cliente}</td>
                      <td className="p-4">
                        <select className="text-[10px] font-bold text-purple-600 uppercase" value={e.tipoIdx} onChange={ev => {
                          const idx = Number(ev.target.value);
                          setEscenarios(escenarios.map(x => x.id === e.id ? {...x, tipoIdx: idx, ventaUnit: dataSheets.preciosNuevos[idx].valor, sueldoBruto: dataSheets.preciosNuevos[idx].sueldoSugerido} : x));
                        }}>
                          {dataSheets.preciosNuevos.map((serv, i) => <option key={i} value={i}>{serv.categoria} - {serv.tipo}</option>)}
                        </select>
                      </td>
                      <td className="p-4 text-center">
                        <input type="number" className="w-12 text-center font-bold bg-slate-100 rounded" value={e.cantidad} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, cantidad: Number(ev.target.value)} : x))} />
                      </td>
                      <td className="p-4 text-right">
                        <input type="text" className="w-24 text-right font-black text-blue-600" value={formatNum(e.ventaUnit)} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, ventaUnit: cleanNum(ev.target.value)} : x))} />
                      </td>
                      <td className="p-4 text-right">
                         <input type="text" className="w-24 text-right font-black text-pink-600" value={formatNum(e.sueldoBruto)} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, sueldoBruto: cleanNum(ev.target.value)} : x))} />
                      </td>
                      <td className="p-4 text-right font-black">
                        <span className={`text-[10px] px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mgn.toFixed(1)}%</span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => setEscenarios(escenarios.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
           </table>
        </div>

        {/* APORTE POR CLIENTE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex justify-between items-center">
             <h2 className="text-xs font-black text-blue-700 uppercase">Aporte por Cliente (Gap de Margen)</h2>
             <button onClick={() => setMostrarAporte(!mostrarAporte)} className="text-[10px] font-black uppercase text-blue-400">{mostrarAporte ? 'Ocultar' : 'Ver'}</button>
          </div>
          {mostrarAporte && (
            <div className="p-6 space-y-4">
              {Object.entries(eerrCalculado.propuesta.porCliente).map(([cliente, d]) => {
                const mgn = d.ventas > 0 ? ((d.ventas - d.costos) / d.ventas) * 100 : 0;
                return (
                  <div key={cliente}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>{cliente}</span>
                      <span className={mgn >= margenObjetivo ? 'text-green-600' : 'text-red-600'}>{mgn.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full relative flex overflow-hidden">
                      <div className={`h-full ${mgn >= margenObjetivo ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, mgn * 2)}%` }}></div>
                      {mgn < margenObjetivo && (
                        <div className="h-full bg-red-500 animate-pulse" style={{ width: `${(margenObjetivo - mgn) * 2}%` }}></div>
                      )}
                      <div className="absolute top-0 h-full border-l-2 border-white/50" style={{ left: `${margenObjetivo * 2}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RESULTADOS FINALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-green-500">
              <span className="text-[10px] font-black text-slate-400 uppercase">Ingreso Total Proyectado</span>
              <div className="text-2xl font-black text-slate-800">{format(eerrCalculado.ingresoTotal)}</div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-blue-500">
              <span className="text-[10px] font-black text-slate-400 uppercase">Ganancia Neta Total</span>
              <div className="text-2xl font-black text-blue-700">{format(eerrCalculado.gananciaNetaTotal)}</div>
           </div>
           <div className="bg-purple-600 p-6 rounded-2xl shadow-lg text-white">
              <span className="text-[10px] font-black text-purple-200 uppercase">Margen Neto Final</span>
              <div className="text-3xl font-black">{eerrCalculado.margenNetoPct.toFixed(1)}%</div>
           </div>
        </div>

        {/* VELOCÍMETROS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {renderVelocimetro("Ventas Totales 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
           {renderVelocimetro("Renovaciones 2026", objRenovacion, lineasRenovacion, setLineasRenovacion, "reno", "#ec4899")}
           {renderVelocimetro("Incremental 2026", objIncremental, lineasIncremental, setLineasIncremental, "incr", "#3b82f6")}
        </div>
      </div>

      {/* MODAL HISTORIAL */}
      {mostrarHistorial && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="font-black text-slate-700 uppercase">Historial Compartido (Google Sheets)</h3>
                 <button onClick={() => setMostrarHistorial(false)} className="text-slate-400 text-2xl">✕</button>
              </div>
              <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                 {historial.map(h => (
                   <div key={h.id} className="border p-4 rounded-2xl hover:border-purple-500 transition group">
                      <div className="font-black text-purple-600 uppercase text-sm mb-1">{h.nombre}</div>
                      <div className="text-[10px] text-slate-400 mb-4">{h.fecha}</div>
                      <button onClick={() => {
                        setEscenarios(h.escenarios);
                        setPctIndirectos(h.config.pctIndirectos);
                        setPctCostoLaboral(h.config.pctCostoLaboral);
                        setGastosOperativos(h.config.gastosOperativos);
                        setLineasVentaTotal(h.config.lineasVentaTotal);
                        setMostrarHistorial(false);
                      }} className="w-full bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 transition">Cargar en Engine</button>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;

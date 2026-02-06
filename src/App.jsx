import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';

// --- UTILIDADES ---
const cleanNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  let s = String(val).replace(/[$€£\s]/g, '').replace(/[^\d,.\-]/g, '');
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

// --- API ---
const fetchSheet = async (sheetName) => {
  try {
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
      headers.forEach((header, i) => { obj[header] = cells[i] || ''; });
      return obj;
    });
  } catch (e) {
    console.error(`Error en sheet ${sheetName}:`, e);
    return [];
  }
};

function App() {
  // --- ESTADOS ---
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {}, loading: true, error: null
  });

  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState(() => JSON.parse(localStorage.getItem('hzn_historial')) || []);
  const [pctIndirectos, setPctIndirectos] = useState(37);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(45);
  const [gastosOperativos, setGastosOperativos] = useState(46539684);
  const [margenObjetivo, setMargenObjetivo] = useState(25);

  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasVenta')) || [{ id: 1, cliente: '', monto: '' }]);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasReno')) || [{ id: 1, cliente: '', monto: '' }]);
  const [lineasIncremental, setLineasIncremental] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasIncr')) || [{ id: 1, cliente: '', monto: '' }]);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);

  // --- EFECTOS ---
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [precios, clientes, cfg, eerr] = await Promise.all([
          fetchSheet('PreciosNuevos'), fetchSheet('Clientes'), fetchSheet('Configuracion'), fetchSheet('EERRBase')
        ]);

        const configObj = {};
        cfg.forEach(row => {
          const key = row['Parámetro'] || row['Parametro'] || Object.values(row)[0];
          configObj[String(key).trim()] = cleanNum(row['Valor'] || Object.values(row)[1]);
        });

        const eerrObj = {};
        const eerrNorm = {};
        eerr.forEach(row => {
          const concepto = row['Concepto'] || Object.values(row)[0];
          const val = cleanNum(row['Monto (ARS)'] || Object.values(row)[1]);
          eerrObj[String(concepto).trim()] = val;
          eerrNorm[normalizeKey(concepto)] = val;
        });

        const preciosProcesados = precios.map(p => ({
          categoria: p['Categoria'] || p['Categoría'] || 'Otros',
          tipo: p['Tipo'] || 'Default',
          valor: cleanNum(p['Valor (ARS)'] || p['Valor']),
          sueldoSugerido: cleanNum(p['Sueldo Sugerido (ARS)'] || p['Sueldo Sugerido']),
          costoFijo: cleanNum(p['Costo Fijo (ARS)'] || p['Costo Fijo'])
        }));

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: clientes.map(c => c['Cliente'] || Object.values(c)[0]).filter(Boolean),
          config: configObj, eerrBase: eerrObj, eerrBaseNorm: eerrNorm, loading: false, error: null
        });

        setPctIndirectos(configObj['% Indirectos'] || 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] || 45);
        setGastosOperativos(configObj['Gastos Operativos'] || 46539684);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] || 25);

      } catch (error) {
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error de conexión con Sheets.' }));
      }
    };
    cargarDatos();
  }, []);

  // --- LÓGICA ---
  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);

  const calcularPropuesta = () => {
    let ventasTotales = 0, costosTotales = 0;
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const ventaFila = e.cantidad * e.ventaUnit;
      let costoFila = 0;
      if (p.categoria.toLowerCase().includes('staff')) {
        const sueldo = e.cantidad * e.sueldoBruto;
        costoFila = sueldo + (sueldo * pctCostoLaboral / 100) + (sueldo * pctIndirectos / 100);
      } else {
        const base = e.cantidad * p.costoFijo;
        costoFila = base + (base * pctIndirectos / 100);
      }
      ventasTotales += ventaFila;
      costosTotales += costoFila;
    });
    return { ventasTotales, costosTotales, margenBruto: ventasTotales - costosTotales, margenBrutoPct: ventasTotales > 0 ? ((ventasTotales - costosTotales) / ventasTotales) * 100 : 0 };
  };

  const eerrCalculado = useMemo(() => {
    const p = calcularPropuesta();
    const ingresoBase = tolerantGet(dataSheets.eerrBase, 'Ingreso');
    const costoBase = tolerantGet(dataSheets.eerrBase, 'Costo de ingresos');
    
    const totalVentas = ingresoBase + p.ventasTotales;
    const totalCostos = costoBase + p.costosTotales;
    const gananciaBruta = totalVentas - totalCostos;
    const neta = gananciaBruta - gastosOperativos;

    return {
      ingresoTotal: totalVentas,
      costoTotal: totalCostos,
      gananciaBruta,
      gananciaNeta: neta,
      margenNetoPct: totalVentas > 0 ? (neta / totalVentas) * 100 : 0,
      propuesta: p
    };
  }, [escenarios, dataSheets, pctIndirectos, pctCostoLaboral, gastosOperativos]);

  const descargarPDF = () => {
    const timestamp = new Date().toLocaleString();
    let html = `<html><body style="font-family:sans-serif; padding:40px;">
      <h1 style="color:#7c3aed">HORIZON - Reporte Financiero 2026</h1>
      <p>Generado: ${timestamp}</p>
      <div style="background:#f3f4f6; padding:20px; border-radius:10px;">
        <h2>Resumen:</h2>
        <p>Ventas Totales: <b>${format(eerrCalculado.ingresoTotal)}</b></p>
        <p>Ganancia Neta: <b>${format(eerrCalculado.gananciaNeta)}</b></p>
        <p>Margen Neto: <b>${eerrCalculado.margenNetoPct.toFixed(1)}%</b></p>
      </div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Horizon_Reporte_${Date.now()}.html`;
    a.click();
  };

  // --- RENDER VELOCÍMETRO ---
  const renderVelocimetro = (titulo, objetivo, lineas, tipo, color) => {
    const real = lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0);
    const pct = Math.min((real / objetivo) * 100, 100);
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1">
        <h3 className="text-[10px] font-black uppercase text-center mb-4" style={{color}}>{titulo}</h3>
        <div className="flex justify-center items-center h-24">
           <span className="text-3xl font-black" style={{color}}>{pct.toFixed(1)}%</span>
        </div>
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-slate-400">TOTAL: {format(real)}</p>
        </div>
      </div>
    );
  };

  if (dataSheets.loading) return <div className="p-20 text-center font-black animate-pulse">CARGANDO ENGINE...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Horizon Finance Engine</h1>
          <div className="flex gap-4">
            <button onClick={descargarPDF} className="bg-purple-600 text-white px-6 py-2 rounded-full font-bold text-xs">DESCARGAR REPORTE</button>
            <button onClick={() => setEscenarios([{ id: Date.now(), cliente: dataSheets.clientes[0], tipoIdx: 0, cantidad: 1, sueldoBruto: 0, ventaUnit: 0 }])} className="bg-black text-white px-6 py-2 rounded-full font-bold text-xs">+ NUEVO SERVICIO</button>
          </div>
        </div>

        {/* DASHBOARD CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Ingreso Proyectado</p>
              <p className="text-xl font-black">{format(eerrCalculado.ingresoTotal)}</p>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Ganancia Neta</p>
              <p className="text-xl font-black text-purple-600">{format(eerrCalculado.gananciaNeta)}</p>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Margen Neto</p>
              <p className="text-xl font-black text-green-600">{eerrCalculado.margenNetoPct.toFixed(1)}%</p>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Desvío vs 2025</p>
              <p className="text-xl font-black text-blue-600">{format(eerrCalculado.propuesta.ventasTotales)}</p>
           </div>
        </div>

        {/* VELOCÍMETROS */}
        <div className="flex gap-6 mb-10">
           {renderVelocimetro("Objetivo Ventas 2026", 2195176117, lineasVentaTotal, "total", "#7c3aed")}
           {renderVelocimetro("Objetivo Renovación", 1225673502, lineasRenovacion, "reno", "#ec4899")}
           {renderVelocimetro("Objetivo Incremental", 969002614, lineasIncremental, "incr", "#3b82f6")}
        </div>

        {/* TABLA DE SIMULACIÓN */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
           <table className="w-full">
              <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                 <tr>
                    <th className="p-5 text-left">Cliente</th>
                    <th className="p-5 text-left">Categoría</th>
                    <th className="p-5 text-center">Cant</th>
                    <th className="p-5 text-right">Venta Unit.</th>
                    <th className="p-5 text-right">Resultado</th>
                    <th className="p-5"></th>
                 </tr>
              </thead>
              <tbody>
                 {escenarios.map(e => (
                    <tr key={e.id} className="border-b border-slate-100">
                       <td className="p-5 font-bold">{e.cliente}</td>
                       <td className="p-5 text-purple-600 font-bold">{dataSheets.preciosNuevos[e.tipoIdx]?.tipo}</td>
                       <td className="p-5 text-center">{e.cantidad}</td>
                       <td className="p-5 text-right font-bold">{format(e.ventaUnit)}</td>
                       <td className="p-5 text-right text-green-600 font-black">{format(e.cantidad * e.ventaUnit)}</td>
                       <td className="p-5 text-center">
                          <button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}

export default App;

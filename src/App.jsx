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
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [], clientes: [], config: {}, eerrBase: {}, eerrBaseNorm: {}, loading: true, error: null
  });

  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState(() => {
    const saved = localStorage.getItem('hzn_historial');
    return saved ? JSON.parse(saved) : [];
  });

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

        const clientesProcesados = clientes.map(c => c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0] ?? '').filter(Boolean);

        setDataSheets({
          preciosNuevos: preciosProcesados, clientes: clientesProcesados, config: configObj, eerrBase: eerrObj, eerrBaseNorm: eerrNorm, loading: false, error: null
        });

        setPctIndirectos(configObj['% Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        if (preciosProcesados.length > 0) {
          setEscenarios([{ id: Date.now(), cliente: clientesProcesados[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: preciosProcesados[0].sueldoSugerido || 0, ventaUnit: preciosProcesados[0].valor || 0 }]);
        }
      } catch (error) {
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos.' }));
      }
    };
    cargarDatos();
  }, []);

  // --- PERSISTENCIA ---
  useEffect(() => {
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_historial', JSON.stringify(historial));
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, historial, lineasVentaTotal, lineasRenovacion, lineasIncremental]);

  // --- FUNCIONES ---
  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  const formatPct = (n) => `${n.toFixed(0)}%`;

  const agregarFila = () => {
    const p = dataSheets.preciosNuevos[0];
    setEscenarios(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: p?.sueldoSugerido || 0, ventaUnit: p?.valor || 0 }]);
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
        if (p) { updated.sueldoBruto = p.sueldoSugerido; updated.ventaUnit = p.valor; }
      } else { updated[campo] = valor; }
      return updated;
    }));
  };

  const calcularPropuesta = () => {
    let ventasTotales = 0, costosTotales = 0;
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const venta = e.cantidad * e.ventaUnit;
      let costo = 0;
      if (p.categoria.toLowerCase().includes('staff')) {
        const sueldo = e.cantidad * e.sueldoBruto;
        costo = sueldo * (1 + (pctCostoLaboral / 100) + (pctIndirectos / 100));
      } else {
        costo = (e.cantidad * p.costoFijo) * (1 + (pctIndirectos / 100));
      }
      ventasTotales += venta; costosTotales += costo;
    });
    return { ventasTotales, costosTotales, margenBruto: ventasTotales - costosTotales, margenBrutoPct: ventasTotales > 0 ? ((ventasTotales - costosTotales) / ventasTotales) * 100 : 0 };
  };

  const calcularEERRTotal = () => {
    const p = calcularPropuesta();
    const eerr = dataSheets.eerrBase;
    const ingBase = tolerantGet(eerr, 'Ingreso');
    const costBase = tolerantGet(eerr, 'Costo de ingresos');
    const ingTotal = ingBase + p.ventasTotales;
    const costTotal = costBase + p.costosTotales;
    const gananciaBruta = ingTotal - costTotal;
    const neta = gananciaBruta - gastosOperativos + (tolerantGet(eerr, 'Más otros ingresos') - tolerantGet(eerr, 'Menos gastos de otro tipo'));
    
    return { 
      ...p, ingresoTotal: ingTotal, costoIngresosTotal: costTotal, gananciaBrutaTotal: gananciaBruta, 
      gananciaNetaTotal: neta, margenNetoPct: ingTotal > 0 ? (neta / ingTotal) * 100 : 0,
      gananciaNetaBase: tolerantGet(eerr, 'Ganancia neta'), propuesta: p, desvioGananciaNeta: neta - tolerantGet(eerr, 'Ganancia neta')
    };
  };

  const guardarEscenario = () => {
    const nombre = window.prompt("Nombre del escenario:", `Escenario ${historial.length + 1}`);
    if (!nombre) return;
    const nuevo = { id: Date.now(), nombre, fecha: new Date().toLocaleString(), escenarios, eerr: calcularEERRTotal(), config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental } };
    setHistorial(prev => [nuevo, ...prev]);
  };

  const descargarPDF = () => {
    const eerr = calcularEERRTotal();
    const timestamp = new Date().toLocaleString('es-AR');
    let html = `<html><head><style>
      body { font-family: sans-serif; padding: 30px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
      th { background-color: #f2f2f2; }
      .header { color: #7c3aed; }
    </style></head><body>
      <h1 class="header">HORIZON - Proyección Financiera 2026</h1>
      <p>Fecha: ${timestamp}</p>
      <h3>Resumen Ganancia Neta: ${format(eerr.gananciaNetaTotal)} (${eerr.margenNetoPct.toFixed(1)}%)</h3>
      <table>
        <thead><tr><th>Cliente</th><th>Servicio</th><th>Cant</th><th>Venta</th><th>Resultado</th></tr></thead>
        <tbody>${escenarios.map(e => `<tr><td>${e.cliente}</td><td>${dataSheets.preciosNuevos[e.tipoIdx].tipo}</td><td>${e.cantidad}</td><td>${format(e.ventaUnit * e.cantidad)}</td><td>${format((e.ventaUnit * e.cantidad) - (e.cantidad * e.sueldoBruto * 1.82))}</td></tr>`).join('')}</tbody>
      </table>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Horizon_Reporte_${Date.now()}.html`; a.click();
  };

  // --- RENDERS ---
  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);
    const pct = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const angle = -90 + (pct * 1.8);
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color }}>{titulo}</h3>
        <div className="relative w-full flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 251.2} 251.2`} />
            <line x1="100" y1="100" x2="100" y2="30" stroke={color} strokeWidth="3" transform={`rotate(${angle} 100 100)`} />
          </svg>
        </div>
        <p className="text-4xl font-black text-center" style={{ color }}>{pct.toFixed(1)}%</p>
      </div>
    );
  };

  const eerrFinal = calcularEERRTotal();
  const desvio = { ingreso: eerrFinal.propuesta.ventasTotales, costo: eerrFinal.propuesta.costosTotales, neta: eerrFinal.desvioGananciaNeta };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-purple-600">HORIZON FINANCE ENGINE 2026</h1>
          <div className="flex gap-2">
            <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(cleanNum(e.target.value))} className="w-16 border rounded p-1" /> % Ind.
          </div>
        </div>

        {/* TABLA SIMULACIÓN CON BOTÓN PDF */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h2 className="font-bold">💼 Simulación de Servicios</h2>
            <div className="flex gap-2">
              <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className="text-xs px-3 py-1 border rounded">📋 Historial</button>
              <button onClick={guardarEscenario} className="bg-green-600 text-white px-3 py-1 rounded text-xs">💾 Guardar</button>
              
              {/* EL BOTÓN SOLICITADO */}
              <button onClick={descargarPDF} className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700 transition">
                📄 Descargar PDF
              </button>

              <button onClick={agregarFila} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">+ Agregar</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 uppercase text-slate-500"><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Servicio</th><th className="p-3 text-center">Cant</th><th className="p-3 text-right">Venta</th><th className="p-3 text-right">Resultado</th><th className="p-3"></th></tr></thead>
            <tbody>
              {escenarios.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-bold">{e.cliente}</td>
                  <td className="p-3">{dataSheets.preciosNuevos[e.tipoIdx]?.tipo}</td>
                  <td className="p-3 text-center">{e.cantidad}</td>
                  <td className="p-3 text-right font-bold text-blue-600">{format(e.ventaUnit)}</td>
                  <td className="p-3 text-right font-bold text-green-600">{format((e.ventaUnit * e.cantidad) - (e.cantidad * e.sueldoBruto * 1.8))}</td>
                  <td className="p-3 text-center"><button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* EERR COMPARATIVO */}
        {mostrarEERR && (
          <div className="bg-white rounded-xl shadow-lg border p-6 mb-8">
            <h2 className="text-sm font-bold uppercase text-slate-400 mb-4">Análisis de Desvío vs 2025</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="p-4 bg-green-50 rounded-lg"><p className="text-xs font-bold text-green-600">+ INGRESO</p><p className="text-2xl font-black">{format(desvio.ingreso)}</p></div>
              <div className="p-4 bg-red-50 rounded-lg"><p className="text-xs font-bold text-red-600">- COSTO</p><p className="text-2xl font-black">{format(desvio.costo)}</p></div>
              <div className="p-4 bg-blue-50 rounded-lg"><p className="text-xs font-bold text-blue-600">GANANCIA NETA TOTAL</p><p className="text-2xl font-black">{format(eerrFinal.gananciaNetaTotal)}</p></div>
            </div>
          </div>
        )}

        {/* VELOCÍMETROS */}
        <div className="flex gap-6">
          {renderVelocimetro("Ventas Total 2026", objVentasTotal, lineasVentaTotal, null, "total", "#7c3aed")}
          {renderVelocimetro("Renovación", objRenovacion, lineasRenovacion, null, "renovacion", "#ec4899")}
          {renderVelocimetro("Incremental", objIncremental, lineasIncremental, null, "incremental", "#3b82f6")}
        </div>
      </div>
    </div>
  );
}

export default App;

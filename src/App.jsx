import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';

// Limpia y convierte strings numéricos a Number de forma robusta
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

// Normaliza keys para búsqueda tolerante (quita acentos, espacios, minúsculas)
const normalizeKey = (k) => {
  if (!k && k !== 0) return '';
  const s = String(k).toLowerCase().trim();
  const accentMap = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
  let out = s.replace(/[áéíóúñ]/g, m => accentMap[m]);
  out = out.replace(/[^a-z0-9]/g, '');
  return out;
};

// Busca en un objeto map original por clave tolerante
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
    preciosNuevos: [],
    clientes: [],
    config: {},
    eerrBase: {},
    eerrBaseNorm: {},
    loading: true,
    error: null
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

  useEffect(() => {
    const cargarDatos = async () => {
      try {
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
          if (concepto !== undefined) {
            eerrObj[String(concepto).trim()] = cleanNum(montoCell);
          }
        });

        const eerrNorm = {};
        Object.keys(eerrObj).forEach(k => {
          eerrNorm[normalizeKey(k)] = eerrObj[k];
        });

        const preciosProcesados = precios.map(p => ({
          categoria: p['Categoria'] ?? p['Categoría'] ?? Object.values(p)[0] ?? 'Otros',
          tipo: p['Tipo'] ?? Object.values(p)[1] ?? 'Default',
          valor: cleanNum(p['Valor (ARS)'] ?? p['Valor'] ?? Object.values(p)[2]),
          sueldoSugerido: cleanNum(p['Sueldo Sugerido (ARS)'] ?? p['Sueldo Sugerido'] ?? Object.values(p)[3]),
          costoFijo: cleanNum(p['Costo Fijo (ARS)'] ?? p['Costo Fijo'] ?? Object.values(p)[4])
        }));

        const clientesProcesados = clientes.map(c => {
          return c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0] ?? '';
        }).filter(Boolean);

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: clientesProcesados,
          config: configObj,
          eerrBase: eerrObj,
          eerrBaseNorm: eerrNorm,
          loading: false,
          error: null
        });

        setPctIndirectos(configObj['% Indirectos'] ?? configObj['Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? configObj['Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        if (preciosProcesados.length > 0) {
          setEscenarios([{
            id: Date.now(),
            cliente: clientesProcesados[0] || 'Nuevo Cliente',
            tipoIdx: 0,
            cantidad: 1,
            sueldoBruto: preciosProcesados[0].sueldoSugerido || 0,
            ventaUnit: preciosProcesados[0].valor || 0
          }]);
        } else {
          setEscenarios([]);
        }
      } catch (error) {
        console.error('Error cargando sheets', error);
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos desde Google Sheets.' }));
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_historial', JSON.stringify(historial));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, historial, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental]);

  const agregarFila = () => {
    if (dataSheets.loading) {
      alert('Aún cargando datos. Intentá de nuevo en un momento.');
      return;
    }
    const precioDefault = (dataSheets.preciosNuevos && dataSheets.preciosNuevos.length > 0)
      ? dataSheets.preciosNuevos[0]
      : { sueldoSugerido: 0, valor: 0, costoFijo: 0, categoria: 'Otros', tipo: 'Default' };

    setEscenarios(prev => ([
      ...prev,
      {
        id: Date.now(),
        cliente: (dataSheets.clientes && dataSheets.clientes[0]) || 'Nuevo Cliente',
        tipoIdx: 0,
        cantidad: 1,
        sueldoBruto: precioDefault.sueldoSugerido || 0,
        ventaUnit: precioDefault.valor || 0
      }
    ]));
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e };
      if (campo === 'ventaUnit' || campo === 'sueldoBruto') {
        const num = typeof valor === 'string' ? parseInt(valor.replace(/\D/g, '')) || 0 : Number(valor || 0);
        updated[campo] = num;
      } else if (campo === 'tipoIdx') {
        updated.tipoIdx = Number(valor) || 0;
        const p = dataSheets.preciosNuevos[Number(valor)];
        if (p) {
          updated.sueldoBruto = p.sueldoSugerido ?? 0;
          updated.ventaUnit = p.valor ?? 0;
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

  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    const porCliente = {};

    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      
      const ventaFila = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
      let costoTotalFila = 0;
      
      if ((p.categoria || '').toLowerCase().includes('staff')) {
        const sueldoTotal = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
        const costoLaboral = sueldoTotal * (pctCostoLaboral / 100);
        const indirectos = sueldoTotal * (pctIndirectos / 100);
        costoTotalFila = sueldoTotal + costoLaboral + indirectos;
      } else {
        const base = (Number(e.cantidad) || 0) * (Number(p.costoFijo) || 0);
        const indirectos = base * (pctIndirectos / 100);
        costoTotalFila = base + indirectos;
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
    const eerrNorm = dataSheets.eerrBaseNorm ?? {};

    const ingresoBase = tolerantGet(eerr, 'Ingreso') || tolerantGet(eerrNorm, normalizeKey('Ingreso')) || 0;
    const costoIngresoBase = tolerantGet(eerr, 'Costo de ingresos') || tolerantGet(eerrNorm, normalizeKey('Costo de ingresos')) || 0;
    const gananciaBrutaBase = tolerantGet(eerr, 'Ganancia bruta') || tolerantGet(eerrNorm, normalizeKey('Ganancia bruta')) || 0;
    const gastoOperacionBase = tolerantGet(eerr, 'Menos gasto de operación') || tolerantGet(eerrNorm, normalizeKey('Menos gasto de operación')) || 0;
    const otrosIngresosBase = tolerantGet(eerr, 'Más otros ingresos') || tolerantGet(eerrNorm, normalizeKey('Más otros ingresos')) || 0;
    const otrosGastosBase = tolerantGet(eerr, 'Menos gastos de otro tipo') || tolerantGet(eerrNorm, normalizeKey('Menos gastos de otro tipo')) || 0;
    const gananciaNetaBase = tolerantGet(eerr, 'Ganancia neta') || tolerantGet(eerrNorm, normalizeKey('Ganancia neta')) || 0;

    const ingresoTotal = ingresoBase + propuesta.ventasTotales;
    const costoIngresosTotal = costoIngresoBase + propuesta.costosTotales;
    const gananciaBrutaTotal = ingresoTotal - costoIngresosTotal;
    const gastoOperacionTotal = gastosOperativos || gastoOperacionBase;
    const ingresoOperacionTotal = gananciaBrutaTotal - gastoOperacionTotal;
    const otrosIngresosTotal = otrosIngresosBase;
    const otrosGastosTotal = otrosGastosBase;
    const gananciaNetaTotal = ingresoOperacionTotal + otrosIngresosTotal - otrosGastosTotal;

    return {
      ingresoBase,
      costoIngresoBase,
      gananciaBrutaBase,
      gastoOperacionBase,
      otrosIngresosBase,
      otrosGastosBase,
      gananciaNetaBase,
      ingresoTotal,
      costoIngresosTotal,
      gananciaBrutaTotal,
      gastoOperacionTotal,
      ingresoOperacionTotal,
      otrosIngresosTotal,
      otrosGastosTotal,
      gananciaNetaTotal,
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
    const ingreso = propuesta.ventasTotales;
    const costo = propuesta.costosTotales;
    const gananciaNeta = eerr.gananciaNetaTotal - (eerr.gananciaNetaBase || 0);
    return { ingreso, costo, gananciaNeta };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, dataSheets.eerrBase]);

  const guardarEscenario = () => {
    const nombre = window.prompt("Ingrese un nombre para este escenario:", `Escenario ${historial.length + 1}`);
    if (!nombre) return;
    const eerr = calcularEERRTotal();
    const timestamp = new Date().toLocaleString('es-AR');
    const nuevoHistorial = {
      id: Date.now(),
      nombre: nombre,
      fecha: timestamp,
      escenarios: JSON.parse(JSON.stringify(escenarios)),
      eerr: eerr,
      config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental }
    };
    setHistorial(prev => [nuevoHistorial, ...prev]);
    alert(`✅ Escenario "${nombre}" guardado.`);
  };

  const descargarPDF = () => {
    const eerr = calcularEERRTotal();
    const propuesta = eerr.propuesta;
    const timestamp = new Date().toLocaleString('es-AR');
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Horizon - Proyección</title><style>body { font-family: Arial, sans-serif; padding: 40px; } h1 { color: #7c3aed; } table { width: 100%; border-collapse: collapse; margin: 15px 0; } th, td { padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; }</style></head><body><h1>HORIZON - Proyectado 2026</h1><p>Generado: ${timestamp}</p><table><tr><td>Ingreso Total:</td><td>${format(eerr.ingresoTotal)}</td></tr><tr><td>Ganancia Neta:</td><td>${format(eerr.gananciaNetaTotal)}</td></tr></table></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Horizon_Proyeccion_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  const formatPct = (n) => `${n.toFixed(0)}%`;

  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = calcularTotalLineas(lineas);
    const pctCumplimiento = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const angle = -90 + (pctCumplimiento * 1.8);
    const getColor = () => {
      if (pctCumplimiento >= 100) return '#16a34a';
      if (pctCumplimiento >= 75) return '#eab308';
      if (pctCumplimiento >= 50) return '#f97316';
      return '#dc2626';
    };

    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color: color }}>{titulo}</h3>
        <div className="relative w-full flex justify-center mb-4">
          <svg viewBox="0 0 200 120" className="w-full max-w-xs">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={getColor()} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${(pctCumplimiento / 100) * 251.2} 251.2`} style={{ transition: 'all 0.5s ease' }} />
            <line x1="100" y1="100" x2="100" y2="30" stroke={getColor()} strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 0.5s ease' }} />
            <circle cx="100" cy="100" r="8" fill={getColor()} />
          </svg>
        </div>
        <div className="text-center mb-4">
          <p className="text-4xl font-black" style={{ color: getColor() }}>{pctCumplimiento.toFixed(1)}%</p>
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
                  <select value={linea.cliente} onChange={(e) => actualizarLineaVenta(tipo, linea.id, 'cliente', e.target.value)} className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none">
                    {dataSheets.clientes && dataSheets.clientes.length > 0 ? (
                      dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)
                    ) : (
                      <option value="">Cargando clientes...</option>
                    )}
                  </select>
                  <input type="text" value={linea.monto === '' ? '' : formatNum(linea.monto)} onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\s/g, '');
                      const num = raw === '' ? '' : parseFloat(raw) || 0;
                      actualizarLineaVenta(tipo, linea.id, 'monto', num);
                    }} className="w-32 bg-white border-2 border-blue-400 rounded px-2 py-1 text-xs font-bold text-blue-700 focus:outline-none" placeholder="0" />
                  {lineas.length > 1 && <button onClick={() => eliminarLineaVenta(tipo, linea.id)} className="text-slate-400 hover:text-red-500 text-sm font-bold">✕</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500 font-bold uppercase">Total Real:</span><span className="font-black text-blue-700">{format(calcularTotalLineas(lineas))}</span></div>
          </div>
        </div>
      </div>
    );
  };

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">SINCRONIZANDO CON HORIZON CLOUD...</div>;
  if (dataSheets.error) return <div className="p-20 text-center font-black text-red-600">{dataSheets.error}</div>;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2026</h1>
            <p className="text-slate-500 text-sm mt-1">Estado de Resultados Proyectado (Base Dic-25 + Propuesta)</p>
          </div>
          <div className="flex gap-3">
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
                <span className="text-[10px] font-bold text-purple-400 block uppercase">Gastos Op.</span>
                <input type="number" value={gastosOperativos} onChange={e => setGastosOperativos(cleanNum(e.target.value))} className="w-32 font-bold text-red-600 focus:outline-none text-xs" />
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
          </div>
        </div>

        {/* TABLA SIMULACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="font-bold text-slate-700 text-sm">💼 Simulación de Servicios (Propuesta)</h2>
            <div className="flex gap-2">
               <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className={`text-xs font-bold px-3 py-1 border rounded-lg transition ${mostrarHistorial ? 'bg-purple-600 text-white border-purple-600' : 'text-slate-600 border-purple-200 hover:text-purple-600'}`}>📋 Historial ({historial.length})</button>
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
                  <th className="p-4">Cliente</th><th className="p-4">Servicio</th><th className="p-4 text-center">Cant</th><th className="p-4 text-right">Venta Unit</th><th className="p-4 text-right">Sueldo Bruto</th><th className="p-4 text-right">Costo Total</th><th className="p-4 text-right">Resultado</th><th className="p-4 text-center">Margen</th><th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {escenarios.map(e => {
                  const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
                  const isStaff = p && (p.categoria || '').toLowerCase().includes('staff');
                  let costoTotal = 0;
                  if (p) {
                    if (isStaff) {
                      const sueldo = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
                      costoTotal = sueldo + (sueldo * pctCostoLaboral/100) + (sueldo * pctIndirectos/100);
                    } else {
                      const base = (Number(e.cantidad) || 0) * (Number(p.costoFijo) || 0);
                      costoTotal = base + (base * pctIndirectos/100);
                    }
                  }
                  const venta = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
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
                        <input type="text" value={(Number(e.ventaUnit) || 0).toLocaleString('es-AR')} onChange={(ev) => actualizarFila(e.id, 'ventaUnit', ev.target.value.replace(/\D/g, ''))} className="w-28 text-right bg-blue-50 text-blue-700 font-bold rounded px-2 border border-blue-200" />
                      </td>
                      <td className="p-4 text-right">
                        {isStaff ? (
                          <input type="text" value={(Number(e.sueldoBruto) || 0).toLocaleString('es-AR')} onChange={(ev) => actualizarFila(e.id, 'sueldoBruto', ev.target.value.replace(/\D/g, ''))} className="w-24 text-right bg-pink-50 text-pink-700 font-bold rounded px-2 border border-pink-200" />
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-4 text-right font-mono text-red-500 text-xs">-{format(costoTotal)}</td>
                      <td className="p-4 text-right font-bold text-green-600">{format(res)}</td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-black px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{mgn.toFixed(1)}%</span>
                      </td>
                      <td className="p-4 text-right"><button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORIAL */}
        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 text-sm">📋 Historial de Escenarios Guardados</h2>
              <button onClick={() => setMostrarHistorial(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cerrar</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historial.map(item => (
                <div key={item.id} className="border border-purple-100 rounded-lg p-4 hover:border-purple-400 transition bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-purple-700 text-sm uppercase truncate pr-2">{item.nombre}</h3>
                    <button onClick={() => setHistorial(prev => prev.filter(h => h.id !== item.id))} className="text-slate-300 hover:text-red-500">✕</button>
                  </div>
                  <button onClick={() => setEscenarios(JSON.parse(JSON.stringify(item.escenarios)))} className="w-full bg-purple-50 text-purple-700 py-2 rounded font-black text-[10px] uppercase hover:bg-purple-600 hover:text-white transition">Cargar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EERR COMPARATIVO */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <h2 className="font-bold text-sm">📊 Estado de Resultados Comparativo</h2>
            <button onClick={() => setMostrarEERR(!mostrarEERR)} className="bg-white/20 hover:bg-white/40 px-3 py-1 rounded text-[10px] font-black uppercase transition">{mostrarEERR ? '✕ Ocultar' : '👁️ Mostrar'}</button>
          </div>
          {mostrarEERR && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-purple-50 text-purple-600 font-bold uppercase text-[10px]">
                    <th className="p-3"></th><th className="p-3 text-right">EERR Dic-25</th><th className="p-3 text-right">Propuesta</th><th className="p-3 text-right">EERR Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-purple-50">
                    <td className="p-3 font-bold">Ingreso</td><td className="p-3 text-right font-mono">{format(tolerantGet(dataSheets.eerrBase, 'Ingreso'))}</td><td className="p-3 text-right font-mono text-green-700">{format(propuesta.ventasTotales)}</td><td className="p-3 text-right font-mono text-blue-700 font-bold">{format(eerr.ingresoTotal)}</td>
                  </tr>
                  <tr className="border-b border-purple-50 bg-gradient-to-r from-purple-100 to-pink-100 border-t-4 border-purple-400">
                    <td className="p-4 font-black text-slate-900">Ganancia neta</td><td className="p-4 text-right font-mono font-black">{format(tolerantGet(dataSheets.eerrBase, 'Ganancia neta'))}</td><td className="p-4 text-right font-mono font-black text-green-700">{format(propuesta.margenBruto)}</td><td className="p-4 text-right font-mono font-black text-blue-700">{format(eerr.gananciaNetaTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* APORTE POR CLIENTE (REINSTALADO CON VISUAL ANTERIOR) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 mb-6">
          <h3 className="text-xs font-bold text-blue-400 uppercase mb-4">Aporte por Cliente (Propuesta)</h3>
          <div className="space-y-4">
            {Object.entries(propuesta.porCliente).map(([nombre, datos]) => {
              const resultado = datos.ventas - datos.costos;
              const margen = (resultado / datos.ventas) * 100;
              return (
                <div key={nombre} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-700">{nombre}</span>
                    <span className="text-xs font-black text-green-600">{format(resultado)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                    <span>Venta: {format(datos.ventas)}</span>
                    <span>Margen: {margen.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${margen >= margenObjetivo ? 'bg-gradient-to-r from-green-400 to-emerald-500' : margen >= 15 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-red-400 to-pink-500'}`}
                      style={{ width: `${Math.min(100, margen * 2)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(propuesta.porCliente).length === 0 && (
              <p className="text-center text-slate-300 text-xs py-4 italic">Sin datos de simulación</p>
            )}
          </div>
        </div>

        {/* VELOCÍMETROS */}
        <div className="mb-6">
          <h2 className="text-lg font-black text-slate-700 uppercase mb-4">🎯 Objetivos 2026 - Tracking de Ventas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {renderVelocimetro("Objetivo Ventas Total 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
            {renderVelocimetro("Objetivo Renovación 2026", objRenovacion, lineasRenovacion, setLineasRenovacion, "renovacion", "#ec4899")}
            {renderVelocimetro("Objetivo Ventas Incremental 2026", objIncremental, lineasIncremental, setLineasIncremental, "incremental", "#3b82f6")}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

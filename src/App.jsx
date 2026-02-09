import React, { useState, useEffect, useMemo, useCallback } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

// --- LOGICA DE INFLACION (ANIDADA) ---
const annualToMonthly = (annualRate) => {
  if (!annualRate) return 0;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
};

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

  // Parámetros de Configuración
  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0); // Este actuará como el "Factor Carga Social"
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);

  // --- NUEVOS ESTADOS DE INFLACION ---
  const [inflacionAnnual, setInflacionAnnual] = useState(0.25); // 25% anual por defecto
  const [inflacionMonthly, setInflacionMonthly] = useState(annualToMonthly(0.25));

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

  // Sincronizar inflación mensual
  useEffect(() => {
    setInflacionMonthly(annualToMonthly(inflacionAnnual));
  }, [inflacionAnnual]);

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
              if (Array.isArray(dEsc)) escenariosParseados = dEsc;
              else if (typeof dEsc === 'string' && dEsc.trim() !== '') {
                try { escenariosParseados = JSON.parse(dEsc); } catch(e) { escenariosParseados = []; }
              }

              let configParseada = {};
              if (typeof conf === 'object' && conf !== null) configParseada = conf;
              else if (typeof conf === 'string' && conf.trim() !== '') {
                try { configParseada = JSON.parse(conf); } catch(e) { configParseada = {}; }
              }

              return {
                id: item[findKey(item, 'ID')] ? String(item[findKey(item, 'ID')]).replace(/'/g, "") : Date.now(),
                nombre: item[findKey(item, 'Nombre')] || "Sin nombre",
                fecha: item[findKey(item, 'Fecha')] || "",
                escenarios: escenariosParseados,
                config: configParseada
              };
            });
            
            setHistorial(historialSincronizado);
            const ultimo = historialSincronizado[historialSincronizado.length - 1];
            if (ultimo && Array.isArray(ultimo.escenarios) && ultimo.escenarios.length > 0) {
              setEscenarios(ultimo.escenarios);
              if (ultimo.config) {
                setPctIndirectos(ultimo.config.pctIndirectos ?? 37);
                setPctCostoLaboral(ultimo.config.pctCostoLaboral ?? 45);
                setGastosOperativos(ultimo.config.gastosOperativos ?? 46539684.59);
                setMargenObjetivo(ultimo.config.margenObjetivo ?? 25);
              }
            }
          }
        } catch(e) { console.error("Error nube:", e); }

        if (preciosProcesados.length > 0 && escenarios.length === 0) {
          setEscenarios([{
            id: Date.now(),
            cliente: clientesProcesados[0] || 'Nuevo Cliente',
            tipoIdx: 0,
            cantidad: 1,
            sueldoBruto: preciosProcesados[0].sueldoSugerido || 0,
            ventaUnit: preciosProcesados[0].valor || 0
          }]);
        }
        setIsReady(true);
      } catch (error) {
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos.' }));
        setIsReady(true);
      }
    };
    cargarDatos();
  }, []);

  // --- CÁLCULO CORE CON INFLACIÓN ---
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
        const sueldoBaseTotal = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
        
        // Aplicamos la lógica de inflación: (Sueldo * Factor Carga) * (1 + Inflación Mensual)
        const factorCarga = 1 + (pctCostoLaboral / 100);
        const factorInflacion = 1 + inflacionMonthly;
        const costoLaboralReal = sueldoBaseTotal * factorCarga * factorInflacion;
        
        const indirectos = sueldoBaseTotal * (pctIndirectos / 100);
        costoTotalFila = costoLaboralReal + indirectos;
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
      ingresoBase, costoIngresoBase, gananciaBrutaBase, gastoOperacionBase,
      otrosIngresosBase, otrosGastosBase, gananciaNetaBase,
      ingresoTotal, costoIngresosTotal, gananciaBrutaTotal,
      gastoOperacionTotal, ingresoOperacionTotal, otrosIngresosTotal,
      otrosGastosTotal, gananciaNetaTotal,
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
    return { 
      ingreso: propuesta.ventasTotales, 
      costo: propuesta.costosTotales, 
      gananciaNeta: eerr.gananciaNetaTotal - (eerr.gananciaNetaBase || 0) 
    };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, inflacionMonthly, dataSheets.eerrBase]);

  // Funciones de UI
  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  const formatPct = (n) => `${n.toFixed(1)}%`;

  const agregarFila = () => {
    const pDefault = dataSheets.preciosNuevos[0] || { sueldoSugerido: 0, valor: 0 };
    setEscenarios(prev => [...prev, {
      id: Date.now(),
      cliente: dataSheets.clientes[0] || 'Cliente',
      tipoIdx: 0,
      cantidad: 1,
      sueldoBruto: pDefault.sueldoSugerido,
      ventaUnit: pDefault.valor
    }]);
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const u = { ...e };
      if (campo === 'tipoIdx') {
        u.tipoIdx = Number(valor);
        const p = dataSheets.preciosNuevos[u.tipoIdx];
        u.sueldoBruto = p.sueldoSugerido;
        u.ventaUnit = p.valor;
      } else if (['ventaUnit', 'sueldoBruto', 'cantidad'].includes(campo)) {
        u[campo] = cleanNum(valor);
      } else {
        u[campo] = valor;
      }
      return u;
    }));
  };

  const guardarEscenario = async () => {
    const nombre = window.prompt("Nombre del escenario:");
    if (!nombre) return;
    const registro = {
      id: Date.now(), nombre, fecha: new Date().toLocaleString(),
      escenarios, config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, inflacionAnnual }
    };
    try {
      const p = new URLSearchParams();
      p.append('payload', JSON.stringify(registro));
      p.append('sheet', 'HistorialCompartido');
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
      setHistorial(prev => [registro, ...prev]);
      alert("Sincronizado");
    } catch(e) { alert("Error"); }
  };

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">CARGANDO ENGINE...</div>;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER CON INFLACIÓN INTEGRADA */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine</h1>
            <p className="text-slate-500 text-sm">Simulador con Inflación y Cargas Sociales</p>
          </div>
          
          <div className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-purple-100">
             <div className="px-3 border-r">
                <span className="text-[10px] font-bold text-red-400 block uppercase">Inflación Anual</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={inflacionAnnual * 100} 
                    onChange={e => setInflacionAnnual(Number(e.target.value) / 100)} 
                    className="w-12 font-bold text-red-600 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-red-600">%</span>
                </div>
                <span className="text-[9px] text-slate-400">Mensual: {formatPct(inflacionMonthly * 100)}</span>
             </div>
             <div className="px-3 border-r">
                <span className="text-[10px] font-bold text-pink-400 block uppercase">Carga Social</span>
                <input type="number" value={pctCostoLaboral} onChange={e => setPctCostoLaboral(Number(e.target.value))} className="w-10 font-bold text-pink-600 focus:outline-none" />%
             </div>
             <div className="px-3">
                <span className="text-[10px] font-bold text-blue-400 block uppercase">Indirectos</span>
                <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(Number(e.target.value))} className="w-10 font-bold text-blue-600 focus:outline-none" />%
             </div>
          </div>
        </div>

        {/* TABLA DE SIMULACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-4 border-b flex justify-between items-center bg-purple-50/50">
            <h2 className="font-bold text-slate-700 text-sm uppercase">🚀 Simulación de Escenarios</h2>
            <div className="flex gap-2">
               <button onClick={guardarEscenario} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Guardar</button>
               <button onClick={agregarFila} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">+ Agregar</button>
            </div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                <th className="p-4">Cliente</th>
                <th className="p-4">Servicio</th>
                <th className="p-4 text-center">Cant</th>
                <th className="p-4 text-right">Venta Unit</th>
                <th className="p-4 text-right">Sueldo Bruto</th>
                <th className="p-4 text-right">Costo Real (Inc. Infla)</th>
                <th className="p-4 text-right">Margen</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx] || {};
                const isStaff = (p.categoria || '').toLowerCase().includes('staff');
                
                // Cálculo de fila para la UI
                const factorCarga = 1 + (pctCostoLaboral / 100);
                const factorInflacion = 1 + inflacionMonthly;
                const costoLaboralReal = isStaff ? (e.sueldoBruto * e.cantidad * factorCarga * factorInflacion) : 0;
                const costoFijoReal = !isStaff ? (p.costoFijo * e.cantidad) : 0;
                const indirectosFila = (isStaff ? (e.sueldoBruto * e.cantidad) : costoFijoReal) * (pctIndirectos / 100);
                const costoTotalFila = (isStaff ? costoLaboralReal : costoFijoReal) + indirectosFila;
                
                const ventaFila = e.ventaUnit * e.cantidad;
                const resFila = ventaFila - costoTotalFila;
                const mgnFila = ventaFila > 0 ? (resFila / ventaFila) * 100 : 0;

                return (
                  <tr key={e.id} className="border-t hover:bg-slate-50 transition">
                    <td className="p-4">
                      <select value={e.cliente} onChange={ev => actualizarFila(e.id, 'cliente', ev.target.value)} className="bg-transparent font-medium">
                        {dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={e.tipoIdx} onChange={ev => actualizarFila(e.id, 'tipoIdx', ev.target.value)} className="text-xs text-purple-600 font-bold">
                        {dataSheets.preciosNuevos.map((pn, i) => <option key={i} value={i}>{pn.categoria} - {pn.tipo}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" value={e.cantidad} onChange={ev => actualizarFila(e.id, 'cantidad', ev.target.value)} className="w-8 text-center font-bold" />
                    </td>
                    <td className="p-4 text-right">
                      <input type="text" value={formatNum(e.ventaUnit)} onChange={ev => actualizarFila(e.id, 'ventaUnit', ev.target.value)} className="w-24 text-right font-bold text-blue-600 bg-blue-50 rounded px-1" />
                    </td>
                    <td className="p-4 text-right">
                      {isStaff ? (
                        <input type="text" value={formatNum(e.sueldoBruto)} onChange={ev => actualizarFila(e.id, 'sueldoBruto', ev.target.value)} className="w-24 text-right font-bold text-pink-600 bg-pink-50 rounded px-1" />
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="p-4 text-right font-mono text-red-500 text-xs">-{format(costoTotalFila)}</td>
                    <td className="p-4 text-right font-black text-green-600">{formatPct(mgnFila)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ESTADO DE RESULTADOS COMPARATIVO */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 bg-purple-600 text-white font-bold text-sm uppercase">📊 Impacto en Estado de Resultados (Con Inflación)</div>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-purple-50 text-purple-600 font-bold">
                <th className="p-3">Concepto</th>
                <th className="p-3 text-right">Base Dic-25</th>
                <th className="p-3 text-right bg-green-50">Propuesta + Inflación</th>
                <th className="p-3 text-right bg-blue-50 text-blue-700 font-black">Total Proyectado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3 font-bold">Ingresos</td>
                <td className="p-3 text-right">{format(eerr.ingresoBase)}</td>
                <td className="p-3 text-right text-green-600 font-bold">+{format(propuesta.ventasTotales)}</td>
                <td className="p-3 text-right font-bold">{format(eerr.ingresoTotal)}</td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-bold">Costos Operativos</td>
                <td className="p-3 text-right">{format(eerr.costoIngresoBase)}</td>
                <td className="p-3 text-right text-red-500 font-bold">-{format(propuesta.costosTotales)}</td>
                <td className="p-3 text-right font-bold">{format(eerr.costoIngresosTotal)}</td>
              </tr>
              <tr className="border-t bg-slate-50">
                <td className="p-3 font-black uppercase">Ganancia Neta Final</td>
                <td className="p-3 text-right font-bold">{format(eerr.gananciaNetaBase)}</td>
                <td className="p-3 text-right text-green-600 font-bold">+{format(desvioVsBase.gananciaNeta)}</td>
                <td className="p-3 text-right font-black text-blue-700 text-sm">{format(eerr.gananciaNetaTotal)}</td>
              </tr>
            </tbody>
          </table>
          <div className="p-4 bg-blue-700 text-white flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest">Margen Neto Proyectado</span>
            <span className="text-2xl font-black">{formatPct(eerr.margenNetoPct)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;

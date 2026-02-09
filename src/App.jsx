import React, { useState, useEffect, useMemo } from 'react';

const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

// --- NUEVA LÓGICA DE INFLACIÓN (HELPER) ---
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

  const [pctIndirectos, setPctIndirectos] = useState(0);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(0);
  const [gastosOperativos, setGastosOperativos] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0);

  // --- NUEVO ESTADO DE INFLACIÓN ---
  const [inflacionAnual, setInflacionAnual] = useState(20); // 20% por defecto
  const inflacionMensual = useMemo(() => annualToMonthly(inflacionAnual / 100), [inflacionAnual]);

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
                if(ultimo.config.inflacionAnual) setInflacionAnual(ultimo.config.inflacionAnual);
              }
            }
          }
        } catch(e) { console.error("Error nube:", e); }

        if (preciosProcesados.length > 0 && escenarios.length === 0) {
          setEscenarios([{ id: Date.now(), cliente: clientesProcesados[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: preciosProcesados[0].sueldoSugerido || 0, ventaUnit: preciosProcesados[0].valor || 0 }]);
        }
        setIsReady(true);
      } catch (error) {
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos.' }));
        setIsReady(true);
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!isReady || isLoadingFromCloud) return;
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental, isReady, isLoadingFromCloud]);

  const agregarFila = () => {
    if (dataSheets.loading) return;
    const precioDefault = dataSheets.preciosNuevos[0] || { sueldoSugerido: 0, valor: 0 };
    setEscenarios(prev => ([...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: precioDefault.sueldoSugerido || 0, ventaUnit: precioDefault.valor || 0 }]));
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
      } else if (campo === 'cantidad') updated.cantidad = Number(valor);
      else if (campo === 'cliente') updated.cliente = valor;
      return updated;
    }));
  };

  // --- LÓGICA DE CÁLCULO ACTUALIZADA CON INFLACIÓN ---
  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    const porCliente = {};
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const ventaFila = e.cantidad * e.ventaUnit;
      let costoTotalFila = 0;
      if ((p.categoria || '').toLowerCase().includes('staff')) {
        const sueldoTotal = e.cantidad * e.sueldoBruto;
        // Integración de la lógica nueva: (Sueldo * Factor Carga) * (1 + Inflación Mensual)
        const factorCarga = 1 + (pctCostoLaboral / 100);
        const factorInflacion = 1 + inflacionMensual;
        const costoLaboralConInflacion = sueldoTotal * factorCarga * factorInflacion;
        const indirectos = sueldoTotal * (pctIndirectos / 100);
        costoTotalFila = costoLaboralConInflacion + indirectos;
      } else {
        const base = e.cantidad * p.costoFijo;
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
    const gananciaNetaBase = tolerantGet(eerr, 'Ganancia neta') || tolerantGet(eerrNorm, normalizeKey('Ganancia neta')) || 0;

    const ingresoTotal = ingresoBase + propuesta.ventasTotales;
    const costoIngresosTotal = costoIngresoBase + propuesta.costosTotales;
    const gananciaBrutaTotal = ingresoTotal - costoIngresosTotal;
    const gastoOperacionTotal = gastosOperativos || gastoOperacionBase;
    const gananciaNetaTotal = (gananciaBrutaTotal - gastoOperacionTotal) + (tolerantGet(eerr, 'Más otros ingresos') || 0) - (tolerantGet(eerr, 'Menos gastos de otro tipo') || 0);

    return { 
      ingresoBase, costoIngresoBase, gananciaBrutaBase, gananciaNetaBase,
      ingresoTotal, costoIngresosTotal, gananciaBrutaTotal, gastoOperacionTotal, gananciaNetaTotal,
      margenBrutoPct: ingresoTotal > 0 ? (gananciaBrutaTotal / ingresoTotal) * 100 : 0,
      margenNetoPct: ingresoTotal > 0 ? (gananciaNetaTotal / ingresoTotal) * 100 : 0,
      desvioGananciaNeta: gananciaNetaTotal - gananciaNetaBase,
      propuesta 
    };
  };

  const desvioVsBase = useMemo(() => {
    const p = calcularPropuesta();
    const e = calcularEERRTotal();
    return { ingreso: p.ventasTotales, costo: p.costosTotales, gananciaNeta: e.desvioGananciaNeta };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, inflacionAnual]);

  const guardarEscenario = async () => {
    const nombre = window.prompt("Nombre del escenario:");
    if (!nombre) return;
    const registro = { id: Date.now(), nombre, fecha: new Date().toLocaleString(), escenarios, config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, inflacionAnual } };
    try {
      const p = new URLSearchParams(); p.append('payload', JSON.stringify(registro)); p.append('sheet', 'HistorialCompartido');
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p });
      setHistorial(prev => [registro, ...prev]); alert("Sincronizado");
    } catch(e) { alert("Error"); }
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);

  const renderVelocimetro = (titulo, objetivo, lineas, setLineas, tipo, color) => {
    const totalReal = lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);
    const pct = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-purple-200 p-6 flex-1">
        <h3 className="text-sm font-black text-center mb-2 uppercase" style={{ color }}>{titulo}</h3>
        <div className="text-center mb-4"><p className="text-4xl font-black" style={{ color }}>{pct.toFixed(1)}%</p></div>
        <div className="space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg">
          <div><label className="text-[10px] font-bold text-purple-600 block uppercase mb-1">Objetivo 2026</label><div className="bg-white border rounded px-3 py-2 text-sm font-bold">{formatNum(objetivo)}</div></div>
          <div><div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold text-blue-600 uppercase">Ventas</label><button onClick={() => setLineas(p => [...p, {id:Date.now(), cliente:'', monto:''}])} className="text-blue-600 font-black">+</button></div>
            <div className="space-y-2">{lineas.map(l => (
              <div key={l.id} className="flex gap-2">
                <input type="text" value={l.cliente} onChange={e => setLineas(prev => prev.map(x => x.id === l.id ? {...x, cliente: e.target.value} : x))} className="flex-1 text-xs border rounded px-2" placeholder="Cliente" />
                <input type="text" value={l.monto === '' ? '' : formatNum(l.monto)} onChange={e => {
                  const val = e.target.value.replace(/\./g, '');
                  setLineas(prev => prev.map(x => x.id === l.id ? {...x, monto: val === '' ? '' : parseFloat(val) || 0} : x));
                }} className="w-24 text-xs border rounded px-2 font-bold" placeholder="0" />
              </div>
            ))}</div>
          </div>
          <div className="pt-2 border-t font-bold text-xs flex justify-between"><span>TOTAL REAL:</span><span>{format(totalReal)}</span></div>
        </div>
      </div>
    );
  };

  const eerr = calcularEERRTotal();
  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">CARGANDO ENGINE...</div>;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent uppercase">Horizon Finance Engine 2026</h1>
            <p className="text-slate-500 text-sm mt-1">Simulación con Inflación Proyectada</p>
          </div>
          <div className="flex gap-3">
             {/* --- NUEVO INPUT DE INFLACIÓN EN EL HEADER --- */}
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-red-100">
                <span className="text-[10px] font-bold text-red-400 block uppercase">Inflación Anual</span>
                <input type="number" value={inflacionAnual} onChange={e => setInflacionAnual(Number(e.target.value))} className="w-12 font-bold text-red-600 focus:outline-none" />%
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-100">
                <span className="text-[10px] font-bold text-blue-400 block uppercase">Indirectos</span>
                <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(Number(e.target.value))} className="w-12 font-bold text-blue-600 focus:outline-none" />%
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-pink-100">
                <span className="text-[10px] font-bold text-pink-400 block uppercase">Costo Lab.</span>
                <input type="number" value={pctCostoLaboral} onChange={e => setPctCostoLaboral(Number(e.target.value))} className="w-12 font-bold text-pink-600 focus:outline-none" />%
             </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-4 border-b flex justify-between bg-purple-50/50">
            <h2 className="font-bold text-slate-700 text-sm">💼 Servicios de la Propuesta</h2>
            <div className="flex gap-2">
              <button onClick={guardarEscenario} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Guardar</button>
              <button onClick={agregarFila} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">+ Agregar</button>
            </div>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                <th className="p-4">Cliente</th><th className="p-4">Servicio</th><th className="p-4 text-center">Cant</th><th className="p-4 text-right">Venta Unit</th><th className="p-4 text-right">Sueldo Bruto</th><th className="p-4 text-right">Costo Total</th><th className="p-4 text-right">Resultado</th><th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx] || {};
                const isStaff = (p.categoria || '').toLowerCase().includes('staff');
                const sueldoBase = e.cantidad * e.sueldoBruto;
                const costFila = isStaff ? (sueldoBase * (1 + pctCostoLaboral/100) * (1 + inflacionMensual) + sueldoBase * (pctIndirectos/100)) : (e.cantidad * p.costoFijo * (1 + pctIndirectos/100));
                const ventFila = e.cantidad * e.ventaUnit;
                return (
                  <tr key={e.id} className="border-t text-sm hover:bg-slate-50">
                    <td className="p-4">
                      <select value={e.cliente} onChange={ev => actualizarFila(e.id, 'cliente', ev.target.value)} className="bg-transparent font-medium">
                        {dataSheets.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={e.tipoIdx} onChange={ev => actualizarFila(e.id, 'tipoIdx', ev.target.value)} className="text-xs font-bold text-purple-600">
                        {dataSheets.preciosNuevos.map((pn, i) => <option key={i} value={i}>{pn.categoria} - {pn.tipo}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-center"><input type="number" value={e.cantidad} onChange={ev => actualizarFila(e.id, 'cantidad', ev.target.value)} className="w-10 border rounded text-center" /></td>
                    <td className="p-4 text-right"><input type="text" value={formatNum(e.ventaUnit)} onChange={ev => actualizarFila(e.id, 'ventaUnit', ev.target.value)} className="w-24 text-right bg-blue-50 font-bold" /></td>
                    <td className="p-4 text-right">
                      {isStaff ? <input type="text" value={formatNum(e.sueldoBruto)} onChange={ev => actualizarFila(e.id, 'sueldoBruto', ev.target.value)} className="w-24 text-right bg-pink-50 font-bold" /> : '-'}
                    </td>
                    <td className="p-4 text-right text-red-500 font-mono text-xs">-{format(costFila)}</td>
                    <td className="p-4 text-right font-black text-green-600">{format(ventFila - costFila)}</td>
                    <td className="p-4"><button onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} className="text-slate-300">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 bg-purple-600 text-white font-black text-sm uppercase">Estado de Resultados Proyectado (Inc. Inflación)</div>
          <div className="p-6 grid grid-cols-3 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingreso Total</p>
              <p className="text-3xl font-black text-blue-700">{format(eerr.ingresoTotal)}</p>
              <p className="text-xs text-green-600 font-bold">+{format(desvioVsBase.ingreso)} vs Base</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ganancia Neta</p>
              <p className="text-3xl font-black text-purple-700">{format(eerr.gananciaNetaTotal)}</p>
              <p className="text-xs font-bold" style={{color: desvioVsBase.gananciaNeta >= 0 ? '#16a34a' : '#dc2626'}}>
                {desvioVsBase.gananciaNeta >= 0 ? '+' : ''}{format(desvioVsBase.gananciaNeta)} vs Base
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Margen Neto</p>
              <p className="text-3xl font-black text-slate-800">{eerr.margenNetoPct.toFixed(1)}%</p>
              <div className="w-full bg-slate-100 h-2 rounded-full"><div className="bg-purple-600 h-2 rounded-full" style={{width: `${Math.min(eerr.margenNetoPct, 100)}%`}}></div></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12">
          {renderVelocimetro("Ventas Totales 2026", objVentasTotal, lineasVentaTotal, setLineasVentaTotal, "total", "#7c3aed")}
          {renderVelocimetro("Renovación 2026", objRenovacion, lineasRenovacion, setLineasRenovacion, "renovacion", "#ec4899")}
          {renderVelocimetro("Incremental 2026", objIncremental, lineasIncremental, setLineasIncremental, "incremental", "#3b82f6")}
        </div>
      </div>
    </div>
  );
}

export default App;

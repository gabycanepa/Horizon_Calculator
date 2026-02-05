import React, { useState, useEffect, useMemo } from 'react';

function App() {
  // 1. TABLA DE PRECIOS FIJOS (NUEVOS)
  const preciosNuevos = [
    { categoria: 'Staff Augmentation', tipo: 'Analista Jr', valor: 6000000, sueldoSugerido: 2500000 },
    { categoria: 'Staff Augmentation', tipo: 'Analista SSR', valor: 7000000, sueldoSugerido: 3000000 },
    { categoria: 'Staff Augmentation', tipo: 'Analista SR', valor: 7500000, sueldoSugerido: 3500000 },
    { categoria: 'Staff Augmentation', tipo: 'Team Leader', valor: 8500000, sueldoSugerido: 4000000 },
    { categoria: 'Staff Augmentation', tipo: 'Jefe', valor: 10000000, sueldoSugerido: 5000000 },
    { categoria: 'Staff Augmentation', tipo: 'Gerente', valor: 14000000, sueldoSugerido: 7000000 },
    { categoria: 'Staff Augmentation', tipo: 'Project Manager', valor: 10000000, sueldoSugerido: 5000000 },
    { categoria: 'Staff Augmentation', tipo: 'Scrum Master', valor: 8000000, sueldoSugerido: 4000000 },
    { categoria: 'Workshop', tipo: 'Workshop', valor: 5500000, costoFijo: 2200000 },
    { categoria: 'Coaching', tipo: 'Coaching', valor: 3000000, costoFijo: 1200000 },
    { categoria: 'Programas', tipo: 'Programa de..', valor: 7000000, costoFijo: 2800000 }
  ];

  const clientesDisponibles = ['Arcos Dorados', 'Unilever', 'Macro', 'Nuevo Cliente'];

  // 2. ESTADOS CON CARGA INICIAL DESDE LOCALSTORAGE
  const [eerrBase] = useState({
    ingreso: 116791002.48,
    costoIngresos: 59212837.65,
    gananciaBruta: 57578164.83,
    gastoOperacion: 46539684.59,
    ingresoOperacion: 11038480.24,
    otrosIngresos: 2376982.05,
    otrosGastos: 0,
    gananciaNeta: 13415462.29
  });

  const [margenObjetivo, setMargenObjetivo] = useState(() => Number(localStorage.getItem('hzn_margenObj')) || 25);
  const [pctIndirectos, setPctIndirectos] = useState(() => Number(localStorage.getItem('hzn_pctInd')) || 37);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(() => Number(localStorage.getItem('hzn_pctLab')) || 45);
  const [gastosOperativos, setGastosOperativos] = useState(() => Number(localStorage.getItem('hzn_gastosOp')) || 46539684.59);

  const [escenarios, setEscenarios] = useState(() => {
    const saved = localStorage.getItem('hzn_escenarios');
    return saved ? JSON.parse(saved) : [{ id: 1, cliente: 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: 2500000, ventaUnit: 6000000 }];
  });

  const [historial, setHistorial] = useState(() => {
    const saved = localStorage.getItem('hzn_historial');
    return saved ? JSON.parse(saved) : [];
  });

  // Velocímetros
  const [objVentasTotal] = useState(2195176117);
  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasVenta')) || [{ id: 1, cliente: 'Arcos Dorados', monto: '' }]);
  const [objRenovacion] = useState(1225673502);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasReno')) || [{ id: 1, cliente: 'Arcos Dorados', monto: '' }]);
  const [objIncremental] = useState(969002614);
  const [lineasIncremental, setLineasIncremental] = useState(() => JSON.parse(localStorage.getItem('hzn_lineasIncr')) || [{ id: 1, cliente: 'Nuevo Cliente', monto: '' }]);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEERR, setMostrarEERR] = useState(true);

  // 3. EFECTO PARA GUARDAR AUTOMÁTICAMENTE
  useEffect(() => {
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_historial', JSON.stringify(historial));
    localStorage.setItem('hzn_margenObj', margenObjetivo);
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_lineasVenta', JSON.stringify(lineasVentaTotal));
    localStorage.setItem('hzn_lineasReno', JSON.stringify(lineasRenovacion));
    localStorage.setItem('hzn_lineasIncr', JSON.stringify(lineasIncremental));
  }, [escenarios, historial, margenObjetivo, pctIndirectos, pctCostoLaboral, gastosOperativos, lineasVentaTotal, lineasRenovacion, lineasIncremental]);

  // FUNCIONES DE LÓGICA
  const agregarFila = () => {
    setEscenarios([...escenarios, { 
      id: Date.now(), 
      cliente: 'Nuevo Cliente', 
      tipoIdx: 0, 
      cantidad: 1,
      sueldoBruto: 2500000,
      ventaUnit: 6000000
    }]);
  };

  const actualizarFila = (id, campo, valor) => {
    setEscenarios(escenarios.map(e => {
      if (e.id === id) {
        const updated = { ...e };
        if (campo === 'ventaUnit' || campo === 'sueldoBruto') {
          // Parse string with thousands separators to number
          const num = typeof valor === 'string' ? parseInt(valor.replace(/\D/g, '')) || 0 : valor;
          updated[campo] = num;
        } else if (campo === 'tipoIdx') {
          updated.tipoIdx = valor;
          const p = preciosNuevos[valor];
          updated.sueldoBruto = p.sueldoSugerido || 0;
          updated.ventaUnit = p.valor;
        } else if (campo === 'cantidad') {
          updated.cantidad = valor;
        } else if (campo === 'cliente') {
          updated.cliente = valor;
        }
        return updated;
      }
      return e;
    }));
  };

  const agregarLineaVenta = (tipo) => {
    const nuevaLinea = { id: Date.now(), cliente: 'Nuevo Cliente', monto: '' };
    if (tipo === 'total') setLineasVentaTotal([...lineasVentaTotal, nuevaLinea]);
    if (tipo === 'renovacion') setLineasRenovacion([...lineasRenovacion, nuevaLinea]);
    if (tipo === 'incremental') setLineasIncremental([...lineasIncremental, nuevaLinea]);
  };

  const actualizarLineaVenta = (tipo, id, campo, valor) => {
    const actualizar = (lineas) => lineas.map(l => l.id === id ? { ...l, [campo]: valor } : l);
    if (tipo === 'total') setLineasVentaTotal(actualizar(lineasVentaTotal));
    if (tipo === 'renovacion') setLineasRenovacion(actualizar(lineasRenovacion));
    if (tipo === 'incremental') setLineasIncremental(actualizar(lineasIncremental));
  };

  const eliminarLineaVenta = (tipo, id) => {
    if (tipo === 'total' && lineasVentaTotal.length > 1) setLineasVentaTotal(lineasVentaTotal.filter(l => l.id !== id));
    if (tipo === 'renovacion' && lineasRenovacion.length > 1) setLineasRenovacion(lineasRenovacion.filter(l => l.id !== id));
    if (tipo === 'incremental' && lineasIncremental.length > 1) setLineasIncremental(lineasIncremental.filter(l => l.id !== id));
  };

  const calcularTotalLineas = (lineas) => lineas.reduce((sum, l) => sum + (parseFloat(l.monto) || 0), 0);

  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    escenarios.forEach(e => {
      const p = preciosNuevos[e.tipoIdx];
      const v = e.cantidad * e.ventaUnit;
      let costoTotalFila = 0;
      if (p.categoria === 'Staff Augmentation') {
        const sueldoTotal = e.cantidad * e.sueldoBruto;
        const costoLaboral = sueldoTotal * (pctCostoLaboral / 100);
        const indirectos = sueldoTotal * (pctIndirectos / 100);
        costoTotalFila = sueldoTotal + costoLaboral + indirectos;
      } else {
        const base = e.cantidad * p.costoFijo;
        const indirectos = base * (pctIndirectos / 100);
        costoTotalFila = base + indirectos;
      }
      ventasTotales += v;
      costosTotales += costoTotalFila;
    });
    const margenBruto = ventasTotales - costosTotales;
    const margenBrutoPct = ventasTotales > 0 ? (margenBruto / ventasTotales) * 100 : 0;
    return { ventasTotales, costosTotales, margenBruto, margenBrutoPct };
  };

  const calcularEERRTotal = () => {
    const propuesta = calcularPropuesta();
    const ingresoTotal = eerrBase.ingreso + propuesta.ventasTotales;
    const costoIngresosTotal = eerrBase.costoIngresos + propuesta.costosTotales;
    const gananciaBrutaTotal = ingresoTotal - costoIngresosTotal;
    const gastoOperacionTotal = gastosOperativos;
    const ingresoOperacionTotal = gananciaBrutaTotal - gastoOperacionTotal;
    const otrosIngresosTotal = eerrBase.otrosIngresos;
    const otrosGastosTotal = eerrBase.otrosGastos;
    const gananciaNetaTotal = ingresoOperacionTotal + otrosIngresosTotal - otrosGastosTotal;

    return {
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
      desvioGananciaNeta: gananciaNetaTotal - eerrBase.gananciaNeta,
      propuesta
    };
  };

  // NUEVO: Cálculo del aporte por cliente (resumen agrupado)
  const aportePorCliente = useMemo(() => {
    const resumen = {};
    escenarios.forEach(e => {
      const p = preciosNuevos[e.tipoIdx];
      const isStaff = p.categoria === 'Staff Augmentation';
      const venta = e.cantidad * e.ventaUnit;
      let costoTotal = 0;
      if (isStaff) {
        const sueldo = e.cantidad * e.sueldoBruto;
        costoTotal = sueldo + (sueldo * pctCostoLaboral / 100) + (sueldo * pctIndirectos / 100);
      } else {
        const base = e.cantidad * p.costoFijo;
        costoTotal = base + (base * pctIndirectos / 100);
      }
      const resultado = venta - costoTotal;
      const margen = venta > 0 ? (resultado / venta) * 100 : 0;

      if (!resumen[e.cliente]) {
        resumen[e.cliente] = { venta: 0, costo: 0, resultado: 0, margen: 0 };
      }
      resumen[e.cliente].venta += venta;
      resumen[e.cliente].costo += costoTotal;
      resumen[e.cliente].resultado += resultado;
    });

    // Calcular margen % por cliente
    Object.keys(resumen).forEach(cliente => {
      const r = resumen[cliente];
      r.margen = r.venta > 0 ? (r.resultado / r.venta) * 100 : 0;
    });

    return resumen;
  }, [escenarios, pctCostoLaboral, pctIndirectos, preciosNuevos]);

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
    setHistorial([nuevoHistorial, ...historial]);
    alert(`✅ Escenario "${nombre}" guardado.`);
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
                    {clientesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" value={linea.monto === '' ? '' : formatNum(linea.monto)} onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '');
                      const num = raw === '' ? '' : parseFloat(raw) || '';
                      actualizarLineaVenta(tipo, linea.id, 'monto', num);
                    }} className="w-32 bg-white border-2 border-blue-400 rounded px-2 py-1 text-xs font-bold text-blue-700 focus:outline-none" placeholder="0" />
                  {lineas.length > 1 && <button onClick={() => eliminarLineaVenta(tipo, linea.id)} className="text-slate-400 hover:text-red-500 text-sm font-bold">✕</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500 font-bold uppercase">Total Real:</span><span className="font-black text-blue-700">{format(totalReal)}</span></div>
          </div>
        </div>
      </div>
    );
  };

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  // NUEVO: Cálculo del desvío vs base dic-25
  const desvioVsBase = useMemo(() => {
    const ingreso = propuesta.ventasTotales;
    const costo = propuesta.costosTotales;
    const gananciaNeta = eerr.gananciaNetaTotal - eerrBase.gananciaNeta;
    return { ingreso, costo, gananciaNeta };
  }, [propuesta, eerr, eerrBase]);

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
                <input type="number" value={gastosOperativos} onChange={e => setGastosOperativos(parseFloat(e.target.value))} className="w-32 font-bold text-red-600 focus:outline-none text-xs" />
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-100">
                <span className="text-[10px] font-bold text-blue-400 block uppercase">Indirectos</span>
                <input type="number" value={pctIndirectos} onChange={e => setPctIndirectos(parseFloat(e.target.value))} className="w-16 font-bold text-blue-600 focus:outline-none" />%
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-pink-100">
                <span className="text-[10px] font-bold text-pink-400 block uppercase">Costo Lab.</span>
                <input type="number" value={pctCostoLaboral} onChange={e => setPctCostoLaboral(parseFloat(e.target.value))} className="w-16 font-bold text-pink-600 focus:outline-none" />%
             </div>
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
                <span className="text-[10px] font-bold text-purple-400 block uppercase">Margen Obj.</span>
                <input type="number" value={margenObjetivo} onChange={e => setMargenObjetivo(parseFloat(e.target.value))} className="w-16 font-bold text-purple-600 focus:outline-none" />%
             </div>
          </div>
        </div>

        {/* DESVÍO VS BASE DIC-25 */}
        <div className="bg-purple-100 rounded-xl shadow-lg border border-purple-400 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="text-purple-900 font-black uppercase text-sm">DESVÍO VS BASE DIC-25</div>
            <div className="text-right font-black text-lg text-purple-900">MARGEN NETO TOTAL <br /> <span className="text-3xl">{desvioVsBase.gananciaNeta > 0 ? '+' : ''}{((eerr.margenNetoPct) || 0).toFixed(1)}%</span></div>
          </div>
          <div className="mt-4 flex gap-6 text-sm font-bold">
            <div className="text-green-700">Ingreso: +{format(desvioVsBase.ingreso)}</div>
            <div className="text-red-600">Costo: +{format(desvioVsBase.costo)}</div>
            <div className="text-green-700">Ganancia Neta: +{format(desvioVsBase.gananciaNeta)}</div>
          </div>
        </div>

        {/* APORTE POR CLIENTE */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden mb-6 p-4">
          <h2 className="font-bold text-blue-700 text-sm mb-4 uppercase">Aporte por Cliente (Propuesta)</h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-blue-50 text-blue-600 font-bold uppercase text-[10px]">
                <th className="p-3 border border-blue-200">Cliente</th>
                <th className="p-3 border border-blue-200 text-right">Venta Total</th>
                <th className="p-3 border border-blue-200 text-right">Costo Total</th>
                <th className="p-3 border border-blue-200 text-right">Resultado</th>
                <th className="p-3 border border-blue-200 text-right">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(aportePorCliente).map(([cliente, datos]) => (
                <tr key={cliente} className="border-b border-blue-100 hover:bg-blue-50/30">
                  <td className="p-3 font-bold text-blue-700">{cliente}</td>
                  <td className="p-3 text-right font-mono">{format(datos.venta)}</td>
                  <td className="p-3 text-right font-mono text-red-600">{format(datos.costo)}</td>
                  <td className="p-3 text-right font-bold text-green-600">{format(datos.resultado)}</td>
                  <td className={`p-3 text-right font-black text-[10px] px-2 py-1 rounded ${
                    datos.margen >= margenObjetivo ? 'bg-green-100 text-green-700' :
                    datos.margen >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {datos.margen.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABLA SIMULACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          {/* ... tu tabla simulación ... */}
          {/* (Aquí va el código de la tabla simulación que ya tienes) */}
        </div>

        {/* HISTORIAL DE ESCENARIOS */}
        {/* ... */}

        {/* EERR COMPARATIVO CON TOGGLE */}
        {/* ... */}

        {/* VELOCÍMETROS */}
        {/* ... */}
      </div>
    </div>
  );
}

export default App;

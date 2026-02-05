import React, { useState, useEffect } from 'react';

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
        const updated = { ...e, [campo]: valor };
        if (campo === 'tipoIdx') {
          const p = preciosNuevos[valor];
          updated.sueldoBruto = p.sueldoSugerido || 0;
          updated.ventaUnit = p.valor;
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
    const gananciaNetaTotal = gananciaBrutaTotal - gastosOperativos + eerrBase.otrosIngresos;
    return {
      ingresoTotal, costoIngresosTotal, gananciaBrutaTotal, gananciaNetaTotal,
      margenBrutoPct: ingresoTotal > 0 ? (gananciaBrutaTotal / ingresoTotal) * 100 : 0,
      margenNetoPct: ingresoTotal > 0 ? (gananciaNetaTotal / ingresoTotal) * 100 : 0,
      desvioGananciaNeta: gananciaNetaTotal - eerrBase.gananciaNeta,
      propuesta
    };
  };

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
      config: { pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo }
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

        {/* TABLA SIMULACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="font-bold text-slate-700 text-sm">💼 Simulación de Servicios (Propuesta)</h2>
            <div className="flex gap-2">
               <button onClick={() => setMostrarHistorial(!mostrarHistorial)} className={`text-xs font-bold px-3 py-1 border rounded-lg transition ${mostrarHistorial ? 'bg-purple-600 text-white border-purple-600' : 'text-slate-600 border-purple-200 hover:text-purple-600'}`}>📋 Historial ({historial.length})</button>
               <button onClick={guardarEscenario} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition">💾 Guardar Escenario</button>
               <button onClick={() => { if(window.confirm('¿Limpiar todos los campos?')) setEscenarios([]); }} className="text-slate-400 hover:text-slate-600 text-xs font-bold px-3 py-1">Limpiar</button>
               <button onClick={agregarFila} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition">+ Agregar</button>
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
                  const p = preciosNuevos[e.tipoIdx];
                  const isStaff = p.categoria === 'Staff Augmentation';
                  let costoTotal = 0;
                  if (isStaff) {
                    const sueldo = e.cantidad * e.sueldoBruto;
                    costoTotal = sueldo + (sueldo * pctCostoLaboral/100) + (sueldo * pctIndirectos/100);
                  } else {
                    const base = e.cantidad * p.costoFijo;
                    costoTotal = base + (base * pctIndirectos/100);
                  }
                  const venta = e.cantidad * e.ventaUnit;
                  const res = venta - costoTotal;
                  const mgn = venta > 0 ? (res / venta) * 100 : 0;
                  return (
                    <tr key={e.id} className="border-t border-purple-50 hover:bg-purple-50/30 transition">
                      <td className="p-4"><select value={e.cliente} onChange={ev => actualizarFila(e.id, 'cliente', ev.target.value)} className="bg-transparent focus:outline-none font-medium">{clientesDisponibles.map(c => <option key={c}>{c}</option>)}</select></td>
                      <td className="p-4"><select value={e.tipoIdx} onChange={ev => actualizarFila(e.id, 'tipoIdx', parseInt(ev.target.value))} className="bg-transparent focus:outline-none text-purple-600 font-bold text-xs">{preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>)}</select></td>
                      <td className="p-4 text-center"><input type="number" value={e.cantidad} onChange={ev => actualizarFila(e.id, 'cantidad', parseInt(ev.target.value))} className="w-10 text-center bg-purple-50 rounded font-bold" /></td>
                      <td className="p-4 text-right"><input type="number" value={e.ventaUnit} onChange={ev => actualizarFila(e.id, 'ventaUnit', parseInt(ev.target.value))} className="w-28 text-right bg-blue-50 text-blue-700 font-bold rounded px-2 border border-blue-200" /></td>
                      <td className="p-4 text-right">{isStaff ? <input type="number" value={e.sueldoBruto} onChange={ev => actualizarFila(e.id, 'sueldoBruto', parseInt(ev.target.value))} className="w-24 text-right bg-pink-50 text-pink-700 font-bold rounded px-2 border border-pink-200" /> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-4 text-right font-mono text-red-500 text-xs">-{format(costoTotal)}</td>
                      <td className="p-4 text-right font-bold text-green-600">{format(res)}</td>
                      <td className="p-4 text-center"><span className={`text-[10px] font-black px-2 py-1 rounded ${mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{mgn.toFixed(1)}%</span></td>
                      <td className="p-4 text-right"><button onClick={() => setEscenarios(escenarios.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORIAL DE ESCENARIOS (NUEVO) */}
        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 text-sm">📋 Historial de Escenarios Guardados</h2>
              <button onClick={() => setMostrarHistorial(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cerrar</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historial.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-400 text-sm italic">No hay escenarios guardados en este navegador.</div>
              ) : (
                historial.map(item => (
                  <div key={item.id} className="border border-purple-100 rounded-lg p-4 hover:border-purple-400 transition bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-purple-700 text-sm uppercase truncate pr-2">{item.nombre}</h3>
                      <button onClick={() => { if(window.confirm('¿Eliminar este escenario?')) setHistorial(historial.filter(h => h.id !== item.id)) }} className="text-slate-300 hover:text-red-500">✕</button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mb-3">{item.fecha}</p>
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Venta Propuesta:</span><span className="font-bold text-green-600">{format(item.eerr.propuesta.ventasTotales)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Ganancia Neta:</span><span className="font-bold text-blue-600">{format(item.eerr.gananciaNetaTotal)}</span></div>
                    </div>
                    <button onClick={() => {
                      if(window.confirm(`¿Cargar el escenario "${item.nombre}"? Se perderán los cambios actuales.`)) {
                        setEscenarios(JSON.parse(JSON.stringify(item.escenarios)));
                        setPctIndirectos(item.config.pctIndirectos);
                        setPctCostoLaboral(item.config.pctCostoLaboral);
                        setGastosOperativos(item.config.gastosOperativos);
                        setMargenObjetivo(item.config.margenObjetivo);
                        setMostrarHistorial(false);
                      }
                    }} className="w-full bg-purple-50 text-purple-700 py-2 rounded font-black text-[10px] uppercase hover:bg-purple-600 hover:text-white transition">Cargar Escenario</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* EERR COMPARATIVO CON TOGGLE */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <h2 className="font-bold text-sm">📊 Estado de Resultados Comparativo</h2>
            <button onClick={() => setMostrarEERR(!mostrarEERR)} className="bg-white/20 hover:bg-white/40 px-3 py-1 rounded text-[10px] font-black uppercase transition">
              {mostrarEERR ? '✕ Ocultar Panel' : '👁️ Mostrar Panel'}
            </button>
          </div>
          {mostrarEERR && (
            <div className="overflow-x-auto animate-in zoom-in-95 duration-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead><tr className="bg-purple-50 text-purple-600 font-bold uppercase text-[10px]"><th className="p-3 border-r border-purple-100"></th><th className="p-3 text-right border-r border-purple-100">EERR Dic-25</th><th className="p-3 text-right border-r border-purple-100">%</th><th className="p-3 text-right bg-green-50 border-r border-green-200">Propuesta</th><th className="p-3 text-right bg-green-50 border-r border-green-200">%</th><th className="p-3 text-right bg-blue-50 border-r border-blue-200">EERR Total</th><th className="p-3 text-right bg-blue-50">%</th></tr></thead>
                <tbody>
                  <tr className="border-b border-purple-50 hover:bg-purple-50/30"><td className="p-3 font-bold text-slate-700">Ingreso</td><td className="p-3 text-right font-mono border-r border-purple-100">{format(eerrBase.ingreso)}</td><td className="p-3 text-right font-bold border-r border-purple-100">100%</td><td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-green-700 font-bold">{format(propuesta.ventasTotales)}</td><td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">100%</td><td className="p-3 text-right font-mono bg-blue-50 border-r border-blue-200 text-blue-700 font-bold">{format(eerr.ingresoTotal)}</td><td className="p-3 text-right font-bold bg-blue-50">100%</td></tr>
                  <tr className="border-b border-purple-50 hover:bg-purple-50/30"><td className="p-3 font-bold text-slate-700">Costo de ingresos</td><td className="p-3 text-right font-mono text-red-600 border-r border-purple-100">{format(eerrBase.costoIngresos)}</td><td className="p-3 text-right font-bold border-r border-purple-100">{formatPct((eerrBase.costoIngresos / eerrBase.ingreso) * 100)}</td><td className="p-3 text-right font-mono text-red-600 bg-green-50 border-r border-green-200">{format(propuesta.costosTotales)}</td><td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">{propuesta.ventasTotales > 0 ? formatPct((propuesta.costosTotales / propuesta.ventasTotales) * 100) : '0%'}</td><td className="p-3 text-right font-mono text-red-600 bg-blue-50 border-r border-blue-200">{format(eerr.costoIngresosTotal)}</td><td className="p-3 text-right font-bold bg-blue-50">{formatPct((eerr.costoIngresosTotal / eerr.ingresoTotal) * 100)}</td></tr>
                  <tr className="border-b-2 border-purple-200 bg-purple-50/50"><td className="p-3 font-black text-slate-800">Ganancia bruta</td><td className="p-3 text-right font-mono font-bold text-purple-700 border-r border-purple-100">{format(eerrBase.gananciaBruta)}</td><td className="p-3 text-right font-bold border-r border-purple-100">{formatPct((eerrBase.gananciaBruta / eerrBase.ingreso) * 100)}</td><td className="p-3 text-right font-mono font-bold text-green-700 bg-green-50 border-r border-green-200">{format(propuesta.margenBruto)}</td><td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">{formatPct(propuesta.margenBrutoPct)}</td><td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50 border-r border-blue-200">{format(eerr.gananciaBrutaTotal)}</td><td className="p-3 text-right font-bold bg-blue-50">{formatPct(eerr.margenBrutoPct)}</td></tr>
                  <tr className="border-b border-purple-50 hover:bg-purple-50/30"><td className="p-3 font-bold text-slate-700 pl-6">Menos gasto de operación</td><td className="p-3 text-right font-mono text-red-600 border-r border-purple-100">{format(eerrBase.gastoOperacion)}</td><td className="p-3 text-right font-bold border-r border-purple-100">{formatPct((eerrBase.gastoOperacion / eerrBase.ingreso) * 100)}</td><td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-slate-400">0.00</td><td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">0%</td><td className="p-3 text-right font-mono text-red-600 bg-blue-50 border-r border-blue-200">{format(eerr.gastoOperacionTotal)}</td><td className="p-3 text-right font-bold bg-blue-50">{formatPct((eerr.gastoOperacionTotal / eerr.ingresoTotal) * 100)}</td></tr>
                  <tr className="bg-gradient-to-r from-purple-100 to-pink-100 border-t-4 border-purple-400"><td className="p-4 font-black text-slate-900 text-sm">Ganancia neta</td><td className="p-4 text-right font-mono font-black text-purple-700 border-r border-purple-200 text-sm">{format(eerrBase.gananciaNeta)}</td><td className="p-4 text-right font-black border-r border-purple-200">{formatPct((eerrBase.gananciaNeta / eerrBase.ingreso) * 100)}</td><td className="p-4 text-right font-mono font-black text-green-700 bg-green-100 border-r border-green-300 text-sm">{format(propuesta.margenBruto)}</td><td className="p-4 text-right font-black bg-green-100 border-r border-green-300">{formatPct(propuesta.margenBrutoPct)}</td><td className="p-4 text-right font-mono font-black text-blue-700 bg-blue-100 border-r border-blue-300 text-sm">{format(eerr.gananciaNetaTotal)}</td><td className="p-4 text-right font-black bg-blue-100">{formatPct(eerr.margenNetoPct)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VELOCÍMETROS */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-black text-slate-700 uppercase">🎯 Objetivos 2026 - Tracking de Ventas</h2></div>
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

import React, { useState, useEffect, useMemo } from 'react';

// 1. COLOCA TU ID AQUÍ
const SHEET_ID = 'T1vTJQrYIRPWBawtIIUdL4NvJcbDDwNCQf8YiXKl7t6BFi1mfVwQT4nuFAqX2YTKA5Q05Y6nBGhALckdf'; 

function App() {
  // ESTADOS DE DATOS (Cargados desde Sheets)
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [],
    clientes: [],
    config: {},
    eerrBase: {},
    lineasVenta: [],
    loading: true,
    error: null
  });

  // ESTADOS DE LA CALCULADORA
  const [escenarios, setEscenarios] = useState([]);
  const [mostrarEERR, setMostrarEERR] = useState(true);

  // 2. FUNCIÓN PARA LEER DESDE GOOGLE SHEETS (vía CSV para evitar APIs complejas)
  const fetchSheet = async (sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
    const response = await fetch(url);
    const text = await response.text();
    return csvToJSON(text);
  };

  // Helper para convertir CSV a JSON simple
  const csvToJSON = (csv) => {
    const lines = csv.split('\n');
    const result = [];
    const headers = lines[0].replace(/"/g, '').split(',');
    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const currentline = lines[i].replace(/"/g, '').split(',');
      headers.forEach((h, index) => obj[h.trim()] = currentline[index]?.trim());
      result.push(obj);
    }
    return result;
  };

  useEffect(() => {
    const cargarTodo = async () => {
      try {
        const [precios, cls, cfg, eerr, ventas] = await Promise.all([
          fetchSheet('PreciosNuevos'),
          fetchSheet('Clientes'),
          fetchSheet('Configuracion'),
          fetchSheet('EERRBase'),
          fetchSheet('LineasVenta')
        ]);

        // Procesar Configuración (de tabla a objeto)
        const configObj = {};
        cfg.forEach(row => configObj[row.Parámetro] = parseFloat(row.Valor));

        // Procesar EERR Base
        const eerrObj = {};
        eerr.forEach(row => eerrObj[row.Concepto] = parseFloat(row.Monto));

        setDataSheets({
          preciosNuevos: precios.map(p => ({
            ...p,
            valor: parseFloat(p['Valor (ARS)']),
            sueldoSugerido: parseFloat(p['Sueldo Sugerido (ARS)']) || 0,
            costoFijo: parseFloat(p['Costo Fijo (ARS)']) || 0
          })),
          clientes: cls.map(c => c.Cliente),
          config: configObj,
          eerrBase: eerrObj,
          lineasVenta: ventas,
          loading: false
        });

        // Inicializar un escenario vacío
        setEscenarios([{ id: Date.now(), cliente: cls[0]?.Cliente || 'Nuevo Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: parseFloat(precios[0]?.['Sueldo Sugerido (ARS)']) || 0, ventaUnit: parseFloat(precios[0]?.['Valor (ARS)']) || 0 }]);

      } catch (err) {
        setDataSheets(prev => ({ ...prev, loading: false, error: "Error al conectar con Google Sheets. Verifica el ID y que esté publicado." }));
      }
    };
    cargarTodo();
  }, []);

  // LÓGICA DE CÁLCULO (Igual a la anterior pero usando dataSheets.config)
  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      const v = e.cantidad * e.ventaUnit;
      let costoTotalFila = 0;
      if (p.Categoria === 'Staff Augmentation') {
        const sueldoTotal = e.cantidad * e.sueldoBruto;
        const costoLaboral = sueldoTotal * (dataSheets.config['% Costo Laboral'] / 100);
        const indirectos = sueldoTotal * (dataSheets.config['% Indirectos'] / 100);
        costoTotalFila = sueldoTotal + costoLaboral + indirectos;
      } else {
        const base = e.cantidad * p.costoFijo;
        const indirectos = base * (dataSheets.config['% Indirectos'] / 100);
        costoTotalFila = base + indirectos;
      }
      ventasTotales += v;
      costosTotales += costoTotalFila;
    });
    return { ventasTotales, costosTotales, margenBruto: ventasTotales - costosTotales };
  };

  const format = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">CONECTANDO CON GOOGLE SHEETS...</div>;
  if (dataSheets.error) return <div className="p-20 text-center text-red-500 font-bold">{dataSheets.error}</div>;

  const propuesta = calcularPropuesta();
  const eerrTotal = {
    ingreso: dataSheets.eerrBase['Ingreso'] + propuesta.ventasTotales,
    neta: dataSheets.eerrBase['Ganancia neta'] + (propuesta.margenBruto)
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER DINÁMICO */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded uppercase mb-2 inline-block">● Conectado a Google Sheets</span>
            <h1 className="text-3xl font-black text-slate-800 uppercase">Calculadora Horizon <span className="text-purple-600">Cloud</span></h1>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Gastos Op. Base</p>
              <p className="font-black text-slate-700">{format(dataSheets.config['Gastos Operativos'])}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Margen Obj.</p>
              <p className="font-black text-purple-600">{dataSheets.config['Margen Objetivo (%)']}%</p>
            </div>
          </div>
        </div>

        {/* TABLA DE ESCENARIOS */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
            <h2 className="font-bold text-xs uppercase tracking-widest">Simulador de Negocios</h2>
            <button 
              onClick={() => setEscenarios([...escenarios, { id: Date.now(), cliente: dataSheets.clientes[0], tipoIdx: 0, cantidad: 1, sueldoBruto: dataSheets.preciosNuevos[0].sueldoSugerido, ventaUnit: dataSheets.preciosNuevos[0].valor }])}
              className="bg-purple-500 hover:bg-purple-400 px-4 py-1 rounded text-[10px] font-black transition"
            >
              + AGREGAR SERVICIO
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                <th className="p-4">Cliente</th>
                <th className="p-4">Servicio</th>
                <th className="p-4 text-center">Cant</th>
                <th className="p-4 text-right">Venta Unit</th>
                <th className="p-4 text-right">Sueldo Bruto</th>
                <th className="p-4 text-right">Resultado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx];
                const isStaff = p.Categoria === 'Staff Augmentation';
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-4">
                      <select 
                        className="font-bold text-slate-700 bg-transparent focus:outline-none"
                        value={e.cliente}
                        onChange={(ev) => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, cliente: ev.target.value} : x))}
                      >
                        {dataSheets.clientes.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select 
                        className="text-purple-600 font-black text-xs bg-transparent focus:outline-none"
                        value={e.tipoIdx}
                        onChange={(ev) => {
                          const idx = parseInt(ev.target.value);
                          const sel = dataSheets.preciosNuevos[idx];
                          setEscenarios(escenarios.map(x => x.id === e.id ? {...x, tipoIdx: idx, ventaUnit: sel.valor, sueldoBruto: sel.sueldoSugerido} : x));
                        }}
                      >
                        {dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.Categoria} - {p.Tipo}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" className="w-12 text-center font-bold bg-slate-100 rounded" value={e.cantidad} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, cantidad: parseInt(ev.target.value) || 0} : x))} />
                    </td>
                    <td className="p-4 text-right">
                      <input type="number" className="w-28 text-right font-bold text-blue-600 bg-blue-50 rounded px-2" value={e.ventaUnit} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, ventaUnit: parseInt(ev.target.value) || 0} : x))} />
                    </td>
                    <td className="p-4 text-right">
                      {isStaff ? (
                        <input type="number" className="w-24 text-right font-bold text-pink-600 bg-pink-50 rounded px-2" value={e.sueldoBruto} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, sueldoBruto: parseInt(ev.target.value) || 0} : x))} />
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="p-4 text-right font-black text-green-600">
                      {format(e.cantidad * e.ventaUnit)}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => setEscenarios(escenarios.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RESUMEN DE IMPACTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ventas Nuevas</p>
            <p className="text-2xl font-black text-blue-600">{format(propuesta.ventasTotales)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Margen Bruto Propuesta</p>
            <p className="text-2xl font-black text-green-600">{format(propuesta.margenBruto)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nueva Ganancia Neta Est.</p>
            <p className="text-2xl font-black text-purple-600">{format(eerrTotal.neta)}</p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700 font-medium">
          💡 <strong>Tip de Escalabilidad:</strong> Cualquier cambio que hagas en el Google Sheets (precios, nuevos clientes o configuración) se verá reflejado aquí al recargar la página.
        </div>

      </div>
    </div>
  );
}

export default App;

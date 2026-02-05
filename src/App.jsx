import React, { useState, useEffect } from 'react';

// 1. REEMPLAZA CON TU ID
const SHEET_ID = '1vTJQrYIRPWBawtIIUdL4NvJcbDDwNCQf8YiXKl7t6BFi1mfVwQT4nuFAqX2YTKA5Q05Y6nBGhALckdf'; 

function App() {
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [],
    clientes: [],
    config: {},
    eerrBase: {},
    loading: true,
    error: null
  });

  const [escenarios, setEscenarios] = useState([]);

  // Función para limpiar números de Google Sheets (quita puntos de miles, cambia coma decimal por punto)
  const cleanNum = (val) => {
    if (!val) return 0;
    // Quita el símbolo $, quita los puntos de miles, y cambia la coma por punto
    const clean = val.toString().replace(/[$.]/g, '').replace(',', '.').trim();
    return parseFloat(clean) || 0;
  };

  const fetchSheet = async (sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
    const response = await fetch(url);
    const text = await response.text();
    return csvToJSON(text);
  };

  const csvToJSON = (csv) => {
    const lines = csv.split('\n');
    const headers = lines[0].replace(/"/g, '').split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.replace(/"/g, '').split(',');
      return headers.reduce((obj, header, i) => {
        obj[header] = values[i]?.trim();
        return obj;
      }, {});
    });
  };

  useEffect(() => {
    const cargarTodo = async () => {
      try {
        const [precios, cls, cfg, eerr] = await Promise.all([
          fetchSheet('PreciosNuevos'),
          fetchSheet('Clientes'),
          fetchSheet('Configuracion'),
          fetchSheet('EERRBase')
        ]);

        // Procesar Configuración
        const configObj = {};
        cfg.forEach(row => {
            const key = row['Parámetro'] || row['Parametro'];
            configObj[key] = cleanNum(row['Valor']);
        });

        // Procesar EERR Base
        const eerrObj = {};
        eerr.forEach(row => {
            eerrObj[row['Concepto']] = cleanNum(row['Monto (ARS)'] || row['# Monto (ARS)']);
        });

        const preciosProcesados = precios.map(p => ({
          categoria: p['Categoria'],
          tipo: p['Tipo'],
          valor: cleanNum(p['Valor (ARS)']),
          sueldoSugerido: cleanNum(p['Sueldo Sugerido (ARS)']),
          costoFijo: cleanNum(p['Costo Fijo (ARS)'])
        }));

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: cls.map(c => c['Cliente']).filter(c => c),
          config: configObj,
          eerrBase: eerrObj,
          loading: false
        });

        // Inicializar primer fila
        if (preciosProcesados.length > 0) {
          setEscenarios([{ 
            id: Date.now(), 
            cliente: cls[0]?.Cliente || 'Nuevo Cliente', 
            tipoIdx: 0, 
            cantidad: 1, 
            sueldoBruto: preciosProcesados[0].sueldoSugerido, 
            ventaUnit: preciosProcesados[0].valor 
          }]);
        }

      } catch (err) {
        setDataSheets(prev => ({ ...prev, loading: false, error: "Error de conexión. Verifica que el Sheet esté publicado como Web." }));
      }
    };
    cargarTodo();
  }, []);

  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      const v = e.cantidad * e.ventaUnit;
      let costoTotalFila = 0;
      if (p.categoria === 'Staff Augmentation') {
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

  if (dataSheets.loading) return <div className="p-20 text-center font-black text-purple-600 animate-pulse">SINCRONIZANDO CON HORIZON CLOUD...</div>;
  if (dataSheets.error) return <div className="p-20 text-center text-red-500 font-bold">{dataSheets.error}</div>;

  const propuesta = calcularPropuesta();
  const netaBase = dataSheets.eerrBase['Ganancia neta'] || 0;
  const netaTotal = netaBase + propuesta.margenBruto;

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase mb-2 inline-block shadow-sm">● Live Sheets Connected</span>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">HORIZON <span className="text-purple-600">CALCULATOR</span></h1>
          </div>
          <div className="flex gap-6 text-right bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Gastos Op. Base</p>
              <p className="font-black text-slate-700">{format(dataSheets.config['Gastos Operativos'])}</p>
            </div>
            <div className="border-l pl-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Margen Obj.</p>
              <p className="font-black text-purple-600">{dataSheets.config['Margen Objetivo (%)']}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-8">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <h2 className="font-black text-xs uppercase tracking-widest">Simulador de Escenarios</h2>
            <button 
              onClick={() => setEscenarios([...escenarios, { id: Date.now(), cliente: dataSheets.clientes[0], tipoIdx: 0, cantidad: 1, sueldoBruto: dataSheets.preciosNuevos[0].valor * 0.4, ventaUnit: dataSheets.preciosNuevos[0].valor }])}
              className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-full text-[10px] font-black transition-all transform hover:scale-105 shadow-lg"
            >
              + AGREGAR SERVICIO
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Servicio</th>
                <th className="p-4 text-center">Cant</th>
                <th className="p-4 text-right">Venta Unit</th>
                <th className="p-4 text-right">Sueldo Bruto</th>
                <th className="p-4 text-right">Subtotal</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map(e => {
                const p = dataSheets.preciosNuevos[e.tipoIdx];
                const isStaff = p?.categoria === 'Staff Augmentation';
                return (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-purple-50/30 transition">
                    <td className="p-4">
                      <select className="font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer" value={e.cliente} onChange={(ev) => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, cliente: ev.target.value} : x))}>
                        {dataSheets.clientes.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select className="text-purple-600 font-black text-xs bg-transparent focus:outline-none cursor-pointer" value={e.tipoIdx} onChange={(ev) => {
                          const idx = parseInt(ev.target.value);
                          const sel = dataSheets.preciosNuevos[idx];
                          setEscenarios(escenarios.map(x => x.id === e.id ? {...x, tipoIdx: idx, ventaUnit: sel.valor, sueldoBruto: sel.sueldoSugerido} : x));
                        }}>
                        {dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" className="w-12 text-center font-black bg-slate-100 rounded-lg p-1" value={e.cantidad} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, cantidad: parseInt(ev.target.value) || 0} : x))} />
                    </td>
                    <td className="p-4 text-right">
                      <input type="number" className="w-32 text-right font-black text-blue-600 bg-blue-50 rounded-lg px-2 py-1 border border-blue-100" value={e.ventaUnit} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, ventaUnit: parseInt(ev.target.value) || 0} : x))} />
                    </td>
                    <td className="p-4 text-right">
                      {isStaff ? (
                        <input type="number" className="w-28 text-right font-black text-pink-600 bg-pink-50 rounded-lg px-2 py-1 border border-pink-100" value={e.sueldoBruto} onChange={ev => setEscenarios(escenarios.map(x => x.id === e.id ? {...x, sueldoBruto: parseInt(ev.target.value) || 0} : x))} />
                      ) : <span className="text-slate-300 font-bold">N/A</span>}
                    </td>
                    <td className="p-4 text-right font-black text-slate-700">
                      {format(e.cantidad * e.ventaUnit)}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => setEscenarios(escenarios.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500 transition">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-xl border-b-8 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Ventas Proyectadas</p>
            <p className="text-3xl font-black text-blue-600">{format(propuesta.ventasTotales)}</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl border-b-8 border-green-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Margen Bruto Nuevo</p>
            <p className="text-3xl font-black text-green-600">{format(propuesta.margenBruto)}</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl border-b-8 border-purple-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Resultado Neto Final</p>
            <p className="text-3xl font-black text-purple-600">{format(netaTotal)}</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;

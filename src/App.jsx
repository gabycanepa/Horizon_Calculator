const SHEET_ID = '1vTJQrYIRPWBawtIIUdL4NvJcbDDwNCQf8YiXKl7t6BFi1mfVwQT4nuFAqX2YTKA5Q05Y6nBGhALckdf';

// Limpia y convierte strings numéricos a Number de forma robusta
const cleanNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
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

// Valida que un valor sea string válido
const validateString = (val) => {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return '';
};

// Valida array de strings
const validateStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(validateString).filter(s => s.length > 0);
};

// Valida objeto de línea de venta
const validateLineaVenta = (linea) => {
  if (!linea || typeof linea !== 'object') return null;
  return {
    id: typeof linea.id === 'number' ? linea.id : Date.now(),
    cliente: validateString(linea.cliente) || '',
    monto: cleanNum(linea.monto)
  };
};

// Carga segura desde localStorage
const safeLoadFromStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    const parsed = JSON.parse(saved);
    return parsed;
  } catch (e) {
    console.warn(`Error loading ${key} from localStorage:`, e);
    return defaultValue;
  }
};

// Guarda seguro en localStorage
const safeSaveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error saving ${key} to localStorage:`, e);
  }
};

const fetchSheet = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].replace(/(^"|"$)/g, '').split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.replace(/(^"|"$)/g, '').split(',').map(c => c.trim());
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = cells[i] !== undefined ? cells[i] : '';
    }
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
    const saved = safeLoadFromStorage('hzn_historial', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [pctIndirectos, setPctIndirectos] = useState(37);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(45);
  const [gastosOperativos, setGastosOperativos] = useState(46539684.59);
  const [margenObjetivo, setMargenObjetivo] = useState(25);

  const [objVentasTotal] = useState(2195176117);
  const [lineasVentaTotal, setLineasVentaTotal] = useState(() => {
    const saved = safeLoadFromStorage('hzn_lineasVenta', [{ id: 1, cliente: '', monto: 0 }]);
    if (!Array.isArray(saved) || saved.length === 0) return [{ id: 1, cliente: '', monto: 0 }];
    return saved.map(validateLineaVenta).filter(l => l !== null);
  });
  
  const [objRenovacion] = useState(1225673502);
  const [lineasRenovacion, setLineasRenovacion] = useState(() => {
    const saved = safeLoadFromStorage('hzn_lineasReno', [{ id: 1, cliente: '', monto: 0 }]);
    if (!Array.isArray(saved) || saved.length === 0) return [{ id: 1, cliente: '', monto: 0 }];
    return saved.map(validateLineaVenta).filter(l => l !== null);
  });
  
  const [objIncremental] = useState(969002614);
  const [lineasIncremental, setLineasIncremental] = useState(() => {
    const saved = safeLoadFromStorage('hzn_lineasIncr', [{ id: 1, cliente: '', monto: 0 }]);
    if (!Array.isArray(saved) || saved.length === 0) return [{ id: 1, cliente: '', monto: 0 }];
    return saved.map(validateLineaVenta).filter(l => l !== null);
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

        // Procesar configuración
        const configObj = {};
        cfg.forEach(row => {
          const key = row['Parámetro'] ?? row['Parametro'] ?? row['Key'] ?? Object.values(row)[0];
          const valCell = row['Valor'] ?? row['Value'] ?? Object.values(row)[1];
          if (key) configObj[String(key).trim()] = cleanNum(valCell);
        });

        // Procesar EERR Base
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

        // Procesar precios - VALIDACIÓN ROBUSTA
        const preciosProcesados = precios.map(p => {
          const categoria = validateString(p['Categoria'] ?? p['Categoría'] ?? p['categoria'] ?? p['category'] ?? Object.values(p)[0]) || 'Otros';
          const tipo = validateString(p['Tipo'] ?? p['tipo'] ?? p['Type'] ?? Object.values(p)[1]) || 'Default';
          const valor = cleanNum(p['Valor'] ?? p['Precio'] ?? Object.values(p)[2]);
          const sueldoSugerido = cleanNum(p['Sueldo'] ?? p['Sueldo bruto'] ?? Object.values(p)[3]);
          const costoFijo = cleanNum(p['Costo'] ?? p['Costo Fijo'] ?? Object.values(p)[4]);
          
          return { categoria, tipo, valor, sueldoSugerido, costoFijo };
        }).filter(p => p.categoria && p.tipo);

        // Procesar clientes - VALIDACIÓN ROBUSTA
        const clientesProcesados = clientes
          .map(c => {
            const val = c['Cliente'] ?? c['cliente'] ?? c['Name'] ?? Object.values(c)[0];
            return validateString(val);
          })
          .filter(c => c.length > 0);

        console.log('✅ Clientes procesados:', clientesProcesados);
        console.log('✅ Precios procesados:', preciosProcesados);

        setDataSheets({
          preciosNuevos: preciosProcesados,
          clientes: clientesProcesados,
          config: configObj,
          eerrBase: eerrObj,
          eerrBaseNorm: eerrNorm,
          loading: false,
          error: null
        });

        // Cargar configuración
        setPctIndirectos(configObj['% Indirectos'] ?? configObj['Indirectos'] ?? 37);
        setPctCostoLaboral(configObj['% Costo Laboral'] ?? configObj['Costo Laboral'] ?? 45);
        setGastosOperativos(configObj['Gastos Operativos'] ?? 46539684.59);
        setMargenObjetivo(configObj['Margen Objetivo (%)'] ?? 25);

        // Inicializar escenarios SOLO si hay datos válidos
        if (preciosProcesados.length > 0 && clientesProcesados.length > 0) {
          setEscenarios([{
            id: Date.now(),
            cliente: clientesProcesados[0],
            tipoIdx: 0,
            cantidad: 1,
            sueldoBruto: preciosProcesados[0].sueldoSugerido || 0,
            ventaUnit: preciosProcesados[0].valor || 0
          }]);
        } else {
          setEscenarios([]);
        }
      } catch (error) {
        console.error('❌ Error cargando sheets', error);
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos desde Google Sheets.' }));
      }
    };
    cargarDatos();
  }, []);

  // Guardar en localStorage con validación
  useEffect(() => {
    safeSaveToStorage('hzn_escenarios', escenarios);
    safeSaveToStorage('hzn_historial', historial);
    safeSaveToStorage('hzn_pctInd', pctIndirectos);
    safeSaveToStorage('hzn_pctLab', pctCostoLaboral);
    safeSaveToStorage('hzn_gastosOp', gastosOperativos);
    safeSaveToStorage('hzn_margenObj', margenObjetivo);
    safeSaveToStorage('hzn_lineasVenta', lineasVentaTotal);
    safeSaveToStorage('hzn_lineasReno', lineasRenovacion);
    safeSaveToStorage('hzn_lineasIncr', lineasIncremental);
  }, [escenarios, historial, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo, lineasVentaTotal, lineasRenovacion, lineasIncremental]);

  const agregarFila = () => {
    if (dataSheets.loading) {
      alert('Aún cargando datos. Intentá de nuevo en un momento.');
      return;
    }
    
    if (!dataSheets.clientes || dataSheets.clientes.length === 0) {
      alert('No hay clientes disponibles. Verificá la conexión con Google Sheets.');
      return;
    }

    if (!dataSheets.preciosNuevos || dataSheets.preciosNuevos.length === 0) {
      alert('No hay servicios disponibles. Verificá la conexión con Google Sheets.');
      return;
    }

    const precioDefault = dataSheets.preciosNuevos[0];

    setEscenarios(prev => ([
      ...prev,
      {
        id: Date.now(),
        cliente: dataSheets.clientes[0],
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
        const idx = Number(valor) || 0;
        updated.tipoIdx = idx;
        const p = dataSheets.preciosNuevos[idx];
        if (p) {
          updated.sueldoBruto = p.sueldoSugerido || updated.sueldoBruto;
          updated.ventaUnit = p.valor || updated.ventaUnit;
        }
      } else if (campo === 'cantidad') {
        updated.cantidad = Number(valor) || 0;
      } else if (campo === 'cliente') {
        updated.cliente = validateString(valor) || updated.cliente;
      }
      
      return updated;
    }));
  };

  const agregarLineaVenta = (tipo) => {
    const nuevaLinea = { id: Date.now(), cliente: '', monto: 0 };
    if (tipo === 'total') setLineasVentaTotal(prev => [...prev, nuevaLinea]);
    if (tipo === 'renovacion') setLineasRenovacion(prev => [...prev, nuevaLinea]);
    if (tipo === 'incremental') setLineasIncremental(prev => [...prev, nuevaLinea]);
  };

  const actualizarLineaVenta = (tipo, id, campo, valor) => {
    const actualizar = (lineas) => lineas.map(l => {
      if (l.id !== id) return l;
      if (campo === 'cliente') return { ...l, cliente: validateString(valor) || '' };
      if (campo === 'monto') return { ...l, monto: valor === '' ? 0 : cleanNum(valor) };
      return l;
    });
    
    if (tipo === 'total') setLineasVentaTotal(prev => actualizar(prev));
    if (tipo === 'renovacion') setLineasRenovacion(prev => actualizar(prev));
    if (tipo === 'incremental') setLineasIncremental(prev => actualizar(prev));
  };

  const eliminarLineaVenta = (tipo, id) => {
    if (tipo === 'total') setLineasVentaTotal(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
    if (tipo === 'renovacion') setLineasRenovacion(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
    if (tipo === 'incremental') setLineasIncremental(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  };

  const calcularTotalLineas = (lineas) => {
    if (!Array.isArray(lineas)) return 0;
    return lineas.reduce((sum, l) => sum + cleanNum(l.monto), 0);
  };

  const calcularPropuesta = () => {
    let ventasTotales = 0;
    let costosTotales = 0;
    
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      
      const cantidad = Number(e.cantidad) || 0;
      const ventaUnit = Number(e.ventaUnit) || 0;
      const ventaFila = cantidad * ventaUnit;
      
      let costoTotalFila = 0;
      const isStaff = (p.categoria || '').toLowerCase().includes('staff');
      
      if (isStaff) {
        const sueldoBruto = Number(e.sueldoBruto) || 0;
        const sueldoTotal = cantidad * sueldoBruto;
        const costoLaboral = sueldoTotal * (pctCostoLaboral / 100);
        const indirectos = sueldoTotal * (pctIndirectos / 100);
        costoTotalFila = sueldoTotal + costoLaboral + indirectos;
      } else {
        const costoFijo = Number(p.costoFijo) || 0;
        const base = cantidad * costoFijo;
        const indirectos = base * (pctIndirectos / 100);
        costoTotalFila = base + indirectos;
      }
      
      ventasTotales += ventaFila;
      costosTotales += costoTotalFila;
    });
    
    const margenBruto = ventasTotales - costosTotales;
    const margenBrutoPct = ventasTotales > 0 ? (margenBruto / ventasTotales) * 100 : 0;
    
    return { ventasTotales, costosTotales, margenBruto, margenBrutoPct };
  };

  const calcularEERRTotal = () => {
    const propuesta = calcularPropuesta();
    const eerr = dataSheets.eerrBase ?? {};
    const eerrNorm = dataSheets.eerrBaseNorm ?? {};

    const ingresoBase = tolerantGet(eerr, 'Ingreso') || tolerantGet(eerrNorm, normalizeKey('Ingreso')) || 0;
    const costoIngresoBase = tolerantGet(eerr, 'Costo de ingresos') || tolerantGet(eerrNorm, normalizeKey('Costo de ingresos')) || 0;
    const gananciaBrutaBase = tolerantGet(eerr, 'Ganancia bruta') || tolerantGet(eerrNorm, normalizeKey('Ganancia bruta')) || 0;
    const gastoOperacionBase = tolerantGet(eerr, 'Menos gasto de operación') || tolerantGet(eerrNorm, normalizeKey('Menos gasto de operación')) || 0;
    const ingresoOperacionBase = tolerantGet(eerr, 'Ingreso de operación') || tolerantGet(eerrNorm, normalizeKey('Ingreso de operación')) || 0;
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
      ingresoOperacionBase,
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
    return {
      ingreso: propuesta.ventasTotales,
      costo: propuesta.costosTotales,
      gananciaNeta: eerr.gananciaNetaTotal - (eerr.gananciaNetaBase || 0)
    };
  }, [escenarios, pctCostoLaboral, pctIndirectos, gastosOperativos, dataSheets.eerrBase]);

  const aportePorCliente = useMemo(() => {
    const resumen = {};
    
    escenarios.forEach(e => {
      const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
      if (!p) return;
      
      const cantidad = Number(e.cantidad) || 0;
      const ventaUnit = Number(e.ventaUnit) || 0;
      const venta = cantidad * ventaUnit;
      
      const isStaff = (p.categoria || '').toLowerCase().includes('staff');
      let costoTotal = 0;
      
      if (isStaff) {
        const sueldoBruto = Number(e.sueldoBruto) || 0;
        const sueldo = cantidad * sueldoBruto;
        costoTotal = sueldo + (sueldo * pctCostoLaboral / 100) + (sueldo * pctIndirectos / 100);
      } else {
        const base = cantidad * (Number(p.costoFijo) || 0);
        costoTotal = base + (base * pctIndirectos / 100);
      }
      
      const resultado = venta - costoTotal;
      const cliente = validateString(e.cliente) || 'Sin Cliente';
      
      if (!resumen[cliente]) {
        resumen[cliente] = { venta: 0, costo: 0, resultado: 0, margen: 0 };
      }
      
      resumen[cliente].venta += venta;
      resumen[cliente].costo += costoTotal;
      resumen[cliente].resultado += resultado;
    });
    
    Object.keys(resumen).forEach(cliente => {
      const r = resumen[cliente];
      r.margen = r.venta > 0 ? (r.resultado / r.venta) * 100 : 0;
    });
    
    return resumen;
  }, [escenarios, pctCostoLaboral, pctIndirectos, dataSheets.preciosNuevos]);

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
      config: {
        pctIndirectos,
        pctCostoLaboral,
        gastosOperativos,
        margenObjetivo,
        lineasVentaTotal,
        lineasRenovacion,
        lineasIncremental
      }
    };
    
    setHistorial(prev => [nuevoHistorial, ...prev]);
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
                  <select 
                    value={validateString(linea.cliente) || ''} 
                    onChange={(e) => actualizarLineaVenta(tipo, linea.id, 'cliente', e.target.value)} 
                    className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {dataSheets.clientes && dataSheets.clientes.length > 0 ? (
                      dataSheets.clientes.map(c => {
                        const clienteStr = validateString(c);
                        return clienteStr ? <option key={clienteStr} value={clienteStr}>{clienteStr}</option> : null;
                      })
                    ) : (
                      <option value="" disabled>Cargando clientes...</option>
                    )}
                  </select>
                  <input 
                    type="text" 
                    value={linea.monto === 0 ? '' : formatNum(linea.monto)} 
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\s/g, '');
                      const num = raw === '' ? 0 : parseFloat(raw) || 0;
                      actualizarLineaVenta(tipo, linea.id, 'monto', num);
                    }} 
                    className="w-32 bg-white border-2 border-blue-400 rounded px-2 py-1 text-xs font-bold text-blue-700 focus:outline-none" 
                    placeholder="0" 
                  />
                  {lineas.length > 1 && (
                    <button 
                      onClick={() => eliminarLineaVenta(tipo, linea.id)} 
                      className="text-slate-400 hover:text-red-500 text-sm font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t-2 border-purple-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-bold uppercase">Total Real:</span>
              <span className="font-black text-blue-700">{format(totalReal)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const eerr = calcularEERRTotal();
  const propuesta = eerr.propuesta;

  if (dataSheets.loading) {
    return (
      <div className="p-20 text-center font-black text-purple-600 animate-pulse">
        SINCRONIZANDO CON HORIZON CLOUD...
      </div>
    );
  }
  
  if (dataSheets.error) {
    return (
      <div className="p-20 text-center">
        <div className="font-black text-red-600 mb-4">{dataSheets.error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-purple-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent uppercase">
              Horizon Finance Engine 2026
            </h1>
            <p className="text-slate-500 text-sm mt-1">Estado de Resultados Proyectado (Base Dic-25 + Propuesta)</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
              <span className="text-[10px] font-bold text-purple-400 block uppercase">Gastos Op.</span>
              <input 
                type="number" 
                value={gastosOperativos} 
                onChange={e => setGastosOperativos(cleanNum(e.target.value))} 
                className="w-32 font-bold text-red-600 focus:outline-none text-xs" 
              />
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-100">
              <span className="text-[10px] font-bold text-blue-400 block uppercase">Indirectos</span>
              <input 
                type="number" 
                value={pctIndirectos} 
                onChange={e => setPctIndirectos(cleanNum(e.target.value))} 
                className="w-16 font-bold text-blue-600 focus:outline-none" 
              />%
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-pink-100">
              <span className="text-[10px] font-bold text-pink-400 block uppercase">Costo Lab.</span>
              <input 
                type="number" 
                value={pctCostoLaboral} 
                onChange={e => setPctCostoLaboral(cleanNum(e.target.value))} 
                className="w-16 font-bold text-pink-600 focus:outline-none" 
              />%
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-purple-100">
              <span className="text-[10px] font-bold text-purple-400 block uppercase">Margen Obj.</span>
              <input 
                type="number" 
                value={margenObjetivo} 
                onChange={e => setMargenObjetivo(cleanNum(e.target.value))} 
                className="w-16 font-bold text-purple-600 focus:outline-none" 
              />%
            </div>
          </div>
        </div>

        {/* TABLA SIMULACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-50 flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="font-bold text-slate-700 text-sm">💼 Simulación de Servicios (Propuesta)</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setMostrarHistorial(!mostrarHistorial)} 
                className={`text-xs font-bold px-3 py-1 border rounded-lg transition ${mostrarHistorial ? 'bg-purple-600 text-white border-purple-600' : 'text-slate-600 border-purple-200 hover:text-purple-600'}`}
              >
                📋 Historial ({historial.length})
              </button>
              <button 
                onClick={guardarEscenario} 
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition"
              >
                💾 Guardar Escenario
              </button>
              <button 
                onClick={() => { 
                  if(window.confirm('¿Limpiar todos los campos?')) {
                    setEscenarios([]);
                  }
                }} 
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-3 py-1"
              >
                Limpiar
              </button>
              <button 
                onClick={agregarFila} 
                disabled={dataSheets.loading} 
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg transition disabled:opacity-60"
              >
                + Agregar
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-purple-400 uppercase bg-purple-50/30">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Servicio</th>
                  <th className="p-4 text-center">Cant</th>
                  <th className="p-4 text-right">Venta Unit</th>
                  <th className="p-4 text-right">Sueldo Bruto</th>
                  <th className="p-4 text-right">Costo Total</th>
                  <th className="p-4 text-right">Resultado</th>
                  <th className="p-4 text-center">Margen</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {escenarios.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      No hay servicios simulados. Hacé clic en "+ Agregar" para comenzar.
                    </td>
                  </tr>
                ) : (
                  escenarios.map(e => {
                    const p = dataSheets.preciosNuevos && dataSheets.preciosNuevos[e.tipoIdx];
                    if (!p) return null;
                    
                    const isStaff = (p.categoria || '').toLowerCase().includes('staff');
                    const cantidad = Number(e.cantidad) || 0;
                    const ventaUnit = Number(e.ventaUnit) || 0;
                    const sueldoBruto = Number(e.sueldoBruto) || 0;
                    
                    let costoTotal = 0;
                    if (isStaff) {
                      const sueldo = cantidad * sueldoBruto;
                      costoTotal = sueldo + (sueldo * pctCostoLaboral/100) + (sueldo * pctIndirectos/100);
                    } else {
                      const base = cantidad * (Number(p.costoFijo) || 0);
                      costoTotal = base + (base * pctIndirectos/100);
                    }
                    
                    const venta = cantidad * ventaUnit;
                    const res = venta - costoTotal;
                    const mgn = venta > 0 ? (res / venta) * 100 : 0;

                    return (
                      <tr key={e.id} className="border-t border-purple-50 hover:bg-purple-50/30 transition">
                        <td className="p-4">
                          <select 
                            value={validateString(e.cliente) || ''} 
                            onChange={(ev) => actualizarFila(e.id, 'cliente', ev.target.value)} 
                            className="bg-transparent focus:outline-none font-medium w-full"
                          >
                            {dataSheets.clientes && dataSheets.clientes.length > 0 ? (
                              dataSheets.clientes.map(c => {
                                const clienteStr = validateString(c);
                                return clienteStr ? <option key={clienteStr} value={clienteStr}>{clienteStr}</option> : null;
                              })
                            ) : (
                              <option value="">Sin clientes</option>
                            )}
                          </select>
                        </td>
                        <td className="p-4">
                          <select 
                            value={e.tipoIdx} 
                            onChange={(ev) => actualizarFila(e.id, 'tipoIdx', ev.target.value)} 
                            className="bg-transparent focus:outline-none text-purple-600 font-bold text-xs w-full"
                          >
                            {dataSheets.preciosNuevos && dataSheets.preciosNuevos.length > 0 ? (
                              dataSheets.preciosNuevos.map((precio, i) => (
                                <option key={i} value={i}>
                                  {validateString(precio.categoria)} - {validateString(precio.tipo)}
                                </option>
                              ))
                            ) : (
                              <option value={0}>Sin servicios</option>
                            )}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <input 
                            type="number" 
                            value={cantidad} 
                            onChange={(ev) => actualizarFila(e.id, 'cantidad', ev.target.value)} 
                            className="w-16 text-center bg-purple-50 rounded font-bold focus:outline-none focus:ring-2 focus:ring-purple-300" 
                            min="0" 
                          />
                        </td>
                        <td className="p-4 text-right">
                          <input
                            type="text"
                            value={formatNum(ventaUnit)}
                            onChange={(ev) => {
                              const val = ev.target.value.replace(/\D/g, '');
                              actualizarFila(e.id, 'ventaUnit', val === '' ? 0 : Number(val));
                            }}
                            className="w-28 text-right bg-blue-50 text-blue-700 font-bold rounded px-2 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </td>
                        <td className="p-4 text-right">
                          {isStaff ? (
                            <input
                              type="text"
                              value={formatNum(sueldoBruto)}
                              onChange={(ev) => {
                                const val = ev.target.value.replace(/\D/g, '');
                                actualizarFila(e.id, 'sueldoBruto', val === '' ? 0 : Number(val));
                              }}
                              className="w-28 text-right bg-pink-50 text-pink-700 font-bold rounded px-2 border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono text-red-500 text-xs">
                          -{format(costoTotal)}
                        </td>
                        <td className="p-4 text-right font-bold text-green-600">
                          {format(res)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${
                            mgn >= margenObjetivo ? 'bg-green-100 text-green-700' : 
                            mgn >= 15 ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {mgn.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setEscenarios(prev => prev.filter(x => x.id !== e.id))} 
                            className="text-slate-300 hover:text-red-500 font-bold"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORIAL */}
        {mostrarHistorial && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 text-sm">📋 Historial de Escenarios Guardados</h2>
              <button 
                onClick={() => setMostrarHistorial(false)} 
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historial.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-400 text-sm italic">
                  No hay escenarios guardados en este navegador.
                </div>
              ) : (
                historial.map(item => (
                  <div key={item.id} className="border border-purple-100 rounded-lg p-4 hover:border-purple-400 transition bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-purple-700 text-sm uppercase truncate pr-2">
                        {item.nombre}
                      </h3>
                      <button 
                        onClick={() => { 
                          if(window.confirm('¿Eliminar este escenario?')) {
                            setHistorial(prev => prev.filter(h => h.id !== item.id));
                          }
                        }} 
                        className="text-slate-300 hover:text-red-500 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mb-3">{item.fecha}</p>
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Venta Propuesta:</span>
                        <span className="font-bold text-green-600">
                          {format(item.eerr.propuesta.ventasTotales)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ganancia Neta:</span>
                        <span className="font-bold text-blue-600">
                          {format(item.eerr.gananciaNetaTotal)}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if(window.confirm(`¿Cargar el escenario "${item.nombre}"? Se perderán los cambios actuales.`)) {
                          setEscenarios(JSON.parse(JSON.stringify(item.escenarios)));
                          setPctIndirectos(item.config.pctIndirectos);
                          setPctCostoLaboral(item.config.pctCostoLaboral);
                          setGastosOperativos(item.config.gastosOperativos);
                          setMargenObjetivo(item.config.margenObjetivo);
                          setLineasVentaTotal(item.config.lineasVentaTotal);
                          setLineasRenovacion(item.config.lineasRenovacion);
                          setLineasIncremental(item.config.lineasIncremental);
                          setMostrarHistorial(false);
                        }
                      }} 
                      className="w-full bg-purple-50 text-purple-700 py-2 rounded font-black text-[10px] uppercase hover:bg-purple-600 hover:text-white transition"
                    >
                      Cargar Escenario
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* EERR COMPARATIVO */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <h2 className="font-bold text-sm">📊 Estado de Resultados Comparativo</h2>
            <button 
              onClick={() => setMostrarEERR(!mostrarEERR)} 
              className="bg-white/20 hover:bg-white/40 px-3 py-1 rounded text-[10px] font-black uppercase transition"
            >
              {mostrarEERR ? '✕ Ocultar Panel' : '👁️ Mostrar Panel'}
            </button>
          </div>
          {mostrarEERR && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-purple-50 text-purple-600 font-bold uppercase text-[10px]">
                      <th className="p-3 border-r border-purple-100"></th>
                      <th className="p-3 text-right border-r border-purple-100">EERR Dic-25</th>
                      <th className="p-3 text-right border-r border-purple-100">%</th>
                      <th className="p-3 text-right bg-green-50 border-r border-green-200">Propuesta</th>
                      <th className="p-3 text-right bg-green-50 border-r border-green-200">%</th>
                      <th className="p-3 text-right bg-blue-50 border-r border-blue-200">EERR Total</th>
                      <th className="p-3 text-right bg-blue-50">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Ingreso</td>
                      <td className="p-3 text-right font-mono border-r border-purple-100">{format(eerr.ingresoBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">100%</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-green-700 font-bold">{format(propuesta.ventasTotales)}</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">100%</td>
                      <td className="p-3 text-right font-mono bg-blue-50 border-r border-blue-200 text-blue-700 font-bold">{format(eerr.ingresoTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">100%</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Costo de ingresos</td>
                      <td className="p-3 text-right font-mono border-r border-purple-100">{format(eerr.costoIngresoBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">{eerr.ingresoBase > 0 ? formatPct((eerr.costoIngresoBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-red-600 font-bold">-{format(propuesta.costosTotales)}</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">{propuesta.ventasTotales > 0 ? formatPct((propuesta.costosTotales / propuesta.ventasTotales) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono bg-blue-50 border-r border-blue-200 text-red-600 font-bold">-{format(eerr.costoIngresosTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">{eerr.ingresoTotal > 0 ? formatPct((eerr.costoIngresosTotal / eerr.ingresoTotal) * 100) : '0%'}</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Ganancia bruta</td>
                      <td className="p-3 text-right font-mono border-r border-purple-100">{format(eerr.gananciaBrutaBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">{eerr.ingresoBase > 0 ? formatPct((eerr.gananciaBrutaBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 font-bold">{format(propuesta.margenBruto)}</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">{formatPct(propuesta.margenBrutoPct)}</td>
                      <td className="p-3 text-right font-mono bg-blue-50 border-r border-blue-200 font-bold">{format(eerr.gananciaBrutaTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">{formatPct(eerr.margenBrutoPct)}</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700 pl-6">Menos gasto de operación</td>
                      <td className="p-3 text-right font-mono text-red-600 border-r border-purple-100">{format(eerr.gastoOperacionBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">{eerr.ingresoBase > 0 ? formatPct((eerr.gastoOperacionBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-slate-400">0</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">0%</td>
                      <td className="p-3 text-right font-mono text-red-600 bg-blue-50 border-r border-blue-200">{format(eerr.gastoOperacionTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">{eerr.ingresoTotal > 0 ? formatPct((eerr.gastoOperacionTotal / eerr.ingresoTotal) * 100) : '0%'}</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Ingreso de operación</td>
                      <td className="p-3 text-right font-mono text-purple-700 border-r border-purple-100">{format(eerr.ingresoOperacionBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">{eerr.ingresoBase > 0 ? formatPct((eerr.ingresoOperacionBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono font-bold text-green-700 bg-green-50 border-r border-green-200">{format(propuesta.margenBruto)}</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">{formatPct(propuesta.margenBrutoPct)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50 border-r border-blue-200">{format(eerr.ingresoOperacionTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">{formatPct(eerr.margenOperacionPct)}</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Más otros ingresos</td>
                      <td className="p-3 text-right font-mono text-purple-700 border-r border-purple-100">{format(eerr.otrosIngresosBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">{eerr.ingresoBase > 0 ? formatPct((eerr.otrosIngresosBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-slate-400">0</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">0%</td>
                      <td className="p-3 text-right font-mono bg-blue-50 border-r border-blue-200">{format(eerr.otrosIngresosTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">{eerr.ingresoTotal > 0 ? formatPct((eerr.otrosIngresosTotal / eerr.ingresoTotal) * 100) : '0%'}</td>
                    </tr>
                    <tr className="border-b border-purple-50 hover:bg-purple-50/30">
                      <td className="p-3 font-bold text-slate-700">Menos gastos de otro tipo</td>
                      <td className="p-3 text-right font-mono text-red-600 border-r border-purple-100">{format(eerr.otrosGastosBase)}</td>
                      <td className="p-3 text-right font-bold border-r border-purple-100">0%</td>
                      <td className="p-3 text-right font-mono bg-green-50 border-r border-green-200 text-slate-400">0</td>
                      <td className="p-3 text-right font-bold bg-green-50 border-r border-green-200">0%</td>
                      <td className="p-3 text-right font-mono text-red-600 bg-blue-50 border-r border-blue-200">{format(eerr.otrosGastosTotal)}</td>
                      <td className="p-3 text-right font-bold bg-blue-50">0%</td>
                    </tr>
                    <tr className="bg-gradient-to-r from-purple-100 to-pink-100 border-t-4 border-purple-400">
                      <td className="p-4 font-black text-slate-900 text-sm">Ganancia neta</td>
                      <td className="p-4 text-right font-mono font-black text-purple-700 border-r border-purple-200 text-sm">{format(eerr.gananciaNetaBase)}</td>
                      <td className="p-4 text-right font-black border-r border-purple-200">{eerr.ingresoBase > 0 ? formatPct((eerr.gananciaNetaBase / eerr.ingresoBase) * 100) : '0%'}</td>
                      <td className="p-4 text-right font-mono font-black text-green-700 bg-green-100 border-r border-green-300 text-sm">{format(propuesta.margenBruto)}</td>
                      <td className="p-4 text-right font-black bg-green-100 border-r border-green-300">{formatPct(propuesta.margenBrutoPct)}</td>
                      <td className="p-4 text-right font-mono font-black text-blue-700 bg-blue-100 border-r border-blue-300 text-sm">{format(eerr.gananciaNetaTotal)}</td>
                      <td className="p-4 text-right font-black bg-blue-100">{formatPct(eerr.margenNetoPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-t border-purple-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Desvío vs Base Dic-25</p>
                    <div className="flex gap-6 text-xs">
                      <span className="text-green-600 font-bold">Ingreso: +{format(desvioVsBase.ingreso)}</span>
                      <span className="text-red-600 font-bold">Costo: +{format(desvioVsBase.costo)}</span>
                      <span className={`font-black text-sm ${desvioVsBase.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Ganancia Neta: {desvioVsBase.gananciaNeta >= 0 ? '+' : ''}{format(desvioVsBase.gananciaNeta)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Margen Neto Total</p>
                    <p className={`text-2xl font-black ${eerr.margenNetoPct >= margenObjetivo ? 'text-green-600' : 'text-orange-600'}`}>
                      {eerr.margenNetoPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* APORTE POR CLIENTE */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 mb-6">
          <h3 className="text-xs font-bold text-blue-400 uppercase mb-4">Aporte por Cliente (Propuesta)</h3>
          <div className="space-y-4">
            {Object.keys(aportePorCliente).length === 0 ? (
              <p className="text-center text-slate-300 text-xs py-4 italic">Sin datos de simulación</p>
            ) : (
              Object.entries(aportePorCliente).map(([nombre, datos]) => (
                <div key={nombre} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-700">{nombre}</span>
                    <span className="text-xs font-black text-green-600">{format(datos.resultado)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                    <span>Venta: {format(datos.venta)}</span>
                    <span>Margen: {datos.margen.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${datos.margen >= margenObjetivo ? 'bg-gradient-to-r from-green-400 to-emerald-500' : datos.margen >= 15 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-red-400 to-pink-500'}`}
                      style={{ width: `${Math.min(100, datos.margen * 2)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* VELOCÍMETROS */}
        <div className="mb-6">
          <h2 className="text-lg font-black text-slate-700 mb-4">🎯 Objetivos 2026 - Tracking de Ventas</h2>
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

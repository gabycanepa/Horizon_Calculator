// ID de tu Google Sheets
const SHEET_ID = '1vTJQrYIRPWBawtIIUdL4NvJcbDDwNCQf8YiXKl7t6BFi1mfVwQT4nuFAqX2YTKA5Q05Y6nBGhALckdf';

// Funciones auxiliares para limpiar y parsear datos
const cleanNum = (val) => {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/[$.]/g, '').replace(',', '.')) || 0;
};

const getProp = (obj, name) => {
  const key = Object.keys(obj).find(k => k.toLowerCase().replace(/\s/g, '').includes(name.toLowerCase().replace(/\s/g, '')));
  return obj[key];
};

const fetchSheet = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split('\n');
  const headers = lines[0].replace(/"/g, '').split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.replace(/"/g, '').split(',');
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i]?.trim();
      return obj;
    }, {});
  });
};

function App() {
  // Estados para datos cargados desde Sheets
  const [dataSheets, setDataSheets] = useState({
    preciosNuevos: [],
    clientes: [],
    config: {},
    eerrBase: {},
    loading: true,
    error: null
  });

  // Estados configurables por usuario
  const [escenarios, setEscenarios] = useState([]);
  const [historial, setHistorial] = useState(() => {
    const saved = localStorage.getItem('hzn_historial');
    return saved ? JSON.parse(saved) : [];
  });
  const [pctIndirectos, setPctIndirectos] = useState(() => Number(localStorage.getItem('hzn_pctInd')) || 37);
  const [pctCostoLaboral, setPctCostoLaboral] = useState(() => Number(localStorage.getItem('hzn_pctLab')) || 45);
  const [gastosOperativos, setGastosOperativos] = useState(() => Number(localStorage.getItem('hzn_gastosOp')) || 46539684.59);
  const [margenObjetivo, setMargenObjetivo] = useState(() => Number(localStorage.getItem('hzn_margenObj')) || 25);

  // Cargar datos desde Sheets al montar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [precios, clientes, configRaw, eerrRaw] = await Promise.all([
          fetchSheet('PreciosNuevos'),
          fetchSheet('Clientes'),
          fetchSheet('Configuracion'),
          fetchSheet('EERRBase')
        ]);

        // Procesar configuración
        const config = {};
        configRaw.forEach(row => {
          const key = getProp(row, 'Parámetro') || getProp(row, 'Parametro');
          const val = getProp(row, 'Valor');
          if (key) config[key.trim()] = cleanNum(val);
        });

        // Procesar EERR base
        const eerrBase = {};
        eerrRaw.forEach(row => {
          const concepto = getProp(row, 'Concepto');
          const monto = getProp(row, 'Monto (ARS)') || getProp(row, '# Monto (ARS)');
          if (concepto) eerrBase[concepto.trim()] = cleanNum(monto);
        });

        // Procesar precios nuevos
        const preciosNuevos = precios.map(p => ({
          categoria: getProp(p, 'Categoria'),
          tipo: getProp(p, 'Tipo'),
          valor: cleanNum(getProp(p, 'Valor (ARS)')),
          sueldoSugerido: cleanNum(getProp(p, 'Sueldo Sugerido (ARS)')),
          costoFijo: cleanNum(getProp(p, 'Costo Fijo (ARS)'))
        }));

        // Procesar clientes
        const clientesDisponibles = clientes.map(c => getProp(c, 'Cliente')).filter(Boolean);

        setDataSheets({
          preciosNuevos,
          clientes: clientesDisponibles,
          config,
          eerrBase,
          loading: false,
          error: null
        });

        // Inicializar escenarios si no hay guardados
        const savedEscenarios = localStorage.getItem('hzn_escenarios');
        if (savedEscenarios) {
          setEscenarios(JSON.parse(savedEscenarios));
        } else {
          setEscenarios([{
            id: Date.now(),
            cliente: clientesDisponibles[0] || 'Nuevo Cliente',
            tipoIdx: 0,
            cantidad: 1,
            sueldoBruto: preciosNuevos[0]?.sueldoSugerido || 0,
            ventaUnit: preciosNuevos[0]?.valor || 0
          }]);
        }
      } catch (error) {
        setDataSheets(prev => ({ ...prev, loading: false, error: 'Error cargando datos desde Google Sheets.' }));
      }
    };
    cargarDatos();
  }, []);

  // Guardar escenarios y parámetros en localStorage
  useEffect(() => {
    localStorage.setItem('hzn_escenarios', JSON.stringify(escenarios));
    localStorage.setItem('hzn_historial', JSON.stringify(historial));
    localStorage.setItem('hzn_pctInd', pctIndirectos);
    localStorage.setItem('hzn_pctLab', pctCostoLaboral);
    localStorage.setItem('hzn_gastosOp', gastosOperativos);
    localStorage.setItem('hzn_margenObj', margenObjetivo);
  }, [escenarios, historial, pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo]);

  // Funciones de lógica y UI (usa las que ya tienes, adaptando a dataSheets)

  // Ejemplo: calcular propuesta
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

  // Resto de funciones y UI igual que antes, usando dataSheets y estados

  if (dataSheets.loading) return <div>Cargando datos...</div>;
  if (dataSheets.error) return <div>Error: {dataSheets.error}</div>;

  const propuesta = calcularPropuesta();

  // Renderiza toda la UI que ya tienes, usando dataSheets y estados

  return (
    <div>
      {/* Aquí va todo tu JSX con la UI que ya tienes */}
      {/* Usa dataSheets.preciosNuevos, dataSheets.clientes, dataSheets.eerrBase, etc. */}
      {/* Usa estados pctIndirectos, pctCostoLaboral, gastosOperativos, margenObjetivo */}
      {/* Usa escenarios, setEscenarios, historial, setHistorial */}
      {/* Usa funciones actualizarFila, agregarFila, guardarEscenario, etc. */}
    </div>
  );
}

export default App;

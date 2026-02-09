import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- CONFIGURATION & CONSTANTS ---
const SHEET_ID = '1fJVmm7i5g1IfOLHDTByRM-W01pWIF46k7aDOYsH4UKA';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCxPqker3JsD9YKVDeTY5zOqmguQM10hpRAvUbjlEe3PUOHI8uScpLvAMQ4QvrSu7x/exec';

const GOALS = {
    VENTAS_TOTAL: 2195176117,
    RENOVACION: 1225673502,
    INCREMENTAL: 969002614
};

const DEFAULTS = {
    PCT_INDIRECTOS: 37,
    PCT_COSTO_LABORAL: 45,
    GASTOS_OPERATIVOS: 46539684.59,
    MARGEN_OBJETIVO: 25,
    INFLACION_ANUAL: 0.20,
    FACTOR_CARGA_SOCIAL: 1.32
};

// --- UTILITIES & HELPERS ---
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
    try {
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
    } catch (e) {
        console.error(`Error fetching sheet ${sheetName}:`, e);
        return [];
    }
};

const formatCurrency = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const formatNumber = (n) =>
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);

const formatPercent = (n) => `${n.toFixed(1)}%`;

const annualToMonthly = (annualRate) => {
    if (!annualRate) return 0;
    return Math.pow(1 + annualRate, 1 / 12) - 1;
};

const calcCostoLaboralReal = (sueldoBruto, factorCarga, inflacionMonthly) => {
    return sueldoBruto * factorCarga * (1 + inflacionMonthly);
};

const safePct = (num, denom) => {
    if (!denom || denom === 0) return 0;
    return (num / denom) * 100;
};

// --- SUB-COMPONENTS ---

const ConfigInput = ({ label, value, onChange, type = "number", addon = "", colorClass = "" }) => (
    <div className={`bg-white px-3 py-1.5 rounded-lg border shadow-sm ${colorClass}`}>
        <span className="text-[9px] font-black block uppercase opacity-40 leading-none mb-1">{label}</span>
        <div className="flex items-center gap-0.5">
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-transparent focus:outline-none font-bold text-[11px]"
            />
            {addon && <span className="text-[10px] font-bold opacity-30">{addon}</span>}
        </div>
    </div>
);

const Velocimetro = ({ titulo, objetivo, lineas, onAdd, onUpdate, onRemove, color, clientes }) => {
    const totalReal = lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0);
    const pct = objetivo > 0 ? Math.min((totalReal / objetivo) * 100, 100) : 0;
    const angle = -90 + (pct * 1.8);
    const colorHex = pct >= 100 ? '#10b981' : pct >= 75 ? '#f59e0b' : pct >= 50 ? '#f97316' : '#ef4444';

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 flex flex-col items-center hover:shadow-2xl transition-all duration-500">
            <div className="w-8 h-1 rounded-full mb-4" style={{ backgroundColor: color }}></div>
            <h3 className="text-[9px] font-black text-center mb-6 uppercase tracking-widest text-slate-400">{titulo}</h3>

            <div className="relative w-full flex justify-center mb-8">
                <svg viewBox="0 0 200 120" className="w-44 drop-shadow-xl">
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke={colorHex}
                        strokeWidth="20"
                        strokeLinecap="round"
                        strokeDasharray={`${(pct / 100) * 251} 251`}
                        style={{ transition: 'all 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                    />
                    <g transform={`rotate(${angle} 100 100)`} style={{ transition: 'all 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                        <line x1="100" y1="100" x2="100" y2="40" stroke={colorHex} strokeWidth="4" strokeLinecap="round" />
                        <circle cx="100" cy="100" r="5" fill="white" stroke={colorHex} strokeWidth="3" />
                    </g>
                </svg>
                <div className="absolute top-16 text-center">
                    <p className="text-3xl font-black transition-all duration-500" style={{ color: colorHex }}>{pct.toFixed(0)}%</p>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Capacity</p>
                </div>
            </div>

            <div className="w-full space-y-2 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue Streams</span>
                    <button onClick={onAdd} className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-sm group hover:scale-110 active:scale-90 transition">+</button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {lineas.map(l => (
                        <div key={l.id} className="flex gap-1.5 items-center group/line">
                            <select value={l.cliente} onChange={e => onUpdate(l.id, 'cliente', e.target.value)} className="flex-1 bg-white border border-slate-100 rounded-md px-2 py-1 text-[9px] font-bold text-slate-600 appearance-none cursor-pointer">
                                {clientes.map(c => <option key={c}>{c}</option>)}
                            </select>
                            <input
                                value={l.monto === '' ? '' : formatNumber(l.monto)}
                                onChange={e => onUpdate(l.id, 'monto', e.target.value.replace(/\D/g, ''))}
                                className="w-16 bg-white border border-slate-100 rounded-md px-2 py-1 text-[9px] font-black text-slate-800 text-right focus:ring-1 focus:ring-indigo-100 focus:outline-none"
                                placeholder="0"
                            />
                            <button onClick={() => onRemove(l.id)} className="opacity-0 group-hover/line:opacity-100 text-slate-200 hover:text-rose-500 transition-all">✕</button>
                        </div>
                    ))}
                </div>
                <div className="pt-3 border-t border-slate-200 mt-2 flex justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Goal</span>
                        <span className="text-[10px] font-black text-slate-600">{formatNumber(objetivo)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Actual</span>
                        <span className="text-[10px] font-black text-indigo-600">{formatCurrency(totalReal)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APPLICATION COMPONENT ---

export default function App() {
    // Original App States
    const [dataSheets, setDataSheets] = useState({ preciosNuevos: [], clientes: [], eerrBase: {}, loading: true, error: null });
    const [escenarios, setEscenarios] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [pctInd, setPctInd] = useState(DEFAULTS.PCT_INDIRECTOS);
    const [pctLab, setPctLab] = useState(DEFAULTS.PCT_COSTO_LABORAL);
    const [gastosOp, setGastosOp] = useState(DEFAULTS.GASTOS_OPERATIVOS);
    const [mgnObj, setMgnObj] = useState(DEFAULTS.MARGEN_OBJETIVO);
    const [lv, setLv] = useState([{ id: 1, cliente: '', monto: '' }]);
    const [lr, setLr] = useState([{ id: 2, cliente: '', monto: '' }]);
    const [li, setLi] = useState([{ id: 3, cliente: '', monto: '' }]);
    const [ready, setReady] = useState(false);
    const [showHist, setShowHist] = useState(false);
    const [isCloudLoading, setIsCloudLoading] = useState(false);

    // --- NEW INTEGRATED TOOL STATES (INFLATION CALCULATOR) ---
    const [escenariosInflacion, setEscenariosInflacion] = useState([]);
    const [inflacionAnnual, setInflacionAnnual] = useState(DEFAULTS.INFLACION_ANUAL);
    const [inflacionMonthly, setInflacionMonthly] = useState(annualToMonthly(DEFAULTS.INFLACION_ANUAL));
    const [factorCargaSocial, setFactorCargaSocial] = useState(DEFAULTS.FACTOR_CARGA_SOCIAL);

    // --- INITIALIZATION ---
    useEffect(() => {
        const init = async () => {
            try {
                const [precios, clientes, cfg, eerr] = await Promise.all([
                    fetchSheet('PreciosNuevos'), fetchSheet('Clientes'), fetchSheet('Configuracion'), fetchSheet('EERRBase')
                ]);

                const config = {}; cfg.forEach(r => {
                    const key = r['Parámetro'] ?? Object.values(r)[0];
                    if (key) config[String(key).trim()] = cleanNum(Object.values(r)[1]);
                });

                const eerrObj = {}; eerr.forEach(r => {
                    const Concepto = Object.values(r)[0];
                    if (Concepto) eerrObj[String(Concepto).trim()] = cleanNum(Object.values(r)[1]);
                });

                const procPrecios = precios.map(p => ({
                    categoria: p['Categoria'] ?? p['Categoría'] ?? Object.values(p)[0],
                    tipo: p['Tipo'] ?? Object.values(p)[1],
                    valor: cleanNum(p['Valor (ARS)'] ?? Object.values(p)[2]),
                    sueldo: cleanNum(p['Sueldo Sugerido (ARS)'] ?? Object.values(p)[3]),
                    fijo: cleanNum(p['Costo Fijo (ARS)'] ?? Object.values(p)[4])
                }));

                const procClientes = clientes.map(c => Object.values(c)[0]).filter(Boolean);

                setDataSheets({
                    preciosNuevos: procPrecios,
                    clientes: procClientes,
                    eerrBase: eerrObj,
                    loading: false,
                    error: null
                });

                // Default Config from Sheets
                setPctInd(config['% Indirectos'] ?? config['Indirectos'] ?? 37);
                setPctLab(config['% Costo Laboral'] ?? config['Costo Laboral'] ?? 45);
                setGastosOp(config['Gastos Operativos'] ?? DEFAULTS.GASTOS_OPERATIVOS);

                // Fetch History
                loadCloudHistory();

                // Initial entry
                if (procPrecios.length > 0 && escenarios.length === 0) {
                    setEscenarios([{ id: Date.now(), cliente: procClientes[0] || 'Cliente', tipoIdx: 0, cantidad: 1, sueldoBruto: procPrecios[0].sueldo, ventaUnit: procPrecios[0].valor }]);
                }

                setReady(true);
            } catch (e) {
                console.error(e);
                setDataSheets(p => ({ ...p, loading: false, error: "Error de conexión con Horizon Sheets." }));
            }
        };
        init();
    }, []);

    const loadCloudHistory = async () => {
        try {
            const res = await fetch(`${SCRIPT_URL}?sheet=HistorialCompartido`);
            const data = await res.json();
            if (data && Array.isArray(data)) {
                const findKey = (obj, k) => Object.keys(obj).find(key => key.toLowerCase() === k.toLowerCase());
                const mapped = data.map(item => {
                    const parseJSON = (val, def) => { if (!val) return def; if (typeof val === 'object') return val; try { return JSON.parse(val); } catch (e) { return def; } };
                    return {
                        id: item[findKey(item, 'ID')] ? String(item[findKey(item, 'ID')]).replace(/'/g, "") : Date.now(),
                        nombre: item[findKey(item, 'Nombre')] || "Legacy Mode",
                        fecha: item[findKey(item, 'Fecha')] || "",
                        escenarios: parseJSON(item[findKey(item, 'DatosEscenario')], []),
                        config: parseJSON(item[findKey(item, 'Configuracion')], {}),
                        eerr: parseJSON(item[findKey(item, 'EERR')], {})
                    };
                });
                setHistorial(mapped);
            }
        } catch (e) { console.warn("Cloud History offline."); }
    };

    // --- ACTIONS ---
    const handleApplyHistory = (item) => {
        if (!window.confirm(`¿Cargar el modelo "${item.nombre}"?`)) return;
        setIsCloudLoading(true);
        setEscenarios(item.escenarios || []);
        const { config = {} } = item;
        setPctInd(config.pctIndirectos ?? 37);
        setPctLab(config.pctCostoLaboral ?? 45);
        setGastosOp(config.gastosOperativos ?? DEFAULTS.GASTOS_OPERATIVOS);
        setMgnObj(config.margenObjetivo ?? 25);
        if (config.lineasVentaTotal) setLv(config.lineasVentaTotal);
        if (config.lineasRenovacion) setLr(config.lineasRenovacion);
        if (config.lineasIncremental) setLi(config.lineasIncremental);
        setShowHist(false);
        setTimeout(() => setIsCloudLoading(false), 200);
    };

    const handleSyncCloud = async () => {
        const name = window.prompt("Nombre del modelo para la nube:", `Simulation_${historial.length + 1}`);
        if (!name) return;
        const body = {
            id: Date.now(),
            nombre: name,
            fecha: new Date().toLocaleString('es-AR'),
            escenarios,
            config: { pctIndirectos: pctInd, pctCostoLaboral: pctLab, gastosOperativos: gastosOp, margenObjetivo: mgnObj, lineasVentaTotal: lv, lineasRenovacion: lr, lineasIncremental: li },
            eerr: calculateEERR
        };
        try {
            const p = new URLSearchParams();
            p.append('payload', JSON.stringify(body));
            p.append('sheet', 'HistorialCompartido');
            await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: p.toString() });
            setHistorial(prev => [body, ...prev]);
            alert(`✅ Modelo "${name}" sincronizado.`);
        } catch (e) { alert("Error de sincronización."); }
    };

    // --- CALCULATIONS FOR ORIGINAL APP ---
    const calculateEERR = useMemo(() => {
        let simV = 0, simC = 0;
        const porCliente = {};
        escenarios.forEach(e => {
            const p = dataSheets.preciosNuevos[e.tipoIdx]; if (!p) return;
            const v = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
            let c = 0;
            if (p.categoria.toLowerCase().includes('staff')) {
                const s = (Number(e.cantidad) || 0) * (Number(e.sueldoBruto) || 0);
                c = s + (s * pctLab / 100) + (s * pctInd / 100);
            } else {
                const f = (Number(e.cantidad) || 0) * (Number(p.fijo) || 0);
                c = f + (f * pctInd / 100);
            }
            simV += v; simC += c;
            if (!porCliente[e.cliente]) porCliente[e.cliente] = { v: 0, c: 0 };
            porCliente[e.cliente].v += v; porCliente[e.cliente].c += c;
        });

        const baseV = tolerantGet(dataSheets.eerrBase, 'Ingreso');
        const baseC = tolerantGet(dataSheets.eerrBase, 'Costo de ingresos');
        const baseN = tolerantGet(dataSheets.eerrBase, 'Ganancia neta');

        const totalV = baseV + simV;
        const totalC = baseC + simC;
        const totalN = (totalV - totalC) - gastosOp + tolerantGet(dataSheets.eerrBase, 'Más otros ingresos') - tolerantGet(dataSheets.eerrBase, 'Menos gastos de otro tipo');

        return { simV, simC, simN: simV - simC, totalV, totalC, totalN, baseN, porCliente };
    }, [escenarios, pctInd, pctLab, gastosOp, dataSheets.eerrBase, dataSheets.preciosNuevos]);

    // --- CALCULATIONS FOR INFLATION TOOL ---
    const normalizarEscenarioInflacion = useCallback((raw) => {
        const n = {
            id: raw.id ?? Date.now(),
            cliente: raw.cliente ?? "",
            servicio: raw.servicio ?? "",
            ventaUnit: cleanNum(raw.ventaUnit),
            cantidad: cleanNum(raw.cantidad),
            sueldoBruto: cleanNum(raw.sueldoBruto),
        };
        n.totalMensual = n.ventaUnit * n.cantidad;
        n.costoLaboralReal = calcCostoLaboralReal(n.sueldoBruto * n.cantidad, factorCargaSocial, inflacionMonthly);
        n.resultado = n.totalMensual - n.costoLaboralReal;
        n.margenPct = safePct(n.resultado, n.totalMensual);
        return n;
    }, [factorCargaSocial, inflacionMonthly]);

    // Sync Inflation tool whenever params change
    useEffect(() => {
        setEscenariosInflacion(prev => prev.map(esc => normalizarEscenarioInflacion(esc)));
    }, [factorCargaSocial, inflacionMonthly, normalizarEscenarioInflacion]);

    useEffect(() => {
        setInflacionMonthly(annualToMonthly(inflacionAnnual));
    }, [inflacionAnnual]);

    if (dataSheets.loading) return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white overflow-hidden">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="font-black tracking-[0.4em] uppercase text-[10px] opacity-40 animate-pulse">Initializing Horizon Matrix v2.0</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans selection:bg-indigo-100 selection:text-indigo-900 selection:font-black">
            <div className="max-w-7xl mx-auto">

                {/* HEADER */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent uppercase py-1">Horizon Matrix <span className="text-slate-200">2026</span></h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Strategic Financial Intelligence & Forecasting Architecture</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <ConfigInput label="OpEx (ARS)" value={formatNumber(gastosOp)} onChange={val => setGastosOp(parseFloat(val.replace(/\./g, '')) || 0)} type="text" colorClass="border-indigo-100 text-indigo-600" />
                        <ConfigInput label="Indirects" value={pctInd} onChange={val => setPctInd(Number(val) || 0)} addon="%" colorClass="border-purple-100 text-purple-600" />
                        <ConfigInput label="Labor Burden" value={pctLab} onChange={val => setPctLab(Number(val) || 0)} addon="%" colorClass="border-pink-100 text-pink-600" />
                        <ConfigInput label="Target Margin" value={mgnObj} onChange={val => setMgnObj(Number(val) || 0)} addon="%" colorClass="border-slate-100 text-slate-600" />
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHist(!showHist)}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${showHist ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-400'}`}
                        >
                            Registry Registry ({historial.length})
                        </button>
                        <button
                            onClick={handleSyncCloud}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all duration-300 shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            Sync to Cloud Hub
                        </button>
                    </div>

                    <button onClick={() => { if (window.confirm('¿Borrar matriz actual?')) setEscenarios([]); }} className="text-[9px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition">Purge Current Buffer</button>
                </div>

                {/* HISTORY PANEL */}
                {showHist && (
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden mb-12 animate-in slide-in-from-top-4 duration-500">
                        <div className="p-6 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Snapshot Timeline</h2>
                            <button onClick={() => setShowHist(false)} className="text-slate-300 hover:text-slate-500 transition">✕</button>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {historial.map(item => (
                                <div key={item.id} className="group bg-white border border-slate-100 p-6 rounded-2xl hover:border-indigo-400 hover:shadow-xl transition-all duration-300">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black text-slate-800 text-xs uppercase truncate max-w-[80%]">{item.nombre}</h4>
                                        <span className="text-[8px] font-black text-slate-300 uppercase leading-none">{item.fecha.split(',')[0]}</span>
                                    </div>
                                    <div className="space-y-1 mb-6">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-slate-400"><span>Simulated V:</span><span className="text-emerald-500">{formatCurrency(item.eerr?.simV || 0)}</span></div>
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-slate-400"><span>Final Net:</span><span className="text-indigo-600">{formatCurrency(item.eerr?.totalN || 0)}</span></div>
                                    </div>
                                    <button onClick={() => handleApplyHistory(item)} className="w-full bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition uppercase text-[9px] font-black py-3 rounded-xl tracking-widest">Deploy Snapshot</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MAIN SIMULATION TABLE */}
                <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 mb-12 group">
                    <div className="px-8 py-6 bg-gradient-to-r from-slate-50/80 to-transparent flex justify-between items-center border-b border-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden relative">
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Revenue Generation Matrix</h2>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Service & Unit Simulation Engine</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { const p = dataSheets.preciosNuevos[0]; setEscenarios(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0], tipoIdx: 0, cantidad: 1, sueldoBruto: p.sueldo, ventaUnit: p.valor }]); }}
                            className="bg-indigo-600 hover:bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            + New Service Line
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">
                                    <th className="p-6 min-w-[150px]">Client / Account</th>
                                    <th className="p-6">Strategic Matrix</th>
                                    <th className="p-6 text-center">Qty</th>
                                    <th className="p-6 text-right">Unit Price</th>
                                    <th className="p-6 text-right">Base Comps</th>
                                    <th className="p-6 text-right">Net Result</th>
                                    <th className="p-6 text-center">Margin</th>
                                    <th className="p-6 w-12 text-center opacity-0">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold">
                                {escenarios.map(e => {
                                    const p = dataSheets.preciosNuevos[e.tipoIdx];
                                    const isStaff = p && (p.categoria || '').toLowerCase().includes('staff');
                                    const v = (Number(e.cantidad) || 0) * (Number(e.ventaUnit) || 0);
                                    let cost = 0; if (p) { if (isStaff) { const s = e.cantidad * e.sueldoBruto; cost = s + (s * pctLab / 100) + (s * pctInd / 100); } else { const f = e.cantidad * p.fijo; cost = f + (f * pctInd / 100); } }
                                    const res = v - cost; const mgn = v > 0 ? (res / v) * 100 : 0;
                                    return (
                                        <tr key={e.id} className="group border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-6">
                                                <select className="bg-transparent text-slate-700 font-black appearance-none cursor-pointer w-full focus:outline-none" value={e.cliente} onChange={ev => setEscenarios(prev => prev.map(x => x.id === e.id ? { ...x, cliente: ev.target.value } : x))}>{dataSheets.clientes.map(c => <option key={c}>{c}</option>)}</select>
                                            </td>
                                            <td className="p-6">
                                                <select className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-4 py-2 rounded-xl border border-transparent hover:border-indigo-100 appearance-none cursor-pointer focus:outline-none" value={e.tipoIdx} onChange={ev => { const i = Number(ev.target.value); setEscenarios(prev => prev.map(x => x.id === e.id ? { ...x, tipoIdx: i, sueldoBruto: dataSheets.preciosNuevos[i].sueldo, ventaUnit: dataSheets.preciosNuevos[i].valor } : x)) }}>{dataSheets.preciosNuevos.map((p, i) => <option key={i} value={i}>{p.categoria} - {p.tipo}</option>)}</select>
                                            </td>
                                            <td className="p-6 text-center">
                                                <input type="number" className="w-12 text-center bg-slate-100 rounded-lg py-2 font-black text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-200" value={e.cantidad} onChange={ev => setEscenarios(prev => prev.map(x => x.id === e.id ? { ...x, cantidad: Number(ev.target.value) } : x))} />
                                            </td>
                                            <td className="p-6 text-right">
                                                <input className="w-28 text-right bg-emerald-50 text-emerald-700 font-black px-3 py-2 rounded-xl focus:outline-none border border-transparent focus:border-emerald-100" value={formatNumber(e.ventaUnit)} onChange={ev => setEscenarios(prev => prev.map(x => x.id === e.id ? { ...x, ventaUnit: Number(ev.target.value.replace(/\D/g, '')) } : x))} />
                                            </td>
                                            <td className="p-6 text-right">
                                                {isStaff ? (
                                                    <input className="w-28 text-right bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl focus:outline-none border border-transparent focus:border-purple-100" value={formatNumber(e.sueldoBruto)} onChange={ev => setEscenarios(prev => prev.map(x => x.id === e.id ? { ...x, sueldoBruto: Number(ev.target.value.replace(/\D/g, '')) } : x))} />
                                                ) : <span className="text-slate-200 opacity-50 px-4">---</span>}
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-slate-800 text-[12px]">{formatCurrency(res)}</span>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase leading-none mt-1">Cost: {formatCurrency(cost)}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black shadow-sm ${mgn >= mgnObj ? 'bg-emerald-100 text-emerald-700' : mgn >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{mgn.toFixed(1)}%</span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <button onClick={() => setEscenarios(p => p.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100">✕</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {escenarios.length === 0 && <div className="p-20 text-center font-black text-slate-300 italic text-sm">NO SERVICE LINES PROJECTED IN CURRENT BUFFER.</div>}
                    </div>
                </div>

                {/* RESULTS SUMMARY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

                    {/* AGGREGATED P&L CARD */}
                    <div className="bg-slate-900 text-white rounded-[40px] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] -mr-40 -mt-40 transition-all group-hover:bg-indigo-500/30"></div>
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] block mb-4">Strategic Net Projection</span>
                            <div className="flex flex-col md:flex-row md:items-end gap-6">
                                <h2 className="text-6xl font-black tracking-tighter leading-none">{formatCurrency(calculateEERR.totalN)}</h2>
                                <div className={`text-xl font-black px-4 py-2 rounded-2xl ${calculateEERR.totalN >= calculateEERR.baseN ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {calculateEERR.totalN >= calculateEERR.baseN ? '+' : ''}{formatCurrency(calculateEERR.totalN - calculateEERR.baseN)} <span className="text-[9px] font-black uppercase opacity-60 ml-1">vs Baseline</span>
                                </div>
                            </div>

                            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-white/5 pt-8">
                                <div><span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Baseline</span><span className="text-sm font-black text-slate-300">{formatCurrency(calculateEERR.baseN)}</span></div>
                                <div><span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Sim. Surplus</span><span className="text-sm font-black text-emerald-400">+{formatCurrency(calculateEERR.simN)}</span></div>
                                <div><span className="text-[9px] font-black text-slate-500 uppercase block mb-1">OpEx Ratio</span><span className="text-sm font-black text-slate-300">{((gastosOp / calculateEERR.totalV) * 100).toFixed(1)}%</span></div>
                                <div><span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Net Margin</span><span className="text-sm font-black text-indigo-400">{(calculateEERR.totalV > 0 ? (calculateEERR.totalN / calculateEERR.totalV) * 100 : 0).toFixed(1)}%</span></div>
                            </div>
                        </div>
                    </div>

                    {/* CONTRIBUTION BY CLIENT */}
                    <div className="bg-white rounded-[40px] p-10 shadow-xl border border-slate-100 flex flex-col">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Client Contribution Parity</h3>
                        <div className="space-y-6 flex-1 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                            {Object.entries(calculateEERR.porCliente).map(([name, data]) => {
                                const res = data.v - data.c;
                                const mx = Math.max(...Object.values(calculateEERR.porCliente).map(d => d.v - d.c));
                                const pct = mx > 0 ? (res / mx) * 100 : 0;
                                return (
                                    <div key={name}>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[11px] font-black text-slate-700">{name}</span>
                                            <span className="text-[11px] font-black text-emerald-600">{formatCurrency(res)} <span className="text-[8px] text-slate-300 opacity-60 ml-1">{((res / (data.v || 1)) * 100).toFixed(1)}% MGN</span></span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(calculateEERR.porCliente).length === 0 && <div className="h-full flex items-center justify-center opacity-20 italic text-xs font-black">WAITING FOR SIMULATION DATA...</div>}
                        </div>
                    </div>
                </div>

                {/* --- INTEGRATED POWER TOOL: INFLATION & SOCIAL CHARGE CALCULATOR --- */}
                <div className="bg-indigo-50/30 rounded-[40px] p-12 mb-12 border-2 border-indigo-100/50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse"></div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Inflation & Labor Reality Matrix</h2>
                            </div>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1 ml-6">Advanced Simulator for Compounded Monthly Overhead</p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-indigo-100">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Annual Inflation %</span>
                                <input step="0.01" type="number" value={(inflacionAnnual * 100).toFixed(2)} onChange={e => setInflacionAnnual(parseFloat(e.target.value) / 100 || 0)} className="w-20 font-black text-indigo-600 focus:outline-none text-sm" />
                                <span className="text-[8px] font-black text-slate-300 uppercase ml-2 italic">Monthly: {(inflacionMonthly * 100).toFixed(2)}%</span>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-indigo-100">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Social Charge Factor</span>
                                <input step="0.01" type="number" value={factorCargaSocial} onChange={e => setFactorCargaSocial(parseFloat(e.target.value) || 1)} className="w-16 font-black text-indigo-600 focus:outline-none text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="p-6">Entity</th>
                                    <th className="p-6">Specific Service</th>
                                    <th className="p-6 text-center">Unit</th>
                                    <th className="p-6 text-right">Venta Unit</th>
                                    <th className="p-6 text-right">Raw Salary</th>
                                    <th className="p-6 text-right bg-indigo-50/30 text-indigo-600">Real Overhead</th>
                                    <th className="p-6 text-right">Net Profit</th>
                                    <th className="p-6 text-center">MGN %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {escenariosInflacion.map(esc => (
                                    <tr key={esc.id} className="border-t border-slate-50 font-bold group hover:bg-indigo-50/10">
                                        <td className="p-4"><input className="bg-transparent focus:outline-none w-full border-b border-transparent focus:border-indigo-200" value={esc.cliente} onChange={e => setEscenariosInflacion(p => p.map(x => x.id === esc.id ? { ...x, cliente: e.target.value } : x))} placeholder="Account Name" /></td>
                                        <td className="p-4"><input className="bg-transparent focus:outline-none w-full border-b border-transparent focus:border-indigo-200" value={esc.servicio} onChange={e => setEscenariosInflacion(p => p.map(x => x.id === esc.id ? { ...x, servicio: e.target.value } : x))} placeholder="Service Type" /></td>
                                        <td className="p-4 text-center"><input type="number" className="w-10 text-center bg-slate-50 rounded py-1" value={esc.cantidad} onChange={e => setEscenariosInflacion(p => p.map(x => x.id === esc.id ? { ...x, cantidad: e.target.value } : x))} /></td>
                                        <td className="p-4 text-right"><input className="w-24 text-right bg-emerald-50 text-emerald-800 rounded py-1 px-2" value={esc.ventaUnit} onChange={e => setEscenariosInflacion(p => p.map(x => x.id === esc.id ? { ...x, ventaUnit: e.target.value } : x))} /></td>
                                        <td className="p-4 text-right"><input className="w-24 text-right bg-indigo-50 text-indigo-800 rounded py-1 px-2" value={esc.sueldoBruto} onChange={e => setEscenariosInflacion(p => p.map(x => x.id === esc.id ? { ...x, sueldoBruto: e.target.value } : x))} /></td>
                                        <td className="p-4 text-right text-rose-500 font-black bg-indigo-50/30 underline decoration-indigo-200 decoration-dotted">-{formatCurrency(esc.costoLaboralReal)}</td>
                                        <td className="p-4 text-right font-black text-slate-800">{formatCurrency(esc.resultado)}</td>
                                        <td className="p-4 text-center"><span className={`px-2 py-1 rounded-lg text-[9px] font-black ${esc.margenPct >= 20 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{esc.margenPct.toFixed(1)}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-6 bg-slate-50/30 flex justify-center">
                            <button
                                onClick={() => setEscenariosInflacion(p => [...p, normalizarEscenarioInflacion({ id: Date.now(), cliente: 'Nuevo Cliente', servicio: 'Staff Pro', ventaUnit: 0, cantidad: 1, sueldoBruto: 0 })])}
                                className="bg-white border-2 border-indigo-200 text-indigo-600 px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                                + Integration Layer Row
                            </button>
                        </div>
                    </div>
                </div>

                {/* PERFORMANCE VELOCIMETERS SECTION */}
                <div className="mb-20">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Performance Tracking Matrix 2026</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <Velocimetro
                            titulo="Total Volume Target"
                            objetivo={GOALS.VENTAS_TOTAL}
                            lineas={lv}
                            onAdd={() => setLv(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || '', monto: '' }])}
                            onUpdate={(id, k, v) => setLv(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l))}
                            onRemove={(id) => setLv(prev => prev.filter(l => l.id !== id))}
                            color="#6366f1"
                            clientes={dataSheets.clientes}
                        />
                        <Velocimetro
                            titulo="Active Renewal Goal"
                            objetivo={GOALS.RENOVACION}
                            lineas={lr}
                            onAdd={() => setLr(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || '', monto: '' }])}
                            onUpdate={(id, k, v) => setLr(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l))}
                            onRemove={(id) => setLr(prev => prev.filter(l => l.id !== id))}
                            color="#ec4899"
                            clientes={dataSheets.clientes}
                        />
                        <Velocimetro
                            titulo="Incremental Capture"
                            objetivo={GOALS.INCREMENTAL}
                            lineas={li}
                            onAdd={() => setLi(prev => [...prev, { id: Date.now(), cliente: dataSheets.clientes[0] || '', monto: '' }])}
                            onUpdate={(id, k, v) => setLi(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l))}
                            onRemove={(id) => setLi(prev => prev.filter(l => l.id !== id))}
                            color="#3b82f6"
                            clientes={dataSheets.clientes}
                        />
                    </div>
                </div>

                {/* FOOTER */}
                <div className="py-20 border-t border-slate-200 mt-20 text-center opacity-30">
                    <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-500">
                        Horizon Finance Intelligence • Engine v2.0.4 Unified
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 mt-2">© 2026 Strategy Partners Group</p>
                </div>
            </div>

            {/* CLOUD OVERLAY LOADER */}
            {isCloudLoading && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                    <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-8 font-black text-[10px] uppercase tracking-widest text-slate-600 animate-pulse">Decrypting Matrix Scenario...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
export default App;

import React, { useState, useMemo, useEffect } from "react";
import ScenarioRow from "./ScenarioRow";
import StorageControls from "./StorageControls";

const emptyRow = () => ({
  cliente: "Nuevo Cliente",
  servicio: "Staff Augmentation - Analista Jr",
  cant: 1,
  valor_unit: 6000000,
  sueldo_bruto: 2500000,
  resultado: 0,
  ingreso: 0
});

export default function Simulator({ baseData }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [indirectPct, setIndirectPct] = useState(37);

  const calculateRow = (r) => {
    const ingreso = r.valor_unit * r.cant;
    const costoLaboral = r.sueldo_bruto * r.cant * 1.25;
    const costosIndirectos = ingreso * (indirectPct / 100);
    const resultado = ingreso - (costoLaboral + costosIndirectos);
    return { ...r, ingreso, resultado };
  };

  const updateRow = (idx, newRow) => {
    const copy = [...rows];
    copy[idx] = calculateRow(newRow);
    setRows(copy);
  };

  const addRow = () => setRows([...rows, emptyRow()]);
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
  const clear = () => setRows([emptyRow()]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => {
      const calc = calculateRow(r);
      acc.ingresos += calc.ingreso;
      acc.resultado += calc.resultado;
      return acc;
    }, { ingresos: 0, resultado: 0 });
  }, [rows, indirectPct]);

  const baseVentas = baseData?.resumen?.ventas_julio || 0;
  const baseMargen = baseData?.resumen?.margen_julio || 0;

  return (
    <div className="simulator-grid">
      <div className="card">
        <div className="toolbar">
          <div style={{display:"flex", gap:8}}>
            <button className="btn primary" onClick={addRow}>+ Agregar</button>
            <button className="btn ghost" onClick={clear}>Limpiar</button>
          </div>
          <StorageControls rows={rows} />
        </div>

        <div className="table-sim">
          <table>
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>SERVICIO</th>
                <th>CANT</th>
                <th>VENTA UNIT</th>
                <th>SUELDO BRUTO</th>
                <th>RESULTADO</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <ScenarioRow key={i} idx={i} row={r} onChange={updateRow} onRemove={removeRow} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h3 style={{marginTop:0, fontSize:16}}>EERR Comparativo</h3>
          <div style={{fontSize:13, color:"#8b8bb0"}}>Ingreso Total Proyectado</div>
          <div style={{fontSize:20, fontWeight:700}}>${(baseVentas + totals.ingresos).toLocaleString()}</div>

          <hr style={{margin:"12px 0", border:"0", borderTop:"1px solid #eee"}} />

          <div style={{fontSize:13, color:"#8b8bb0"}}>Resultado Neto Proyectado</div>
          <div style={{fontSize:20, fontWeight:700, color:"#7b3fe4"}}>${(baseMargen + totals.resultado).toLocaleString()}</div>

          <div style={{marginTop:8, fontSize:12, color: totals.resultado >= 0 ? "green":"red"}}>
            Desvío: {(( (baseMargen + totals.resultado) / (baseMargen || 1) - 1) * 100).toFixed(1)}% vs Base
          </div>
        </div>

        <div className="card" style={{background:"#f9f8ff"}}>
          <h3 style={{marginTop:0, fontSize:16}}>Métricas Propuesta</h3>
          <div style={{fontSize:13, color:"#8b8bb0"}}>Margen Propuesta</div>
          <div style={{fontSize:20, fontWeight:700}}>
            {((totals.resultado / (totals.ingresos || 1)) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
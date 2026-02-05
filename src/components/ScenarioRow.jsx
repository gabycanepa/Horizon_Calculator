import React from "react";

export default function ScenarioRow({ row, idx, onChange, onRemove }) {
  const handle = (k, v) => onChange(idx, { ...row, [k]: v });

  return (
    <tr>
      <td>
        <select value={row.cliente || ""} onChange={e => handle("cliente", e.target.value)}>
          <option value="Nuevo Cliente">Nuevo Cliente</option>
          <option>Arcos Dorados</option>
          <option>Banco Macro</option>
          <option>Unilever</option>
        </select>
      </td>
      <td>
        <select value={row.servicio || ""} onChange={e => handle("servicio", e.target.value)}>
          <option>Staff Augmentation - Analista Jr</option>
          <option>Staff Augmentation - Analista Sr</option>
          <option>Workshop</option>
          <option>Coaching</option>
        </select>
      </td>
      <td>
        <input type="number" value={row.cant || 1} onChange={e => handle("cant", Number(e.target.value))} style={{width:60}}/>
      </td>
      <td>
        <input type="number" value={row.valor_unit || 0} onChange={e => handle("valor_unit", Number(e.target.value))} style={{width:100}}/>
      </td>
      <td>
        <input type="number" value={row.sueldo_bruto || 0} onChange={e => handle("sueldo_bruto", Number(e.target.value))} style={{width:100}}/>
      </td>
      <td>
        <div style={{fontWeight:600, color: row.resultado < 0 ? "#d9534f":"#16a34a"}}>
          ${(row.resultado || 0).toLocaleString()}
        </div>
      </td>
      <td>
        <button className="small btn ghost" onClick={() => onRemove(idx)}>×</button>
      </td>
    </tr>
  );
}
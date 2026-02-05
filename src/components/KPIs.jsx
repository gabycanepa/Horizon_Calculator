import React from "react";

export default function KPIs({ baseData }) {
  const ventas = baseData?.resumen?.ventas_julio || 0;
  const margen = baseData?.resumen?.margen_julio || 0;

  return (
    <div style={{display:"flex", gap:12}}>
      <div className="card" style={{flex:1}}>
        <div style={{fontSize:12, color:"#8b8bb0"}}>Ingresos Dic-25 (Base)</div>
        <div style={{fontWeight:700, fontSize:20}}>${ventas.toLocaleString()}</div>
      </div>
      <div className="card" style={{width:220, textAlign:"center"}}>
        <div style={{fontSize:12, color:"#8b8bb0"}}>Margen Bruto Base</div>
        <div style={{fontWeight:700, fontSize:20}}>${margen.toLocaleString()}</div>
      </div>
    </div>
  );
}
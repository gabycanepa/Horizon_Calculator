import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div>
        <h1>HORIZON FINANCE ENGINE 2026</h1>
        <div style={{fontSize:13, opacity:0.85}}>Estado de Resultados Proyectado (Base Dic-25 + Propuesta)</div>
      </div>
      <div style={{display:"flex", gap:10, alignItems:"center"}}>
        <div style={{background:"rgba(255,255,255,0.12)", padding:"8px 12px", borderRadius:10, textAlign:"right"}}>
          <div style={{fontSize:12, color:"#ffdede"}}>GASTOS OP.</div>
          <div style={{fontWeight:700}}>46.539.684,59</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.12)", padding:"8px 12px", borderRadius:10, textAlign:"right"}}>
          <div style={{fontSize:12, color:"#fff"}}>INDIRECTOS</div>
          <div style={{fontWeight:700}}>37 %</div>
        </div>
      </div>
    </header>
  );
}
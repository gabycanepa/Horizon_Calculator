import React from "react";

export default function StorageControls({ rows }) {
  const saveLocal = () => {
    localStorage.setItem("hzn_scenario", JSON.stringify(rows));
    alert("Escenario guardado localmente.");
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "escenario_horizon.json";
    a.click();
  };

  return (
    <div style={{display:"flex", gap:8}}>
      <button className="btn ghost small" onClick={saveLocal}>Guardar Escenario</button>
      <button className="btn ghost small" onClick={download}>Descargar JSON</button>
    </div>
  );
}
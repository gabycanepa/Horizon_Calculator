import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import Simulator from "./components/Simulator";
import KPIs from "./components/KPIs";
import { loadBaseData } from "./utils/dataLoader";

export default function App() {
  const [baseData, setBaseData] = useState(null);

  useEffect(() => {
    loadBaseData().then(setBaseData).catch(err => {
      console.error("Error cargando base:", err);
    });
  }, []);

  return (
    <div className="app-root">
      <Header />
      <div className="container">
        <div className="top-metrics">
          <KPIs baseData={baseData} />
        </div>
        <Simulator baseData={baseData} />
      </div>
      <footer className="footer">Horizon Finance Engine - 2026</footer>
    </div>
  );
}
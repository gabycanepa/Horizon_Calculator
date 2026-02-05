import Papa from "papaparse";

export async function loadBaseData() {
  const url = "/data/Base_Pulida_Horizon.csv";
  const text = await fetch(url).then(r => {
    if (!r.ok) throw new Error("No se encontró " + url);
    return r.text();
  });

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data.map(r => ({
    ...r,
    Venta: r.Venta ? Number(r.Venta) : 0,
    Costo_Laboral: r.Costo_Laboral ? Number(r.Costo_Laboral) : 0,
    Margen_Bruto: r.Margen_Bruto ? Number(r.Margen_Bruto) : 0,
    Margen_Pct: r.Margen_Pct ? Number(r.Margen_Pct) : 0
  }));

  const resumen = {
    ventas_julio: 116791002,
    margen_julio: 57578165
  };

  return { rows, resumen };
}
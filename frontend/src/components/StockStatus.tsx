import { Warning } from "@phosphor-icons/react";

interface Props {
  stock: number;
  detailed?: boolean;
}

export function StockStatus({ stock, detailed = false }: Props) {
  const available = Math.max(0, Math.floor(stock));
  const low = available > 0 && available <= 5;
  const tone = available === 0 ? "badge-error" : low ? "badge-warning" : "badge-success";
  const label = available === 0 ? "Sin existencias" : low ? `Solo quedan ${available}` : `${available} disponibles`;

  if (!detailed) return <span className={`badge badge-soft badge-sm stock-badge ${tone}`}><span className={`status status-xs ${available === 0 ? "status-error" : low ? "status-warning" : "status-success"}`} />{label}</span>;

  return <div className={`stock-panel ${available === 0 ? "is-empty" : low ? "is-low" : "is-ready"}`}>
    <div><span className={`status ${available === 0 ? "status-error" : low ? "status-warning" : "status-success"}`} /><strong>{label}</strong></div>
    <p>{available === 0 ? "Este producto no puede agregarse por ahora." : low ? "Disponibilidad limitada. Odoo la comprobará otra vez al pagar." : "Existencia libre consultada directamente desde Odoo."}</p>
    {low && <progress className="progress progress-warning" value={available} max="5" aria-label={`${available} de 5 unidades`} />}
    {available === 0 && <span className="stock-note"><Warning size={15} />Puedes volver más tarde para consultar nueva disponibilidad.</span>}
  </div>;
}

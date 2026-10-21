import { House } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="breadcrumbs page-breadcrumbs" aria-label="Ruta de navegación"><ul><li><Link to="/" aria-label="Inicio"><House size={14} />Inicio</Link></li>{items.map((item) => <li key={`${item.label}-${item.to ?? "current"}`}>{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ul></nav>;
}

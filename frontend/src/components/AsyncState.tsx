import { WarningCircle } from "@phosphor-icons/react";

export function ProductSkeleton({ count = 8 }: { count?: number }) {
  return <div className="product-grid" aria-label="Cargando productos">{Array.from({ length: count }, (_, index) => <div className="product-skeleton" key={index}><span /><span /><span /></div>)}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state-panel error-state"><WarningCircle size={30} /><h2>No pudimos cargar esta información</h2><p>{message}</p>{retry && <button className="button-secondary" type="button" onClick={retry}>Intentar de nuevo</button>}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="state-panel"><h2>{title}</h2><p>{detail}</p></div>;
}

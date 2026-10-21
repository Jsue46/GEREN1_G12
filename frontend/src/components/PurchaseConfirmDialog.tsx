import { CreditCard, Package, ShieldCheck, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { money } from "../lib/api";
import type { CartLine, PaymentMethod } from "../types";

interface Props {
  open: boolean;
  items: CartLine[];
  card?: PaymentMethod;
  total: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PurchaseConfirmDialog({ open, items, card, total, busy, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={ref} className="modal purchase-modal" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} onClose={() => { if (open && !busy) onClose(); }}>
    <div className="modal-box">
      <header><div><span className="modal-kicker">Confirmación final</span><h2>Revisa antes de pagar</h2></div><button className="btn btn-ghost btn-circle btn-sm" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar confirmación"><X size={19} /></button></header>
      <div className="purchase-modal-lines">{items.map(({ product, quantity }) => <article key={product.id}><div className="purchase-modal-thumb"><img src={product.image_url} alt={product.name} /></div><div><strong>{product.name}</strong><span>{quantity} × {money(product.price)}</span></div><strong>{money(product.price * quantity)}</strong></article>)}</div>
      <dl className="purchase-modal-summary"><div><dt><Package size={17} />Unidades</dt><dd>{items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div><dt><CreditCard size={17} />Método</dt><dd>{card ? `${card.brand} •••• ${card.last4}` : "No seleccionado"}</dd></div><div className="purchase-modal-total"><dt>Total</dt><dd>{money(total)}</dd></div></dl>
      <div className="alert alert-warning alert-soft purchase-warning"><ShieldCheck size={20} /><span>Al confirmar, Odoo validará nuevamente las existencias y descontará inventario únicamente si la compra se completa.</span></div>
      <div className="modal-action"><button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>Volver</button><button className="btn btn-primary" type="button" onClick={onConfirm} disabled={busy || !card}>{busy ? <><span className="loading loading-spinner loading-sm" />Procesando compra</> : "Confirmar y pagar"}</button></div>
    </div>
    <form method="dialog" className="modal-backdrop"><button disabled={busy} aria-label="Cerrar confirmación">cerrar</button></form>
  </dialog>;
}

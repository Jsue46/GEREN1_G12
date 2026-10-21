import { ArrowLeft, ArrowRight, CheckCircle, CreditCard, FileText, Package, ShoppingBag } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CustomerForm } from "../components/CustomerForm";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PaymentSelector } from "../components/PaymentSelector";
import { PurchaseConfirmDialog } from "../components/PurchaseConfirmDialog";
import { ApiError, api, money } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Customer } from "../types";

export function QuotePage() {
  const navigate = useNavigate();
  const { cart, customer, lastQuote, setCustomer, setLastQuote, clearCart, notify } = useStore();
  const [step, setStep] = useState(lastQuote ? 3 : 1);
  const [selectedCard, setSelectedCard] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const paymentEmail = customer?.email || lastQuote?.customer_email || "";
  const cards = useQuery({ queryKey: ["payment-methods", paymentEmail], queryFn: () => api.paymentMethods(paymentEmail), enabled: Boolean(paymentEmail) });
  const cardId = selectedCard || cards.data?.[0]?.id || "";
  const selectedPaymentCard = cards.data?.find((card) => card.id === cardId);
  const items = cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity }));
  const quoteMutation = useMutation({ mutationFn: () => api.createQuote(customer!, items) });
  const buyMutation = useMutation({ mutationFn: () => api.checkout(customer!, items, cardId) });
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const saveCustomer = async (values: Customer) => { setCustomer(values); setStep(2); };
  const createQuote = async () => {
    try { const response = await quoteMutation.mutateAsync(); setLastQuote(response.data); setStep(3); }
    catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible crear la cotización.", "error"); }
  };
  const buy = async () => {
    if (!cardId) return notify("Adjunta una Tarjeta antes de comprar.", "error");
    try {
      const response = await buyMutation.mutateAsync();
      clearCart(); setLastQuote(null);
      notify(response.data.invoice_warning || `Pago ${response.data.payment.receipt} aprobado.`, response.data.invoice_warning ? "error" : "success");
      setPurchaseOpen(false); navigate(`/pedidos/${response.data.sale_order_id}?email=${encodeURIComponent(customer!.email)}`);
    } catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible completar la compra.", "error"); }
  };

  if (!cart.length && !lastQuote) return <section className="page-shell page-top"><div className="state-panel"><Package size={38} /><h1>No hay productos en el carrito</h1><p>Agrega productos antes de cotizar o comprar.</p><Link className="btn btn-primary button-primary" to="/catalogo">Ir al catálogo</Link></div></section>;
  return <section className="quote-page page-shell page-top">
    <Breadcrumbs items={[{ label: "Carrito", to: "/carrito" }, { label: "Compra o cotización" }]} />
    <header className="page-title"><p className="overline">Compra o cotización</p><h1>Elige cómo continuar.</h1><p>Cotizar no modifica inventario. Comprar valida existencias, registra el pago simulado y completa el despacho.</p></header>
    <ol className="steps steps-horizontal stepper"><li className={`step ${step >= 1 ? "step-primary" : ""}`}>Cliente</li><li className={`step ${step >= 2 ? "step-primary" : ""}`}>Revisión</li><li className={`step ${step >= 3 ? "step-primary" : ""}`}>Resultado</li></ol>
    {step === 1 && <div className="quote-stage"><div><h2>¿A nombre de quién?</h2><p>Los datos quedarán asociados al contacto en Odoo.</p></div><div className="form-panel"><CustomerForm defaultValues={customer} buttonLabel="Revisar productos" onSubmit={saveCustomer} /></div></div>}
    {step === 2 && <div className="quote-review"><ProductLines cart={cart} /><aside className="card card-border"><FileText size={28} /><h2>Resumen</h2><dl><div><dt>Cliente</dt><dd>{customer?.name}</dd></div><div><dt>Correo</dt><dd>{customer?.email}</dd></div><div><dt>Total estimado</dt><dd>{money(total)}</dd></div></dl><p>Odoo volverá a verificar precio y stock. La cotización no reserva unidades.</p><button className="btn btn-secondary quote-action" onClick={createQuote} disabled={quoteMutation.isPending || buyMutation.isPending}>{quoteMutation.isPending ? <><span className="loading loading-spinner loading-sm" />Creando cotización</> : <><FileText size={17} />Solo cotizar</>}</button><PaymentSelector cards={cards.data ?? []} value={cardId} onChange={setSelectedCard} /><button className="btn btn-primary" onClick={() => setPurchaseOpen(true)} disabled={!cardId || buyMutation.isPending || quoteMutation.isPending}><ShoppingBag size={17} />Comprar y pagar</button>{!cards.isLoading && !cards.data?.length && <Link className="btn btn-link card-required" to="/cuenta"><CreditCard size={16} />Adjuntar tarjeta en Mi cuenta</Link>}<button className="btn btn-ghost button-text" onClick={() => setStep(1)}><ArrowLeft size={15} />Editar cliente</button></aside></div>}
    {step === 3 && lastQuote && <div className="card card-border quote-success"><CheckCircle size={52} /><p className="overline">Cotización creada</p><h2>{lastQuote.quote_number}</h2><p>Está guardada en Odoo y no modificó el inventario. Abre el documento oficial para revisar sus líneas y pagar utilizando el stock disponible en ese momento.</p><dl><div><dt>Estado</dt><dd><span className="badge badge-warning badge-soft">Cotización</span></dd></div><div><dt>Total oficial</dt><dd>{money(lastQuote.total)}</dd></div></dl><Link className="btn btn-primary" to={`/cotizaciones/${lastQuote.quote_id}?email=${encodeURIComponent(lastQuote.customer_email)}`}>Ver y pagar cotización <ArrowRight size={16} /></Link><Link className="btn btn-secondary" to={`/portal?email=${encodeURIComponent(lastQuote.customer_email)}&codigo=${encodeURIComponent(lastQuote.quote_number)}`}>Ver en Mis pedidos</Link></div>}
    <PurchaseConfirmDialog open={purchaseOpen} items={cart.map((line) => ({ id: line.product.id, name: line.product.name, image_url: line.product.image_url, quantity: line.quantity, price: line.product.price }))} card={selectedPaymentCard} total={total} busy={buyMutation.isPending} onClose={() => setPurchaseOpen(false)} onConfirm={() => void buy()} />
  </section>;
}

function ProductLines({ cart }: { cart: ReturnType<typeof useStore.getState>["cart"] }) {
  return <div className="review-lines"><h2>Productos seleccionados</h2>{cart.map((line) => <article key={line.product.id}><img src={line.product.image_url} alt={line.product.name} /><div><strong>{line.product.name}</strong><span>{line.quantity} × {money(line.product.price)} · stock disponible: {line.product.stock}</span></div><strong>{money(line.quantity * line.product.price)}</strong></article>)}</div>;
}

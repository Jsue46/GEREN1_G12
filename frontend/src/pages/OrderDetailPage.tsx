import { CheckCircle, CreditCard, FileText, Package, ShoppingBag, Truck } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PaymentSelector } from "../components/PaymentSelector";
import { PurchaseConfirmDialog } from "../components/PurchaseConfirmDialog";
import { ApiError, api, money } from "../lib/api";
import { useStore } from "../store/useStore";

export function OrderDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { customer, setLastQuote, notify } = useStore();
  const savedEmail = customer?.email;
  const email = params.get("email") || savedEmail || "";
  const orderId = Number(id);
  const [selectedCard, setSelectedCard] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const order = useQuery({
    queryKey: ["order", orderId, email],
    queryFn: () => api.orderDetail(orderId, email),
    enabled: Number.isInteger(orderId) && orderId > 0 && Boolean(email)
  });
  const isQuote = order.data?.state === "draft" || order.data?.state === "sent";
  const cards = useQuery({ queryKey: ["payment-methods", email], queryFn: () => api.paymentMethods(email), enabled: Boolean(email) && isQuote });
  const cardId = selectedCard || cards.data?.[0]?.id || "";
  const selectedPaymentCard = cards.data?.find((card) => card.id === cardId);
  const conversion = useMutation({ mutationFn: () => api.convertQuote(orderId, email, cardId) });
  const convert = async () => {
    if (!cardId) return notify("Adjunta una Tarjeta antes de comprar.", "error");
    try {
      const response = await conversion.mutateAsync();
      setPurchaseOpen(false);
      setLastQuote(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", email] }),
        queryClient.invalidateQueries({ queryKey: ["invoices", email] }),
        queryClient.invalidateQueries({ queryKey: ["payments", email] }),
        queryClient.invalidateQueries({ queryKey: ["order", orderId, email] })
      ]);
      notify(response.data.invoice_warning || `Pago ${response.data.payment.receipt} aprobado.`, response.data.invoice_warning ? "error" : "success");
      navigate(`/pedidos/${response.data.sale_order_id}?email=${encodeURIComponent(response.data.customer_email)}`, { replace: true });
    } catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible convertir la cotización.", "error"); }
  };

  if (!email) return <section className="page-shell page-top"><ErrorState message="Ingresa desde el portal con tu correo para consultar este documento." /><Link className="btn btn-primary button-primary state-link" to="/portal">Ir al portal</Link></section>;
  if (!Number.isInteger(orderId) || orderId < 1) return <section className="page-shell page-top"><ErrorState message="El número de documento no es válido." /></section>;
  if (order.isLoading) return <section className="page-shell page-top"><div className="detail-document skeleton-block" /></section>;
  if (order.isError) return <section className="page-shell page-top"><ErrorState message={order.error.message} retry={() => order.refetch()} /></section>;
  if (!order.data) return null;

  const document = order.data;
  const confirmed = document.state === "sale" || document.state === "done";
  return <section className="document-page page-shell page-top">
    <Breadcrumbs items={[{ label: "Portal", to: `/portal?email=${encodeURIComponent(email)}` }, { label: document.order_number }]} />
    <div className="card card-border detail-document">
      <header><div><p className="overline">Documento comercial</p><h1>{document.order_number}</h1><p>{document.date}</p></div><span className={`badge badge-soft document-status ${confirmed ? "badge-success" : document.state === "cancel" ? "badge-error" : "badge-warning"} ${document.state}`}>{document.state_display}</span></header>
      <div className="alert alert-info alert-soft document-callout"><FileText size={23} /><div><strong>{document.state === "draft" || document.state === "sent" ? "Cotización guardada en Odoo" : "Orden confirmada en Odoo"}</strong><p>Los importes mostrados corresponden al documento oficial del ERP.</p></div></div>
      <section className="order-progress" aria-labelledby="order-progress-title"><div><p className="overline">Trazabilidad</p><h2 id="order-progress-title">Estado del documento</h2></div><ul className="timeline timeline-vertical timeline-compact"><li><div className="timeline-middle"><CheckCircle size={19} weight="fill" /></div><div className="timeline-end timeline-box"><strong>Documento creado</strong><span>{document.date}</span></div><hr /></li><li><hr /><div className={`timeline-middle ${confirmed ? "is-complete" : "is-current"}`}>{confirmed ? <CheckCircle size={19} weight="fill" /> : <ShoppingBag size={19} />}</div><div className="timeline-end timeline-box"><strong>{confirmed ? "Orden confirmada" : "Cotización pendiente"}</strong><span>{confirmed ? "Odoo confirmó la venta." : "Aún no descuenta ni reserva inventario."}</span></div>{confirmed && document.has_delivery && <hr />}</li>{confirmed && document.has_delivery && <li><hr /><div className="timeline-middle is-current"><Truck size={19} /></div><div className="timeline-end timeline-box"><strong>Despacho generado</strong><span>El proceso logístico continúa dentro de Odoo.</span></div></li>}</ul></section>
      <div className="document-lines">
        <div className="line-head"><span>Producto</span><span>Cantidad</span><span>Precio</span><span>Subtotal</span></div>
        {document.lines.map((line) => <article key={line.id}><span><Package size={19} /><strong>{line.name}</strong></span><span>{line.quantity}</span><span>{money(line.price_unit)}</span><strong>{money(line.subtotal)}</strong></article>)}
      </div>
      <dl className="document-totals"><div><dt>Subtotal</dt><dd>{money(document.subtotal)}</dd></div><div><dt>Impuestos</dt><dd>{money(document.tax)}</dd></div><div><dt>Total</dt><dd>{money(document.total)}</dd></div></dl>
      {isQuote && <section className="quote-payment-panel" aria-labelledby="quote-payment-title"><div><p className="overline">Compra desde la cotización</p><h2 id="quote-payment-title">Paga este documento.</h2><p>La confirmación utilizará exactamente las líneas oficiales mostradas arriba. Odoo validará nuevamente las existencias antes de convertirlo en pedido.</p></div><div className="quote-payment-actions">{cards.isLoading ? <div className="skeleton quote-payment-skeleton" /> : <PaymentSelector cards={cards.data ?? []} value={cardId} onChange={setSelectedCard} label="Método para pagar esta cotización" />}{cards.isSuccess && !cards.data.length ? <Link className="btn btn-secondary" to="/cuenta"><CreditCard size={17} />Adjuntar tarjeta en Mi cuenta</Link> : <button className="btn btn-primary" onClick={() => setPurchaseOpen(true)} disabled={!cardId || conversion.isPending}><CreditCard size={17} />Pagar {document.order_number}</button>}<small>El pago es una simulación educativa y no realiza cargos bancarios reales.</small></div></section>}
    </div>
    <PurchaseConfirmDialog open={purchaseOpen} items={document.lines.map((line) => ({ id: line.id, name: line.name, image_url: line.product_id ? `/api/products/${line.product_id}/image` : undefined, quantity: line.quantity, price: line.price_unit }))} card={selectedPaymentCard} total={document.total} busy={conversion.isPending} onClose={() => setPurchaseOpen(false)} onConfirm={() => void convert()} />
  </section>;
}

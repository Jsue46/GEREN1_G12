import { CheckCircle, FileText, Package, ShoppingBag, Truck } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { api, money } from "../lib/api";
import { useStore } from "../store/useStore";

export function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const savedEmail = useStore((state) => state.customer?.email);
  const email = params.get("email") || savedEmail || "";
  const orderId = Number(id);
  const order = useQuery({
    queryKey: ["order", orderId, email],
    queryFn: () => api.orderDetail(orderId, email),
    enabled: Number.isInteger(orderId) && orderId > 0 && Boolean(email)
  });

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
    </div>
  </section>;
}

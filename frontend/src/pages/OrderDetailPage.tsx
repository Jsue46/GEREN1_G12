import { ArrowLeft, FileText, Package } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorState } from "../components/AsyncState";
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

  if (!email) return <section className="page-shell page-top"><ErrorState message="Ingresa desde el portal con tu correo para consultar este documento." /><Link className="button-primary state-link" to="/portal">Ir al portal</Link></section>;
  if (!Number.isInteger(orderId) || orderId < 1) return <section className="page-shell page-top"><ErrorState message="El número de documento no es válido." /></section>;
  if (order.isLoading) return <section className="page-shell page-top"><div className="detail-document skeleton-block" /></section>;
  if (order.isError) return <section className="page-shell page-top"><ErrorState message={order.error.message} retry={() => order.refetch()} /></section>;
  if (!order.data) return null;

  const document = order.data;
  return <section className="document-page page-shell page-top">
    <Link className="back-link" to={`/portal?email=${encodeURIComponent(email)}`}><ArrowLeft size={16} />Volver al portal</Link>
    <div className="detail-document">
      <header><div><p className="overline">Documento comercial</p><h1>{document.order_number}</h1><p>{document.date}</p></div><span className={`status ${document.state}`}>{document.state_display}</span></header>
      <div className="document-callout"><FileText size={23} /><div><strong>{document.state === "draft" || document.state === "sent" ? "Cotización guardada en Odoo" : "Orden confirmada en Odoo"}</strong><p>Los importes mostrados corresponden al documento oficial del ERP.</p></div></div>
      <div className="document-lines">
        <div className="line-head"><span>Producto</span><span>Cantidad</span><span>Precio</span><span>Subtotal</span></div>
        {document.lines.map((line) => <article key={line.id}><span><Package size={19} /><strong>{line.name}</strong></span><span>{line.quantity}</span><span>{money(line.price_unit)}</span><strong>{money(line.subtotal)}</strong></article>)}
      </div>
      <dl className="document-totals"><div><dt>Subtotal</dt><dd>{money(document.subtotal)}</dd></div><div><dt>Impuestos</dt><dd>{money(document.tax)}</dd></div><div><dt>Total</dt><dd>{money(document.total)}</dd></div></dl>
    </div>
  </section>;
}

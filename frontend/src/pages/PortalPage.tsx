import { CreditCard, FileText, MagnifyingGlass, Package, Receipt } from "@phosphor-icons/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { api, money } from "../lib/api";
import { useStore } from "../store/useStore";
import type { InvoiceSummary, OrderSummary, SimulatedPayment } from "../types";

export function PortalPage() {
  const customer = useStore((state) => state.customer);
  const [params, setParams] = useSearchParams();
  const [draftEmail, setDraftEmail] = useState(params.get("email") || customer?.email || "");
  const [draftCode, setDraftCode] = useState(params.get("codigo") || "");
  const email = params.get("email") || "";
  const code = params.get("codigo") || "";
  const [tab, setTab] = useState<"orders" | "invoices" | "payments">("orders");
  const orders = useQuery({ queryKey: ["orders", email], queryFn: () => api.orders(email), enabled: Boolean(email) });
  const invoices = useQuery({ queryKey: ["invoices", email], queryFn: () => api.invoices(email), enabled: Boolean(email) });
  const payments = useQuery({ queryKey: ["payments", email], queryFn: () => api.payments(email), enabled: Boolean(email) });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draftEmail.trim()) return;
    const next = new URLSearchParams({ email: draftEmail.trim() });
    if (draftCode.trim()) next.set("codigo", draftCode.trim().toUpperCase());
    setParams(next);
  };
  return <section className="portal-page page-shell page-top">
    <Breadcrumbs items={[{ label: "Portal de cliente" }]} />
    <header className="page-title"><p className="overline">Portal conectado con Odoo</p><h1>Tus compras, en un solo lugar.</h1><p>Consulta tus documentos con el correo registrado. Si tienes el código de una cotización, puedes ingresarlo para encontrarla directamente.</p></header>
    <form className="portal-lookup" onSubmit={submit}><label className="input"><MagnifyingGlass size={19} /><input type="email" required value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} placeholder="correo@ejemplo.com" aria-label="Correo del cliente" /></label><label className="input"><FileText size={19} /><input value={draftCode} onChange={(event) => setDraftCode(event.target.value)} placeholder="Código, ej. S00017" aria-label="Código de cotización opcional" /></label><button className="btn btn-primary">Consultar</button></form>
    {!email ? <div className="state-panel portal-welcome"><Package size={36} /><h2>Ingresa tu correo para comenzar</h2><p>También puedes agregar el código para recuperar una cotización específica.</p></div> : <><div className="stats portal-stats" aria-label="Resumen de actividad"><div className="stat"><div className="stat-figure"><Package size={22} /></div><div className="stat-title">Documentos</div><div className="stat-value">{orders.isLoading ? "—" : orders.data?.length ?? 0}</div><div className="stat-desc">Cotizaciones y pedidos</div></div><div className="stat"><div className="stat-figure"><Receipt size={22} /></div><div className="stat-title">Facturas</div><div className="stat-value">{invoices.isLoading ? "—" : invoices.data?.length ?? 0}</div><div className="stat-desc">Emitidas en Odoo</div></div><div className="stat"><div className="stat-figure"><CreditCard size={22} /></div><div className="stat-title">Pagos</div><div className="stat-value">{payments.isLoading ? "—" : payments.data?.length ?? 0}</div><div className="stat-desc">Simulaciones aprobadas</div></div></div><div className="tabs tabs-box portal-tabs" role="tablist"><button role="tab" aria-selected={tab === "orders"} className={`tab ${tab === "orders" ? "tab-active active" : ""}`} onClick={() => setTab("orders")}><Package size={18} />Pedidos <span className="badge badge-sm">{orders.data?.length ?? 0}</span></button><button role="tab" aria-selected={tab === "invoices"} className={`tab ${tab === "invoices" ? "tab-active active" : ""}`} onClick={() => setTab("invoices")}><Receipt size={18} />Facturas <span className="badge badge-sm">{invoices.data?.length ?? 0}</span></button><button role="tab" aria-selected={tab === "payments"} className={`tab ${tab === "payments" ? "tab-active active" : ""}`} onClick={() => setTab("payments")}><CreditCard size={18} />Pagos <span className="badge badge-sm">{payments.data?.length ?? 0}</span></button></div>{tab === "orders" ? <PortalOrders query={orders} email={email} initialTerm={code} /> : tab === "invoices" ? <PortalInvoices query={invoices} /> : <PortalPayments query={payments} />}</>}
  </section>;
}

function PortalPayments({ query }: { query: UseQueryResult<SimulatedPayment[], Error> }) {
  if (query.isLoading) return <div className="document-list"><div className="skeleton document-skeleton" /></div>;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="No hay pagos simulados" detail="Los pagos aparecerán cuando completes una compra con una Tarjeta." />;
  return <div className="document-list">{query.data.map((payment) => <article className="card card-border document-row" key={payment.id}><CreditCard size={22} /><div><strong>{payment.receipt}</strong><span>{payment.order_number} · {payment.card.brand} •••• {payment.card.last4}</span></div><span className="badge badge-success badge-soft document-status paid">Aprobado</span><strong>{money(payment.amount)}</strong></article>)}</div>;
}

function PortalOrders({ query, email, initialTerm }: { query: UseQueryResult<OrderSummary[], Error>; email: string; initialTerm?: string }) {
  const [filter, setFilter] = useState<"all" | "quotes" | "orders">("all");
  const [term, setTerm] = useState(initialTerm ?? "");
  useEffect(() => { setTerm(initialTerm ?? ""); }, [initialTerm]);
  const filtered = useMemo(() => (query.data ?? []).filter((order) => {
    const isQuote = order.state === "draft" || order.state === "sent";
    const matchesType = filter === "all" || (filter === "quotes" ? isQuote : !isQuote);
    return matchesType && `${order.order_number} ${order.state_display}`.toLocaleLowerCase("es").includes(term.trim().toLocaleLowerCase("es"));
  }), [query.data, filter, term]);
  if (query.isLoading) return <div className="document-list"><div className="skeleton document-skeleton" /><div className="skeleton document-skeleton" /></div>;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="No hay pedidos registrados" detail="Todavía no existen cotizaciones u órdenes asociadas a este correo." />;
  return <><div className="portal-controls"><label className="input input-sm"><MagnifyingGlass size={17} /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar por código o estado" aria-label="Buscar documento" /></label><div className="join" aria-label="Filtrar pedidos"><button className={`btn btn-sm join-item ${filter === "all" ? "btn-active" : ""}`} onClick={() => setFilter("all")}>Todos</button><button className={`btn btn-sm join-item ${filter === "quotes" ? "btn-active" : ""}`} onClick={() => setFilter("quotes")}>Cotizaciones</button><button className={`btn btn-sm join-item ${filter === "orders" ? "btn-active" : ""}`} onClick={() => setFilter("orders")}>Confirmados</button></div></div>{filtered.length ? <div className="document-list">{filtered.map((order) => <Link className="card card-border document-row" to={`/${order.state === "draft" || order.state === "sent" ? "cotizaciones" : "pedidos"}/${order.id}?email=${encodeURIComponent(email)}`} key={order.id}><FileText size={22} /><div><strong>{order.order_number}</strong><span>{order.date}</span></div><span className={`badge badge-soft document-status ${order.state === "sale" || order.state === "done" ? "badge-success" : order.state === "cancel" ? "badge-error" : "badge-warning"} ${order.state}`}>{order.state_display}</span><strong>{money(order.total)}</strong></Link>)}</div> : <EmptyState title="No encontramos ese código" detail="Comprueba que el código y el correo correspondan a la misma cotización." />}</>;
}

function PortalInvoices({ query }: { query: UseQueryResult<InvoiceSummary[], Error> }) {
  if (query.isLoading) return <div className="document-list"><div className="skeleton document-skeleton" /><div className="skeleton document-skeleton" /></div>;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="No hay facturas registradas" detail="Las facturas aparecerán después de confirmar una orden." />;
  return <div className="document-list">{query.data.map((invoice) => <article className="card card-border document-row" key={invoice.id}><Receipt size={22} /><div><strong>{invoice.invoice_number}</strong><span>{invoice.date}</span></div><span className={`badge badge-soft document-status ${invoice.simulated_payment ? "badge-success" : "badge-warning"} ${invoice.state}`}>{invoice.payment_display}</span><strong>{money(invoice.total)}</strong></article>)}</div>;
}

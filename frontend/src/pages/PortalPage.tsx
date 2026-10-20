import { FileText, MagnifyingGlass, Package, Receipt } from "@phosphor-icons/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState } from "../components/AsyncState";
import { api, money } from "../lib/api";
import { useStore } from "../store/useStore";
import type { InvoiceSummary, OrderSummary } from "../types";

export function PortalPage() {
  const customer = useStore((state) => state.customer);
  const [params, setParams] = useSearchParams();
  const [draftEmail, setDraftEmail] = useState(params.get("email") || customer?.email || "");
  const email = params.get("email") || "";
  const [tab, setTab] = useState<"orders" | "invoices">("orders");
  const orders = useQuery({ queryKey: ["orders", email], queryFn: () => api.orders(email), enabled: Boolean(email) });
  const invoices = useQuery({ queryKey: ["invoices", email], queryFn: () => api.invoices(email), enabled: Boolean(email) });
  const submit = (event: FormEvent) => { event.preventDefault(); if (draftEmail.trim()) setParams({ email: draftEmail.trim() }); };
  return <section className="portal-page page-shell page-top">
    <header className="page-title"><p className="overline">Portal conectado con Odoo</p><h1>Tus compras, en un solo lugar.</h1><p>Consulta cotizaciones, órdenes y facturas utilizando el correo registrado.</p></header>
    <form className="portal-search" onSubmit={submit}><MagnifyingGlass size={20} /><input type="email" required value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} placeholder="correo@ejemplo.com" /><button className="button-primary">Consultar</button></form>
    {!email ? <div className="portal-welcome"><Package size={36} /><h2>Ingresa tu correo para comenzar</h2><p>Mostraremos únicamente los documentos relacionados con ese cliente.</p></div> : <><div className="portal-tabs"><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><Package size={18} />Pedidos</button><button className={tab === "invoices" ? "active" : ""} onClick={() => setTab("invoices")}><Receipt size={18} />Facturas</button></div>{tab === "orders" ? <PortalOrders query={orders} email={email} /> : <PortalInvoices query={invoices} />}</>}
  </section>;
}

function PortalOrders({ query, email }: { query: UseQueryResult<OrderSummary[], Error>; email: string }) {
  if (query.isLoading) return <div className="document-list"><div className="document-skeleton" /><div className="document-skeleton" /></div>;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="No hay pedidos registrados" detail="Todavía no existen cotizaciones u órdenes asociadas a este correo." />;
  return <div className="document-list">{query.data.map((order) => <Link className="document-row" to={`/${order.state === "draft" || order.state === "sent" ? "cotizaciones" : "pedidos"}/${order.id}?email=${encodeURIComponent(email)}`} key={order.id}><FileText size={22} /><div><strong>{order.order_number}</strong><span>{order.date}</span></div><span className={`status ${order.state}`}>{order.state_display}</span><strong>{money(order.total)}</strong></Link>)}</div>;
}

function PortalInvoices({ query }: { query: UseQueryResult<InvoiceSummary[], Error> }) {
  if (query.isLoading) return <div className="document-list"><div className="document-skeleton" /><div className="document-skeleton" /></div>;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="No hay facturas registradas" detail="Las facturas aparecerán después de confirmar una orden." />;
  return <div className="document-list">{query.data.map((invoice) => <article className="document-row" key={invoice.id}><Receipt size={22} /><div><strong>{invoice.invoice_number}</strong><span>{invoice.date}</span></div><span className={`status ${invoice.state}`}>{invoice.payment_display}</span><strong>{money(invoice.total)}</strong></article>)}</div>;
}

import { ArrowLeft, ArrowRight, CheckCircle, FileText, Package } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CustomerForm } from "../components/CustomerForm";
import { ApiError, api, money } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Customer } from "../types";

export function QuotePage() {
  const navigate = useNavigate();
  const { cart, customer, lastQuote, setCustomer, setLastQuote, clearCart, notify } = useStore();
  const [step, setStep] = useState(lastQuote ? 3 : 1);
  const quoteMutation = useMutation({ mutationFn: () => api.createQuote(customer!, cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity }))) });
  const convertMutation = useMutation({ mutationFn: () => api.convertQuote(lastQuote!.quote_id, lastQuote!.customer_email) });
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const saveCustomer = async (values: Customer) => { setCustomer(values); setStep(2); };
  const createQuote = async () => {
    try { const response = await quoteMutation.mutateAsync(); setLastQuote(response.data); setStep(3); }
    catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible crear la cotización.", "error"); }
  };
  const convert = async () => {
    try { const response = await convertMutation.mutateAsync(); clearCart(); setLastQuote(null); notify(response.data.invoice_warning || `Orden ${response.data.order_number} confirmada.`, response.data.invoice_warning ? "error" : "success"); navigate(`/pedidos/${response.data.sale_order_id}?email=${encodeURIComponent(response.data.customer_email)}`); }
    catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible convertir la cotización.", "error"); }
  };
  if (!cart.length && !lastQuote) return <section className="page-shell page-top"><div className="state-panel"><Package size={38} /><h1>No hay productos para cotizar</h1><p>Agrega productos al carrito antes de continuar.</p><Link className="button-primary" to="/catalogo">Ir al catálogo</Link></div></section>;
  return <section className="quote-page page-shell page-top">
    <header className="page-title"><p className="overline">Cotización web</p><h1>Revisa y confirma tu solicitud.</h1></header>
    <ol className="stepper"><li className={step >= 1 ? "active" : ""}>Cliente</li><li className={step >= 2 ? "active" : ""}>Revisión</li><li className={step >= 3 ? "active" : ""}>Cotización</li></ol>
    {step === 1 && <div className="quote-stage"><div><h2>¿A nombre de quién cotizamos?</h2><p>Los datos quedarán asociados al contacto en Odoo.</p></div><div className="form-panel"><CustomerForm defaultValues={customer} buttonLabel="Revisar cotización" onSubmit={saveCustomer} /></div></div>}
    {step === 2 && <div className="quote-review"><div className="review-lines"><h2>Productos seleccionados</h2>{cart.map((line) => <article key={line.product.id}><img src={line.product.image_url} alt="" /><div><strong>{line.product.name}</strong><span>{line.quantity} × {money(line.product.price)}</span></div><strong>{money(line.quantity * line.product.price)}</strong></article>)}</div><aside><FileText size={28} /><h2>Resumen de cotización</h2><dl><div><dt>Cliente</dt><dd>{customer?.name}</dd></div><div><dt>Correo</dt><dd>{customer?.email}</dd></div><div><dt>Total estimado</dt><dd>{money(total)}</dd></div></dl><p>Odoo verificará los precios oficiales antes de guardar el documento.</p><button className="button-primary" onClick={createQuote} disabled={quoteMutation.isPending}>{quoteMutation.isPending ? "Consultando Odoo..." : <>Guardar cotización <ArrowRight size={17} /></>}</button><button className="button-text" onClick={() => setStep(1)}><ArrowLeft size={15} />Editar cliente</button></aside></div>}
    {step === 3 && lastQuote && <div className="quote-success"><CheckCircle size={52} /><p className="overline">Cotización creada</p><h2>{lastQuote.quote_number}</h2><p>El documento está guardado en Odoo como cotización. Puedes confirmarlo ahora o consultarlo después en tu portal.</p><dl><div><dt>Estado</dt><dd>Cotización</dd></div><div><dt>Total oficial</dt><dd>{money(lastQuote.total)}</dd></div></dl><button className="button-primary" onClick={convert} disabled={convertMutation.isPending}>{convertMutation.isPending ? "Confirmando en Odoo..." : "Convertir en orden"}</button><Link className="button-secondary" to={`/cotizaciones/${lastQuote.quote_id}?email=${encodeURIComponent(lastQuote.customer_email)}`}>Ver detalle</Link></div>}
  </section>;
}

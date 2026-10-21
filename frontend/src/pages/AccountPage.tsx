import { CheckCircle, CreditCard, UserCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerForm } from "../components/CustomerForm";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PaymentCardForm, type PaymentCardValues } from "../components/PaymentCardForm";
import { ApiError, api } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Customer } from "../types";

export function AccountPage() {
  const customer = useStore((state) => state.customer);
  const setCustomer = useStore((state) => state.setCustomer);
  const notify = useStore((state) => state.notify);
  const queryClient = useQueryClient();
  const registration = useMutation({ mutationFn: api.registerCustomer });
  const cards = useQuery({ queryKey: ["payment-methods", customer?.email], queryFn: () => api.paymentMethods(customer!.email), enabled: Boolean(customer?.email) });
  const submit = async (values: Customer) => {
    try { await registration.mutateAsync(values); setCustomer(values); notify("Tus datos quedaron registrados en Odoo."); }
    catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible registrar el cliente.", "error"); }
  };
  const addCard = async (values: PaymentCardValues) => {
    if (!customer) return;
    try {
      await api.addPaymentMethod({
        email: customer.email, holder_name: values.holder_name, card_number: values.card_number,
        expiry_month: Number(values.expiry_month), expiry_year: Number(values.expiry_year), cvv: values.cvv
      });
      await queryClient.invalidateQueries({ queryKey: ["payment-methods", customer.email] });
      notify("Tarjeta adjuntada. El número completo y el CVV no se guardaron.");
    } catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible adjuntar la tarjeta.", "error"); throw error; }
  };
  return <section className="account-stack page-shell page-top">
    <Breadcrumbs items={[{ label: "Mi cuenta" }]} />
    <div className="account-page"><div className="account-intro"><UserCircle size={38} /><p className="overline">Datos del cliente</p><h1>{customer ? "Actualiza tu información." : "Crea tu cuenta."}</h1><p>Usaremos estos datos para crear tus cotizaciones y relacionar tus pedidos dentro de Odoo.</p>{customer && <div className="alert alert-success alert-soft saved-customer"><CheckCircle size={18} /><span>Hay una cuenta guardada para <strong>{customer.email}</strong></span></div>}</div><div className="card card-border form-panel"><CustomerForm defaultValues={customer} buttonLabel={customer ? "Actualizar datos" : "Crear cuenta"} busyLabel="Registrando en Odoo..." onSubmit={submit} /></div></div>
    {customer && <section className="payment-settings"><div><CreditCard size={34} /><p className="overline">Métodos de pago</p><h2>Tarjetas adjuntas.</h2><p>Este módulo es exclusivamente educativo. Todas las tarjetas válidas tienen saldo ilimitado y sus pagos se registran como simulados.</p><div className="saved-cards">{cards.isLoading && <div className="skeleton saved-card-skeleton" />}{cards.data?.map((card, index) => <article className="card card-border" key={card.id}><div className="card-brand-mark">{card.brand.slice(0, 1)}</div><div><strong>{card.brand} •••• {card.last4}</strong><span>{card.holder_name} · vence {String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}</span></div>{index === 0 && <span className="badge badge-info badge-soft">Predeterminada</span>}</article>)}{cards.isSuccess && !cards.data.length && <div className="alert alert-soft empty-card-note"><CreditCard size={19} /><span>Aún no hay tarjetas adjuntas.</span></div>}</div></div><div className="card card-border form-panel"><PaymentCardForm onSubmit={addCard} /></div></section>}
  </section>;
}

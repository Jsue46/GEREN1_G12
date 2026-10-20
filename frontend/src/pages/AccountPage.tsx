import { CheckCircle, UserCircle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { CustomerForm } from "../components/CustomerForm";
import { ApiError, api } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Customer } from "../types";

export function AccountPage() {
  const customer = useStore((state) => state.customer);
  const setCustomer = useStore((state) => state.setCustomer);
  const notify = useStore((state) => state.notify);
  const registration = useMutation({ mutationFn: api.registerCustomer });
  const submit = async (values: Customer) => {
    try { await registration.mutateAsync(values); setCustomer(values); notify("Tus datos quedaron registrados en Odoo."); }
    catch (error) { notify(error instanceof ApiError ? error.message : "No fue posible registrar el cliente.", "error"); }
  };
  return <section className="account-page page-shell page-top"><div className="account-intro"><UserCircle size={38} /><p className="overline">Datos del cliente</p><h1>{customer ? "Actualiza tu información." : "Crea tu cuenta."}</h1><p>Usaremos estos datos para crear tus cotizaciones y relacionar tus pedidos dentro de Odoo.</p>{customer && <div className="saved-customer"><CheckCircle size={18} /><span>Hay una cuenta guardada para <strong>{customer.email}</strong></span></div>}</div><div className="form-panel"><CustomerForm defaultValues={customer} buttonLabel={customer ? "Actualizar datos" : "Crear cuenta"} busyLabel="Registrando en Odoo..." onSubmit={submit} /></div></section>;
}

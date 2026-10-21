import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Customer } from "../types";

const customerSchema = z.object({
  name: z.string().trim().min(3, "Ingresa tu nombre completo."),
  email: z.email("Ingresa un correo válido."),
  phone: z.string().trim().min(8, "Ingresa un teléfono válido."),
  address: z.string().trim().min(6, "Ingresa una dirección completa."),
  city: z.string().trim().min(2, "Ingresa tu ciudad.")
});

interface Props {
  defaultValues?: Customer | null;
  buttonLabel: string;
  busyLabel?: string;
  onSubmit: (customer: Customer) => Promise<void>;
}

export function CustomerForm({ defaultValues, buttonLabel, busyLabel = "Guardando...", onSubmit }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Customer>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultValues ?? { name: "", email: "", phone: "", address: "", city: "Guatemala" }
  });
  return <form className="customer-form" onSubmit={handleSubmit(onSubmit)} noValidate>
    <Field id="customer-name" label="Nombre completo" error={errors.name?.message}><input id="customer-name" className={`input input-sm validator ${errors.name ? "input-error" : ""}`} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby="customer-name-hint" {...register("name")} /></Field>
    <Field id="customer-email" label="Correo electrónico" error={errors.email?.message}><input id="customer-email" className={`input input-sm validator ${errors.email ? "input-error" : ""}`} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby="customer-email-hint" {...register("email")} /></Field>
    <Field id="customer-phone" label="Teléfono" error={errors.phone?.message}><input id="customer-phone" className={`input input-sm validator ${errors.phone ? "input-error" : ""}`} type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby="customer-phone-hint" {...register("phone")} /></Field>
    <Field id="customer-city" label="Ciudad" error={errors.city?.message}><input id="customer-city" className={`input input-sm validator ${errors.city ? "input-error" : ""}`} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} aria-describedby="customer-city-hint" {...register("city")} /></Field>
    <Field id="customer-address" label="Dirección" error={errors.address?.message} wide><input id="customer-address" className={`input input-sm validator ${errors.address ? "input-error" : ""}`} autoComplete="street-address" aria-invalid={Boolean(errors.address)} aria-describedby="customer-address-hint" {...register("address")} /></Field>
    <button className="btn btn-primary form-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="loading loading-spinner loading-sm" />{busyLabel}</> : buttonLabel}</button>
  </form>;
}

function Field({ id, label, error, wide, children }: { id: string; label: string; error?: string; wide?: boolean; children: ReactElement }) {
  return <fieldset className={wide ? "fieldset form-field wide" : "fieldset form-field"}><label className="fieldset-legend" htmlFor={id}>{label}</label>{children}<small id={`${id}-hint`} className={`validator-hint field-hint ${error ? "has-error" : ""}`} aria-live="polite">{error ?? " "}</small></fieldset>;
}

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
    <Field label="Nombre completo" error={errors.name?.message}><input autoComplete="name" {...register("name")} /></Field>
    <Field label="Correo electrónico" error={errors.email?.message}><input type="email" autoComplete="email" {...register("email")} /></Field>
    <Field label="Teléfono" error={errors.phone?.message}><input type="tel" autoComplete="tel" {...register("phone")} /></Field>
    <Field label="Ciudad" error={errors.city?.message}><input autoComplete="address-level2" {...register("city")} /></Field>
    <Field label="Dirección" error={errors.address?.message} wide><input autoComplete="street-address" {...register("address")} /></Field>
    <button className="button-primary form-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? busyLabel : buttonLabel}</button>
  </form>;
}

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: ReactElement }) {
  return <label className={wide ? "form-field wide" : "form-field"}><span>{label}</span>{children}{error ? <small>{error}</small> : <small aria-hidden="true">&nbsp;</small>}</label>;
}

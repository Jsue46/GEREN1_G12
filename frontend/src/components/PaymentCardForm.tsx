import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Info, ShieldCheck } from "@phosphor-icons/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const cardSchema = z.object({
  holder_name: z.string().trim().min(3, "Ingresa el nombre del titular."),
  card_number: z.string().regex(/^[\d\s-]{13,25}$/, "Ingresa un número de tarjeta válido."),
  expiry_month: z.string().regex(/^([1-9]|1[0-2])$/, "Mes inválido."),
  expiry_year: z.string().regex(/^\d{4}$/, "Año inválido.").refine((value) => Number(value) >= currentYear && Number(value) <= currentYear + 30, "Año inválido."),
  cvv: z.string().regex(/^\d{3,4}$/, "El CVV debe tener 3 o 4 dígitos.")
}).superRefine((values, context) => {
  if (Number(values.expiry_year) === currentYear && Number(values.expiry_month) < currentMonth) context.addIssue({ code: "custom", path: ["expiry_month"], message: "La tarjeta ya venció." });
});

export type PaymentCardValues = z.infer<typeof cardSchema>;

export function PaymentCardForm({ onSubmit }: { onSubmit: (values: PaymentCardValues) => Promise<void> }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PaymentCardValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { holder_name: "", card_number: "", expiry_month: "12", expiry_year: String(currentYear + 2), cvv: "" }
  });
  const submit = async (values: PaymentCardValues) => { await onSubmit(values); reset(); };
  return <form className="payment-card-form" onSubmit={handleSubmit(submit)} noValidate>
    <div className="card-form-heading"><CreditCard size={25} /><div><strong>Tarjeta</strong><span>Simula pagos sin límite de saldo.</span></div></div>
    <fieldset className="fieldset form-field wide"><label className="fieldset-legend" htmlFor="card-holder">Nombre del titular</label><input id="card-holder" className={`input input-sm validator ${errors.holder_name ? "input-error" : ""}`} autoComplete="cc-name" aria-invalid={Boolean(errors.holder_name)} {...register("holder_name")} /><small className={`field-hint ${errors.holder_name ? "has-error" : ""}`}>{errors.holder_name?.message ?? "Tal como aparece en la tarjeta."}</small></fieldset>
    <fieldset className="fieldset form-field wide"><label className="fieldset-legend" htmlFor="card-number">Número de tarjeta</label><input id="card-number" className={`input input-sm validator ${errors.card_number ? "input-error" : ""}`} inputMode="numeric" autoComplete="cc-number" maxLength={25} placeholder="4242 4242 4242 4242" aria-invalid={Boolean(errors.card_number)} {...register("card_number")} /><small className={`field-hint ${errors.card_number ? "has-error" : ""}`}>{errors.card_number?.message ?? "Para pruebas puedes usar 4242 4242 4242 4242."}</small></fieldset>
    <fieldset className="fieldset form-field"><label className="fieldset-legend" htmlFor="card-month">Mes</label><input id="card-month" className={`input input-sm validator ${errors.expiry_month ? "input-error" : ""}`} type="number" inputMode="numeric" autoComplete="cc-exp-month" min="1" max="12" aria-invalid={Boolean(errors.expiry_month)} {...register("expiry_month")} /><small className={`field-hint ${errors.expiry_month ? "has-error" : ""}`}>{errors.expiry_month?.message ?? "MM"}</small></fieldset>
    <fieldset className="fieldset form-field"><label className="fieldset-legend" htmlFor="card-year">Año</label><input id="card-year" className={`input input-sm validator ${errors.expiry_year ? "input-error" : ""}`} type="number" inputMode="numeric" autoComplete="cc-exp-year" min={currentYear} max={currentYear + 30} aria-invalid={Boolean(errors.expiry_year)} {...register("expiry_year")} /><small className={`field-hint ${errors.expiry_year ? "has-error" : ""}`}>{errors.expiry_year?.message ?? "AAAA"}</small></fieldset>
    <fieldset className="fieldset form-field wide"><label className="fieldset-legend" htmlFor="card-cvv">CVV <span className="tooltip tooltip-right" data-tip="Código de 3 o 4 dígitos de la tarjeta"><Info size={14} aria-hidden="true" /></span></label><input id="card-cvv" className={`input input-sm validator ${errors.cvv ? "input-error" : ""}`} type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} aria-invalid={Boolean(errors.cvv)} {...register("cvv")} /><small className={`field-hint ${errors.cvv ? "has-error" : ""}`}>{errors.cvv?.message ?? "Se valida y se descarta inmediatamente."}</small></fieldset>
    <div className="alert alert-info alert-soft card-security" role="alert"><ShieldCheck size={18} /><span>Solo guardamos marca, últimos 4 dígitos y vencimiento. No es un cobro bancario real.</span></div>
    <button className="btn btn-primary form-submit" disabled={isSubmitting}>{isSubmitting ? <><span className="loading loading-spinner loading-sm" />Protegiendo tarjeta</> : "Adjuntar tarjeta"}</button>
  </form>;
}

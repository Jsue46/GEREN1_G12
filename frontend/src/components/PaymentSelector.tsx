import type { PaymentMethod } from "../types";

interface Props {
  cards: PaymentMethod[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function PaymentSelector({ cards, value, onChange, label = "Tarjeta para pago simulado" }: Props) {
  if (!cards.length) return null;
  return <label className="payment-selector"><span>{label}</span><select className="select select-sm" value={value} onChange={(event) => onChange(event.target.value)}>{cards.map((card) => <option value={card.id} key={card.id}>{card.brand} •••• {card.last4} — {String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}</option>)}</select></label>;
}

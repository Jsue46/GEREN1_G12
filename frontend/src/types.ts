export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image_url: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

export interface PaymentMethod {
  id: string;
  email: string;
  holder_name: string;
  brand: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  created_at: string;
}

export interface SimulatedPayment {
  id: string;
  receipt: string;
  amount: number;
  currency: string;
  status: "approved";
  sale_order_id: number;
  order_number: string;
  invoice_id: number | null;
  created_at: string;
  card: { brand: string; last4: string };
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface PurchaseLine {
  id: number;
  name: string;
  image_url?: string;
  quantity: number;
  price: number;
}

export interface QuoteResult {
  quote_id: number;
  quote_number: string;
  state: string;
  crm_lead_id: number;
  customer_id: number;
  customer_email: string;
  total: number;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  date: string;
  total: number;
  state: string;
  state_display: string;
  has_delivery: boolean;
}

export interface InvoiceSummary {
  id: number;
  invoice_number: string;
  date: string;
  total: number;
  state: string;
  state_display: string;
  payment_state: string;
  payment_display: string;
  simulated_payment?: boolean;
}

export interface OrderDetail extends OrderSummary {
  subtotal: number;
  tax: number;
  lines: Array<{
    id: number;
    name: string;
    product_id: number | null;
    quantity: number;
    price_unit: number;
    subtotal: number;
  }>;
}

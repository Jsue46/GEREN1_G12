import type { Customer, InvoiceSummary, OrderDetail, OrderSummary, Product, QuoteResult } from "../types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      signal: init.signal ?? controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new ApiError(data.detail || data.message || "No fue posible completar la solicitud.", response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Odoo tardó demasiado en responder. Intenta nuevamente.", 408);
    }
    throw new ApiError("No hay conexión con el servicio de GamerZone.", 0);
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  products: async () => {
    const data = await request<{ success: true; count: number; products: Product[] }>("/api/products?limit=60");
    return data.products;
  },
  health: () => request<{ success: true; status: string; odoo: { uid: number; server_version: string } }>("/api/health"),
  registerCustomer: (customer: Customer) => request<{ success: true; customer: Customer & { id: number } }>("/api/customers", {
    method: "POST", body: JSON.stringify(customer)
  }),
  createQuote: (customer: Customer, items: Array<{ product_id: number; quantity: number }>) =>
    request<{ success: true; data: QuoteResult }>("/api/quotes", {
      method: "POST", body: JSON.stringify({ customer, items })
    }),
  convertQuote: (quoteId: number, email: string) => request<{ success: true; data: {
    sale_order_id: number; order_number: string; order_state: string; total: number;
    invoice: { id: number; name: string } | null; invoice_warning: string | null; customer_email: string;
  } }>(`/api/quotes/${quoteId}/convert`, { method: "POST", body: JSON.stringify({ email }) }),
  orders: async (email: string) => {
    const data = await request<{ success: true; orders: OrderSummary[] }>(`/api/portal/orders?email=${encodeURIComponent(email)}`);
    return data.orders;
  },
  invoices: async (email: string) => {
    const data = await request<{ success: true; invoices: InvoiceSummary[] }>(`/api/portal/invoices?email=${encodeURIComponent(email)}`);
    return data.invoices;
  },
  orderDetail: async (orderId: number, email: string) => {
    const data = await request<{ success: true; order: OrderDetail }>(`/api/portal/orders/${orderId}?email=${encodeURIComponent(email)}`);
    return data.order;
  }
};

export const money = (value: number) => new Intl.NumberFormat("es-GT", {
  style: "currency", currency: "GTQ", maximumFractionDigits: 2
}).format(value);

export const categoryLabel = (category: string) => {
  const raw = category.split("/").map((part) => part.trim()).filter(Boolean).at(-1) || "General";
  return ({ all: "Otros", mouses: "Mouse" } as Record<string, string>)[raw.toLowerCase()] || raw;
};

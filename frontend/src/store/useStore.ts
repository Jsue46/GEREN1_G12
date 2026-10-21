import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Customer, Product, QuoteResult } from "../types";

interface Notice { message: string; tone: "success" | "error" }

interface StoreState {
  cart: CartLine[];
  customer: Customer | null;
  lastQuote: QuoteResult | null;
  cartOpen: boolean;
  notice: Notice | null;
  addProduct: (product: Product, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  removeProduct: (productId: number) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer) => void;
  setLastQuote: (quote: QuoteResult | null) => void;
  setCartOpen: (open: boolean) => void;
  notify: (message: string, tone?: Notice["tone"]) => void;
  clearNotice: () => void;
}

export const useStore = create<StoreState>()(persist((set) => ({
  cart: [], customer: null, lastQuote: null, cartOpen: false, notice: null,
  addProduct: (product, quantity = 1) => set((state) => {
    const available = Math.max(0, Math.floor(product.stock));
    if (!available) return { notice: { message: `${product.name} no tiene existencias disponibles.`, tone: "error" } };
    const existing = state.cart.find((line) => line.product.id === product.id);
    const cart = existing
      ? state.cart.map((line) => line.product.id === product.id ? { ...line, product, quantity: Math.min(available, line.quantity + quantity) } : line)
      : [...state.cart, { product, quantity: Math.min(available, quantity) }];
    return { cart, notice: { message: `${product.name} se agregó al carrito.`, tone: "success" } };
  }),
  setQuantity: (productId, quantity) => set((state) => {
    const line = state.cart.find((item) => item.product.id === productId);
    const available = Math.max(0, Math.floor(line?.product.stock ?? 0));
    return { cart: quantity < 1 || !available
      ? state.cart.filter((item) => item.product.id !== productId)
      : state.cart.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(available, quantity) } : item) };
  }),
  removeProduct: (productId) => set((state) => ({ cart: state.cart.filter((line) => line.product.id !== productId) })),
  clearCart: () => set({ cart: [] }),
  setCustomer: (customer) => set({ customer }),
  setLastQuote: (lastQuote) => set({ lastQuote }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  notify: (message, tone = "success") => set({ notice: { message, tone } }),
  clearNotice: () => set({ notice: null })
}), {
  name: "gamerzone-store-v3",
  partialize: (state) => ({ cart: state.cart, customer: state.customer, lastQuote: state.lastQuote })
}));

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
    const existing = state.cart.find((line) => line.product.id === product.id);
    const cart = existing
      ? state.cart.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line)
      : [...state.cart, { product, quantity }];
    return { cart, notice: { message: `${product.name} se agregó al carrito.`, tone: "success" } };
  }),
  setQuantity: (productId, quantity) => set((state) => ({
    cart: quantity < 1 ? state.cart.filter((line) => line.product.id !== productId) : state.cart.map((line) => line.product.id === productId ? { ...line, quantity: Math.min(99, quantity) } : line)
  })),
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

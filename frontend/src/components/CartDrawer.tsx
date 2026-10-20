import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, ShoppingBag, Trash, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { money } from "../lib/api";
import { useStore } from "../store/useStore";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQuantity, removeProduct } = useStore();
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return <Dialog.Root open={cartOpen} onOpenChange={setCartOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className="drawer-overlay" />
      <Dialog.Content className="cart-drawer" aria-describedby="cart-description">
        <header><div><span>Tu selección</span><Dialog.Title>Carrito de compras</Dialog.Title></div><Dialog.Close className="icon-button"><X size={22} /></Dialog.Close></header>
        <Dialog.Description id="cart-description">Revisa cantidades antes de generar tu cotización.</Dialog.Description>
        <div className="drawer-lines">
          {cart.length === 0 ? <div className="drawer-empty"><ShoppingBag size={36} /><h3>Tu carrito está vacío</h3><p>Explora el catálogo y agrega productos para cotizar.</p><Dialog.Close asChild><Link className="button-primary" to="/catalogo">Ver catálogo</Link></Dialog.Close></div> : cart.map(({ product, quantity }) => <article className="drawer-line" key={product.id}>
            <div className="drawer-thumb"><img src={product.image_url} alt="" /></div>
            <div><strong>{product.name}</strong><small>{money(product.price)} por unidad</small><div className="quantity-control"><button onClick={() => setQuantity(product.id, quantity - 1)} aria-label="Reducir cantidad"><Minus size={13} /></button><span>{quantity}</span><button onClick={() => setQuantity(product.id, quantity + 1)} aria-label="Aumentar cantidad"><Plus size={13} /></button></div></div>
            <div className="line-end"><strong>{money(product.price * quantity)}</strong><button className="remove-line" onClick={() => removeProduct(product.id)} aria-label={`Quitar ${product.name}`}><Trash size={16} /></button></div>
          </article>)}
        </div>
        {cart.length > 0 && <footer><div><span>Total estimado</span><strong>{money(total)}</strong></div><Dialog.Close asChild><Link className="button-primary" to="/cotizacion">Generar cotización</Link></Dialog.Close><Dialog.Close asChild><Link className="button-text" to="/carrito">Ver carrito completo</Link></Dialog.Close></footer>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

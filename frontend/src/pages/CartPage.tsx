import { ArrowLeft, Minus, Plus, ShoppingBag, Trash } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { money } from "../lib/api";
import { useStore } from "../store/useStore";

export function CartPage() {
  const { cart, setQuantity, removeProduct, clearCart } = useStore();
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return <section className="cart-page page-shell page-top">
    <header className="page-title"><p className="overline">Tu selección</p><h1>Carrito de compras.</h1><p>Modifica cantidades y revisa el total antes de solicitar tu cotización.</p></header>
    {cart.length === 0 ? <div className="state-panel"><ShoppingBag size={38} /><h2>Tu carrito está vacío</h2><p>Agrega productos del catálogo para comenzar.</p><Link className="button-primary" to="/catalogo">Explorar catálogo</Link></div> : <div className="cart-layout"><div className="cart-list">{cart.map(({ product, quantity }) => <article className="cart-row" key={product.id}>
      <Link className="cart-row-media" to={`/producto/${product.id}`}><img src={product.image_url} alt="" /></Link>
      <div><Link to={`/producto/${product.id}`}><h2>{product.name}</h2></Link><p>SKU {product.sku}</p><strong>{money(product.price)} por unidad</strong></div>
      <div className="quantity-control"><button onClick={() => setQuantity(product.id, quantity - 1)}><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(product.id, quantity + 1)}><Plus /></button></div>
      <div className="cart-row-end"><strong>{money(product.price * quantity)}</strong><button onClick={() => removeProduct(product.id)}><Trash size={18} />Quitar</button></div>
    </article>)}</div><aside className="cart-summary"><h2>Resumen</h2><div><span>Productos</span><strong>{cart.reduce((sum, line) => sum + line.quantity, 0)}</strong></div><div className="summary-total"><span>Total estimado</span><strong>{money(total)}</strong></div><p>El precio final será verificado nuevamente desde Odoo al crear la cotización.</p><Link className="button-primary" to="/cotizacion">Continuar</Link><button className="button-text danger" onClick={clearCart}>Vaciar carrito</button></aside></div>}
    <Link className="back-link" to="/catalogo"><ArrowLeft size={16} />Seguir comprando</Link>
  </section>;
}

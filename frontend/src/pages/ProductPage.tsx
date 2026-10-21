import { Minus, Plus, ShoppingBag } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorState, ProductSkeleton } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ProductCard } from "../components/ProductCard";
import { StockStatus } from "../components/StockStatus";
import { api, categoryLabel, money } from "../lib/api";
import { useStore } from "../store/useStore";

export function ProductPage() {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.products, staleTime: 60_000 });
  const product = productsQuery.data?.find((item) => item.id === Number(id));
  const addProduct = useStore((state) => state.addProduct);
  const setCartOpen = useStore((state) => state.setCartOpen);
  if (productsQuery.isLoading) return <section className="page-shell page-top"><ProductSkeleton count={1} /></section>;
  if (productsQuery.isError) return <section className="page-shell page-top"><ErrorState message={productsQuery.error.message} retry={() => productsQuery.refetch()} /></section>;
  if (!product) return <section className="page-shell page-top"><ErrorState message="El producto solicitado no existe o ya no está disponible." /></section>;
  const related = (productsQuery.data ?? []).filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const available = Math.max(0, Math.floor(product.stock));
  const add = () => { addProduct(product, quantity); if (available) setCartOpen(true); };
  return <>
    <section className="product-page page-shell page-top">
      <Breadcrumbs items={[{ label: "Catálogo", to: "/catalogo" }, { label: product.name }]} />
      <div className="product-detail">
        <div className="detail-media"><img src={product.image_url} alt={product.name} /></div>
        <div className="detail-copy"><p className="overline">{categoryLabel(product.category)}</p><h1>{product.name}</h1><p className="detail-sku">SKU {product.sku}</p><p className="detail-description">{product.description || "Producto seleccionado por GamerZone con garantía y soporte para tu configuración."}</p><StockStatus stock={product.stock} detailed /><strong className="detail-price">{money(product.price)}</strong><div className="detail-buy"><div className="join quantity-control"><button className="btn btn-ghost btn-xs join-item" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Reducir cantidad"><Minus /></button><span className="join-item" aria-live="polite">{quantity}</span><button className="btn btn-ghost btn-xs join-item" disabled={quantity >= available} onClick={() => setQuantity((value) => Math.min(available, value + 1))} aria-label="Aumentar cantidad"><Plus /></button></div><button className="btn btn-primary" onClick={add} disabled={!available}><ShoppingBag size={19} />{available ? "Agregar al carrito" : "Sin existencias"}</button></div><ul className="purchase-notes"><li>Precio oficial obtenido desde Odoo</li><li>La existencia se valida nuevamente al comprar</li><li>La cotización no reserva ni descuenta inventario</li></ul></div>
      </div>
    </section>
    {related.length > 0 && <section className="related-section page-shell"><header className="section-heading"><div><p className="overline">También puede interesarte</p><h2>Productos relacionados</h2></div></header><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </>;
}

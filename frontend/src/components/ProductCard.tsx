import { ArrowRight, ShoppingBag } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { categoryLabel, money } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Product } from "../types";

export function ProductCard({ product }: { product: Product }) {
  const addProduct = useStore((state) => state.addProduct);
  return <motion.article className="product-card" layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ duration: .25 }}>
    <Link className="product-media" to={`/producto/${product.id}`} aria-label={`Ver ${product.name}`}>
      <img src={product.image_url} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add("image-missing"); }} />
      <span>{product.name.slice(0, 2).toUpperCase()}</span>
    </Link>
    <div className="product-meta"><span>{categoryLabel(product.category)}</span><span className={product.stock > 0 ? "stock-ok" : "stock-request"}>{product.stock > 0 ? `${product.stock} disponibles` : "Bajo pedido"}</span></div>
    <Link className="product-name" to={`/producto/${product.id}`}>{product.name}</Link>
    <p className="product-sku">SKU {product.sku}</p>
    <p className="product-description">{product.description || "Garantía oficial y compatibilidad verificada por GamerZone."}</p>
    <div className="product-action"><strong>{money(product.price)}</strong><button type="button" onClick={() => addProduct(product)}><ShoppingBag size={17} />Agregar</button></div>
    <Link className="product-detail-link" to={`/producto/${product.id}`}>Ver detalles <ArrowRight size={14} /></Link>
  </motion.article>;
}

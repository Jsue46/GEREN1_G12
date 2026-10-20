import { ArrowRight, Headset, Package, Receipt, Truck } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, ProductSkeleton } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { api, categoryLabel } from "../lib/api";
import type { Product } from "../types";

const priority = ["aud", "tecl", "mouse", "control", "monitor", "silla"];

export function HomePage() {
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.products, staleTime: 60_000 });
  const products = productsQuery.data ?? [];
  const categories = categoryProducts(products);
  return <>
    <section className="home-hero page-shell">
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <p className="overline">Tecnología gamer con respaldo real</p>
        <h1>Hardware serio para jugar mejor.</h1>
        <p>Componentes y periféricos con stock actualizado, precios oficiales y cotización directa desde la web.</p>
        <div className="hero-actions"><Link className="button-primary" to="/catalogo">Explorar catálogo <ArrowRight size={18} /></Link><Link className="text-link" to="/cuenta">Crear cuenta</Link></div>
        <ul className="hero-facts"><li>Precios en quetzales</li><li>Stock desde Odoo</li><li>Cotización inmediata</li></ul>
      </motion.div>
      <motion.div className="hero-media" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .65 }}>
        <img src="/store/assets/gamerzone-hero.webp" alt="Teclado, audífonos, control y mouse gamer" fetchPriority="high" />
        <div className="hero-count"><strong>{productsQuery.isLoading ? "..." : products.length}</strong><span>productos disponibles</span></div>
      </motion.div>
    </section>

    <section className="category-section page-shell">
      <header className="section-heading"><div><p className="overline">Encuentra lo que necesitas</p><h2>Compra por categoría</h2></div><Link to="/catalogo">Ver todo <ArrowRight size={15} /></Link></header>
      {productsQuery.isError ? <ErrorState message={productsQuery.error.message} retry={() => productsQuery.refetch()} /> : productsQuery.isLoading ? <div className="category-grid category-loading">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : categories.length ? <div className="category-grid">{categories.map(({ category, product }) => <Link className="category-card" key={category} to={`/catalogo?categoria=${encodeURIComponent(category)}`}>
        <span><img src={product.image_url} alt="" /></span><strong>{categoryLabel(category)}</strong><small>Explorar categoría</small>
      </Link>)}</div> : <EmptyState title="No hay categorías disponibles" detail="El catálogo de Odoo no devolvió productos." />}
    </section>

    <section className="promo-section page-shell">
      <article className="promo-main"><div><p className="overline">Todo para tu espacio</p><h2>Arma tu setup completo.</h2><p>Combina periféricos, audio y controles dentro de una misma cotización.</p><Link className="button-primary" to="/catalogo">Ver productos</Link></div></article>
      <article className="promo-side"><div><p className="overline">Compra personal o empresarial</p><h2>Cotiza desde la web.</h2><p>Tu solicitud queda registrada directamente en Odoo.</p><Link className="button-secondary" to="/carrito">Empezar cotización</Link></div></article>
    </section>

    <section className="featured-section page-shell">
      <header className="section-heading"><div><p className="overline">Selección disponible</p><h2>Equipo recomendado</h2><p>{products.length ? `${products.length} productos sincronizados con el ERP` : "Consultando catálogo"}</p></div><Link to="/catalogo">Catálogo completo <ArrowRight size={15} /></Link></header>
      {productsQuery.isLoading ? <ProductSkeleton count={8} /> : productsQuery.isError ? <ErrorState message={productsQuery.error.message} retry={() => productsQuery.refetch()} /> : <div className="product-grid">{products.slice(0, 8).map((product) => <ProductCard product={product} key={product.id} />)}</div>}
    </section>

    <section className="trust-section page-shell">
      <div><p className="overline">Soporte y confianza</p><h2>Compra con respaldo real.</h2><p>La información viaja desde la tienda hasta Odoo sin volver a ingresarla manualmente.</p><Link className="button-primary" to="/portal">Ir a mi portal</Link></div>
      <div className="trust-list"><Trust icon={<Package />} title="Stock sincronizado" detail="Disponibilidad actualizada desde Odoo." /><Trust icon={<Receipt />} title="Cotización integrada" detail="Productos, cliente y precios oficiales." /><Trust icon={<Truck />} title="Seguimiento de pedidos" detail="Consulta órdenes y facturas con tu correo." /><Trust icon={<Headset />} title="Soporte directo" detail="Un flujo claro antes y después de comprar." /></div>
    </section>
  </>;
}

function categoryProducts(products: Product[]) {
  const grouped = new Map<string, Product>();
  products.forEach((product) => {
    const category = product.category || "General";
    if (!["all", "general", "todos"].includes(categoryLabel(category).toLowerCase()) && !grouped.has(category)) grouped.set(category, product);
  });
  return [...grouped.entries()].sort(([a], [b]) => {
    const ai = priority.findIndex((term) => a.toLowerCase().includes(term));
    const bi = priority.findIndex((term) => b.toLowerCase().includes(term));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }).slice(0, 6).map(([category, product]) => ({ category, product }));
}

function Trust({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <article><span>{icon}</span><div><h3>{title}</h3><p>{detail}</p></div></article>;
}

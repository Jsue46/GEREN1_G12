import { FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, ProductSkeleton } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { api, categoryLabel } from "../lib/api";

export function CatalogPage() {
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: api.products, staleTime: 60_000 });
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(12);
  const search = params.get("q") ?? "";
  const category = params.get("categoria") ?? "Todos";
  const order = params.get("orden") ?? "featured";
  const products = productsQuery.data ?? [];
  const categories = useMemo(() => ["Todos", ...new Set(products.map((product) => product.category))], [products]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    const result = products.filter((product) => (category === "Todos" || product.category === category) && `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase("es").includes(term));
    return [...result].sort((a, b) => order === "price-asc" ? a.price - b.price : order === "price-desc" ? b.price - a.price : order === "name" ? a.name.localeCompare(b.name) : 0);
  }, [products, search, category, order]);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); value && value !== "Todos" && value !== "featured" ? next.set(key, value) : next.delete(key); setParams(next); setLimit(12); };

  return <section className="catalog-page page-shell page-top">
    <header className="page-title"><p className="overline">Catálogo GamerZone</p><h1>Encuentra tu próximo equipo.</h1><p>Precios y existencias consultados directamente desde Odoo.</p></header>
    <div className="catalog-toolbar">
      <label className="catalog-search"><MagnifyingGlass size={19} /><input value={search} onChange={(event) => update("q", event.target.value)} placeholder="Buscar por producto o SKU" /></label>
      <label className="select-control"><FunnelSimple size={18} /><select value={order} onChange={(event) => update("orden", event.target.value)} aria-label="Ordenar productos"><option value="featured">Recomendados</option><option value="price-asc">Precio menor</option><option value="price-desc">Precio mayor</option><option value="name">Nombre</option></select></label>
    </div>
    <div className="category-tabs" aria-label="Categorías">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => update("categoria", item)}>{item === "Todos" ? item : categoryLabel(item)}</button>)}</div>
    <div className="catalog-count">{productsQuery.isLoading ? "Consultando catálogo" : `${filtered.length} productos encontrados`}</div>
    {productsQuery.isLoading ? <ProductSkeleton count={12} /> : productsQuery.isError ? <ErrorState message={productsQuery.error.message} retry={() => productsQuery.refetch()} /> : filtered.length === 0 ? <EmptyState title="No encontramos coincidencias" detail="Prueba otra búsqueda o selecciona una categoría diferente." /> : <><div className="product-grid">{filtered.slice(0, limit).map((product) => <ProductCard key={product.id} product={product} />)}</div><div className="load-more"><span>Mostrando {Math.min(limit, filtered.length)} de {filtered.length}</span>{limit < filtered.length && <button className="button-secondary" onClick={() => setLimit((value) => value + 12)}>Ver más productos</button>}</div></>}
  </section>;
}

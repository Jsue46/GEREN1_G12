import { List, MagnifyingGlass, ShoppingBag, UserCircle, X } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { Brand } from "./Brand";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const count = useStore((state) => state.cart.reduce((sum, line) => sum + line.quantity, 0));
  const setCartOpen = useStore((state) => state.setCartOpen);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/catalogo${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
    setMobileOpen(false);
  };

  return <>
    <div className="service-strip"><span>Envíos a toda Guatemala</span><span>Inventario conectado con Odoo</span><NavLink to="/portal">Seguimiento de pedidos</NavLink></div>
    <header className="site-header">
      <Brand />
      <nav className={mobileOpen ? "main-nav is-open" : "main-nav"} aria-label="Navegación principal">
        <NavLink to="/catalogo">Catálogo</NavLink>
        <NavLink to="/cuenta">Crear cuenta</NavLink>
        <NavLink to="/portal">Mis pedidos</NavLink>
      </nav>
      <form className="header-search" role="search" onSubmit={submitSearch}>
        <MagnifyingGlass size={18} aria-hidden="true" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar productos o SKU" aria-label="Buscar productos" />
      </form>
      <div className="header-actions">
        <NavLink className="icon-button account-button" to="/cuenta" aria-label="Mi cuenta"><UserCircle size={22} /></NavLink>
        <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito con ${count} productos`}>
          <ShoppingBag size={20} /><span>Carrito</span><strong>{count}</strong>
        </button>
        <button className="icon-button menu-button" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Abrir menú">
          {mobileOpen ? <X size={22} /> : <List size={22} />}
        </button>
      </div>
    </header>
  </>;
}

import { House, Package, ShoppingBag, SquaresFour, UserCircle } from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import { useStore } from "../store/useStore";

export function MobileDock() {
  const count = useStore((state) => state.cart.reduce((sum, line) => sum + line.quantity, 0));
  const setCartOpen = useStore((state) => state.setCartOpen);
  return <nav className="dock dock-sm mobile-dock" aria-label="Navegación móvil">
    <NavLink to="/" end className={({ isActive }) => isActive ? "dock-active" : ""}><House size={20} /><span className="dock-label">Inicio</span></NavLink>
    <NavLink to="/catalogo" className={({ isActive }) => isActive ? "dock-active" : ""}><SquaresFour size={20} /><span className="dock-label">Catálogo</span></NavLink>
    <button type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito con ${count} productos`}><span className="indicator"><span className="indicator-item badge badge-primary badge-xs">{count}</span><ShoppingBag size={20} /></span><span className="dock-label">Carrito</span></button>
    <NavLink to="/portal" className={({ isActive }) => isActive ? "dock-active" : ""}><Package size={20} /><span className="dock-label">Pedidos</span></NavLink>
    <NavLink to="/cuenta" className={({ isActive }) => isActive ? "dock-active" : ""}><UserCircle size={20} /><span className="dock-label">Cuenta</span></NavLink>
  </nav>;
}

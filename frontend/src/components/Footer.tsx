import { EnvelopeSimple } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";

export function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand"><Brand /><p>Hardware y tecnología gamer con operaciones conectadas a Odoo.</p></div>
      <nav aria-label="Navegación de pie de página"><Link to="/catalogo">Catálogo</Link><Link to="/cuenta">Crear cuenta</Link><Link to="/portal">Mis pedidos</Link></nav>
      <a className="footer-contact" href="mailto:soporte@gamerzone.gt"><EnvelopeSimple size={20} /><span><small>Atención al cliente</small>soporte@gamerzone.gt</span></a>
    </div>
    <div className="footer-legal"><span>© 2026 GamerZone</span><span>Proyecto educativo</span><span>Pagos simulados · Sin cobros reales</span></div>
  </footer>;
}

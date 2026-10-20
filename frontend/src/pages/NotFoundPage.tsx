import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <section className="not-found page-shell page-top"><p className="overline">Error 404</p><h1>Esta página no está en el inventario.</h1><p>La dirección cambió o el contenido ya no se encuentra disponible.</p><Link className="button-primary" to="/">Volver al inicio <ArrowRight size={18} /></Link></section>;
}

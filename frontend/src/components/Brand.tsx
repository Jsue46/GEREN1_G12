import { Link } from "react-router-dom";

export function Brand() {
  return <Link className="brand" to="/" aria-label="GamerZone, ir al inicio">
    <span className="brand-mark" aria-hidden="true">GZ</span>
    <span>Gamer<span>Zone</span></span>
  </Link>;
}

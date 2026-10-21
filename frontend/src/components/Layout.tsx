import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileDock } from "./MobileDock";
import { Notification } from "./Notification";

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return <>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <Header />
    <main id="main-content"><Outlet /></main>
    <Footer />
    <CartDrawer />
    <Notification />
    <MobileDock />
  </>;
}

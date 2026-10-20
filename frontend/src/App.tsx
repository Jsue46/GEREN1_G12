import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

const AccountPage = lazy(() => import("./pages/AccountPage").then((module) => ({ default: module.AccountPage })));
const CartPage = lazy(() => import("./pages/CartPage").then((module) => ({ default: module.CartPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage").then((module) => ({ default: module.OrderDetailPage })));
const PortalPage = lazy(() => import("./pages/PortalPage").then((module) => ({ default: module.PortalPage })));
const ProductPage = lazy(() => import("./pages/ProductPage").then((module) => ({ default: module.ProductPage })));
const QuotePage = lazy(() => import("./pages/QuotePage").then((module) => ({ default: module.QuotePage })));

export default function App() {
  return <Suspense fallback={<div className="route-loader" role="status"><span />Cargando GamerZone…</div>}><Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="catalogo" element={<CatalogPage />} />
    <Route path="producto/:id" element={<ProductPage />} />
    <Route path="carrito" element={<CartPage />} />
    <Route path="cuenta" element={<AccountPage />} />
    <Route path="cotizacion" element={<QuotePage />} />
    <Route path="portal" element={<PortalPage />} />
    <Route path="pedidos/:id" element={<OrderDetailPage />} />
    <Route path="cotizaciones/:id" element={<OrderDetailPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></Suspense>;
}

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const baseURL = process.env.STORE_URL || "http://127.0.0.1:8000/store";
const output = resolve(process.cwd(), "../docs/capturas");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "es-GT",
  colorScheme: "dark"
});
const page = await context.newPage();
await mkdir(output, { recursive: true });

const customer = {
  name: "María Fernanda López",
  email: "maria.lopez@example.com",
  phone: "5555-1212",
  address: "7a avenida 10-20, zona 4",
  city: "Guatemala"
};
const quote = {
  quote_id: 120,
  quote_number: "S00120",
  state: "draft",
  crm_lead_id: 44,
  customer_id: 91,
  customer_email: customer.email,
  total: 1398
};
const order = {
  id: 120,
  order_number: "S00120",
  date: "2026-10-20 10:30:00",
  subtotal: 1248.21,
  tax: 149.79,
  total: 1398,
  state: "sale",
  state_display: "Orden confirmada",
  has_delivery: true,
  lines: [
    { id: 1, name: "HyperX Cloud II", product_id: 67, quantity: 2, price_unit: 699, subtotal: 1398 }
  ]
};

await page.route("**/api/customers", async (route) => {
  if (route.request().method() !== "POST") return route.continue();
  await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, customer: { id: 91, ...customer } }) });
});
await page.route("**/api/quotes", async (route) => {
  if (route.request().method() !== "POST") return route.continue();
  await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, data: quote }) });
});
await page.route("**/api/quotes/120/convert", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    success: true,
    data: { sale_order_id: 120, order_number: "S00120", order_state: "sale", total: 1398, invoice: { id: 31, name: "INV/2026/0031" }, invoice_warning: null, customer_email: customer.email }
  }) });
});
await page.route("**/api/portal/orders/120?*", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, order }) });
});
await page.route("**/api/portal/orders?*", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, orders: [
    { id: 120, order_number: "S00120", date: "2026-10-20 10:30:00", total: 1398, state: "sale", state_display: "Orden confirmada", has_delivery: true },
    { id: 119, order_number: "S00119", date: "2026-10-18 16:05:00", total: 2247, state: "draft", state_display: "Cotización", has_delivery: false }
  ] }) });
});
await page.route("**/api/portal/invoices?*", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, invoices: [
    { id: 31, invoice_number: "INV/2026/0031", date: "2026-10-20", total: 1398, state: "posted", state_display: "Emitida", payment_state: "not_paid", payment_display: "Pendiente de pago" }
  ] }) });
});

async function open(path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

async function capture(name, fullPage = true) {
  await page.screenshot({ path: resolve(output, name), fullPage, animations: "disabled" });
}

await open("/");
await page.locator(".product-card").first().waitFor();
await capture("01_inicio.png");

await open("/catalogo");
await page.locator(".product-card").first().waitFor();
await capture("02_catalogo.png");

await page.locator(".product-card .product-name").first().click();
await page.locator(".product-detail").waitFor();
await capture("07_detalle_producto.png", false);

await open("/catalogo");
await page.locator(".product-card .product-action button").first().click();
await page.locator(".cart-button").click();
await page.locator(".cart-drawer").waitFor();
await capture("02_carrito.png", false);
await page.keyboard.press("Escape");

await open("/cuenta");
await page.getByLabel("Nombre completo").fill(customer.name);
await page.getByLabel("Correo electrónico").fill(customer.email);
await page.getByLabel("Teléfono").fill(customer.phone);
await page.getByLabel("Ciudad").fill(customer.city);
await page.getByLabel("Dirección").fill(customer.address);
await page.getByRole("button", { name: "Crear cuenta" }).click();
await page.getByText("Tus datos quedaron registrados en Odoo.").waitFor();
await capture("03_registro_cliente.png", false);

await open("/cotizacion");
await page.getByRole("button", { name: "Revisar cotización" }).click();
await page.getByText("Resumen de cotización").waitFor();
await capture("04_generar_cotizacion.png", false);

await page.getByRole("button", { name: /Guardar cotización/ }).click();
await page.getByText("S00120").waitFor();
await capture("05_cotizacion_creada.png", false);

await page.getByRole("button", { name: "Convertir en orden" }).click();
await page.getByText("Orden confirmada en Odoo").waitFor();
await capture("06_orden_confirmada.png");

await open(`/portal?email=${encodeURIComponent(customer.email)}`);
await page.getByText("S00119").waitFor();
await capture("08_portal_pedidos.png", false);
await page.getByRole("button", { name: "Facturas" }).click();
await page.getByText("INV/2026/0031").waitFor();
await capture("09_portal_facturas.png", false);

await browser.close();
console.log(`Capturas actualizadas en ${output}`);

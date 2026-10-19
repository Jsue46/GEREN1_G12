// GamerZone Customer Portal Logic

const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    // Check if email passed in query string
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get("email");
    if (emailParam) {
        document.getElementById("portal-email").value = emailParam;
        searchCustomerData();
    }
});

let currentTab = "orders";

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    if (tab === 'orders') {
        document.getElementById("tab-orders-btn").classList.add("active");
        document.getElementById("orders-view").style.display = "block";
        document.getElementById("invoices-view").style.display = "none";
    } else {
        document.getElementById("tab-invoices-btn").classList.add("active");
        document.getElementById("orders-view").style.display = "none";
        document.getElementById("invoices-view").style.display = "block";
    }
}

async function searchCustomerData() {
    const email = document.getElementById("portal-email").value.trim();
    if (!email) {
        alert("Por favor ingresa un correo electrónico.");
        return;
    }

    const ordersContainer = document.getElementById("orders-list");
    const invoicesContainer = document.getElementById("invoices-list");
    
    ordersContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Consultando pedidos en Odoo ERP...</p>`;
    invoicesContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Consultando facturas en Odoo Contabilidad...</p>`;

    try {
        // Fetch Orders
        const ordResp = await fetch(`${API_BASE}/api/portal/orders?email=${encodeURIComponent(email)}`);
        const ordData = await ordResp.json();
        
        // Fetch Invoices
        const invResp = await fetch(`${API_BASE}/api/portal/invoices?email=${encodeURIComponent(email)}`);
        const invData = await invResp.json();

        // Render Orders
        if (ordData.success && ordData.orders && ordData.orders.length > 0) {
            ordersContainer.innerHTML = ordData.orders.map(o => `
                <div class="portal-card">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
                            <span style="font-family: 'Space Grotesk'; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${o.order_number}</span>
                            <span class="${o.state === 'sale' || o.state === 'done' ? 'badge-sale' : 'badge-draft'}">${o.state_display}</span>
                            ${o.has_delivery ? '<span style="font-size: 0.75rem; color: #38bdf8; background: rgba(56,189,248,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">🚚 Envío en Almacén</span>' : ''}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Fecha: ${o.date}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Monto Total</div>
                        <div style="font-family: 'Space Grotesk'; font-size: 1.3rem; font-weight: 700; color: var(--accent-cyan);">Q${o.total.toFixed(2)}</div>
                    </div>
                </div>
            `).join("");
        } else {
            ordersContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron órdenes para el correo <b>${email}</b>.</p>`;
        }

        // Render Invoices
        if (invData.success && invData.invoices && invData.invoices.length > 0) {
            invoicesContainer.innerHTML = invData.invoices.map(inv => `
                <div class="portal-card">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
                            <span style="font-family: 'Space Grotesk'; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${inv.invoice_number}</span>
                            <span class="badge-posted">${inv.state_display}</span>
                            <span style="font-size: 0.75rem; color: #fbbf24; background: rgba(245,158,11,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">💳 ${inv.payment_display}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Fecha emisión: ${inv.date}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Total Factura</div>
                        <div style="font-family: 'Space Grotesk'; font-size: 1.3rem; font-weight: 700; color: var(--accent-green);">Q${inv.total.toFixed(2)}</div>
                    </div>
                </div>
            `).join("");
        } else {
            invoicesContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron facturas para el correo <b>${email}</b>.</p>`;
        }

    } catch (err) {
        console.error("Portal fetch error:", err);
        ordersContainer.innerHTML = `<p style="color: #f87171; text-align: center;">Error de conexión con el Middleware API.</p>`;
        invoicesContainer.innerHTML = `<p style="color: #f87171; text-align: center;">Error de conexión con el Middleware API.</p>`;
    }
}

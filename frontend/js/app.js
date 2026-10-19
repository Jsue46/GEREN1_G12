// GamerZone E-Commerce - Store & Checkout Logic

const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";

let allProducts = [];
let cart = [];

const iconsByCategory = {
    "Periféricos": "🎧",
    "Audio": "🔊",
    "Monitores": "🖥️",
    "Sillas": "💺",
    "Controles": "🎮",
    "Hardware": "⚙️",
    "Teclados": "⌨️",
    "Mouse": "🖱️",
    "General": "📦"
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    updateCartUI();
});

async function loadProducts() {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <p style="font-size: 1.5rem;">Cargando catálogo en tiempo real desde Odoo ERP...</p>
    </div>`;

    try {
        const resp = await fetch(`${API_BASE}/api/products`);
        const data = await resp.json();
        
        if (data.success && data.products) {
            allProducts = data.products;
            renderProducts(allProducts);
            renderCategoryFilters(allProducts);
        } else {
            grid.innerHTML = `<p style="color: #f87171; text-align: center;">Error al cargar productos desde Odoo.</p>`;
        }
    } catch (err) {
        console.error("Fetch error:", err);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <p style="color: #f87171; font-weight: 600;">No se pudo conectar con el Middleware API (http://localhost:8000).</p>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Asegúrate de que el backend esté corriendo con: <code>python main.py</code></p>
        </div>`;
    }
}

function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No se encontraron productos.</p>`;
        return;
    }

    products.forEach(p => {
        const icon = getCategoryIcon(p.name, p.category);
        const inStock = p.stock > 0;
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div>
                <div class="card-top">
                    <span class="category-tag">${p.category}</span>
                    <span class="stock-tag ${inStock ? 'in-stock' : 'out-stock'}">
                        ${inStock ? `Stock: ${p.stock}` : 'Bajo Pedido'}
                    </span>
                </div>
                <div class="product-img-box">${icon}</div>
                <h3 class="product-title">${p.name}</h3>
                <p class="product-desc">${p.description || "Garantía oficial y compatibilidad multiplataforma de GamerZone."}</p>
            </div>
            <div class="card-bottom">
                <div class="price-box">
                    <span class="price-label">Precio contado</span>
                    <span class="price-value">Q${p.price.toFixed(2)}</span>
                </div>
                <button class="add-btn" onclick="addToCart(${p.id})">
                    <span>🛒</span> Agregar
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function getCategoryIcon(name, category) {
    const text = (name + " " + category).toLowerCase();
    if (text.includes("headset") || text.includes("audífono") || text.includes("audifono")) return "🎧";
    if (text.includes("silla") || text.includes("caliber")) return "💺";
    if (text.includes("control") || text.includes("gamepad") || text.includes("controller")) return "🎮";
    if (text.includes("teclado") || text.includes("keyboard")) return "⌨️";
    if (text.includes("mouse") || text.includes("ratón")) return "🖱️";
    if (text.includes("monitor") || text.includes("pantalla")) return "🖥️";
    if (text.includes("microfono") || text.includes("mic")) return "🎙️";
    return iconsByCategory[category] || "📦";
}

function renderCategoryFilters(products) {
    const container = document.getElementById("filter-pills");
    const categories = ["Todos", ...new Set(products.map(p => p.category))];
    
    container.innerHTML = categories.map(c => `
        <button class="filter-btn ${c === 'Todos' ? 'active' : ''}" onclick="filterByCategory('${c}', this)">
            ${c}
        </button>
    `).join("");
}

function filterByCategory(category, btn) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (category === "Todos") {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === category);
        renderProducts(filtered);
    }
}

function searchProducts() {
    const term = document.getElementById("search-input").value.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term)
    );
    renderProducts(filtered);
}

// Cart Functionality
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(it => it.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    updateCartUI();
    showToast(`"${product.name}" agregado al carrito`);
}

function updateCartUI() {
    const badge = document.getElementById("cart-count");
    const totalCount = cart.reduce((sum, it) => sum + it.quantity, 0);
    badge.innerText = totalCount;
}

function openCartModal() {
    const modal = document.getElementById("cart-modal");
    const container = document.getElementById("cart-items-container");
    const totalEl = document.getElementById("cart-total");

    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Tu carrito está vacío.</p>`;
        totalEl.innerText = "Q0.00";
    } else {
        let total = 0;
        container.innerHTML = cart.map(it => {
            const subtotal = it.price * it.quantity;
            total += subtotal;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-glass);">
                    <div>
                        <div style="font-weight: 600;">${it.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Q${it.price.toFixed(2)} c/u</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button onclick="changeQuantity(${it.id}, -1)" style="padding: 0.2rem 0.5rem; background: rgba(255,255,255,0.08); border: none; color: white; border-radius: 4px; cursor: pointer;">-</button>
                        <span style="font-weight: 700;">${it.quantity}</span>
                        <button onclick="changeQuantity(${it.id}, 1)" style="padding: 0.2rem 0.5rem; background: rgba(255,255,255,0.08); border: none; color: white; border-radius: 4px; cursor: pointer;">+</button>
                        <span style="margin-left: 0.75rem; font-weight: 700; color: var(--accent-cyan);">Q${subtotal.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join("");
        totalEl.innerText = `Q${total.toFixed(2)}`;
    }

    modal.classList.add("active");
}

function changeQuantity(id, delta) {
    const item = cart.find(it => it.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(it => it.id !== id);
    }
    updateCartUI();
    openCartModal();
}

function closeCartModal() {
    document.getElementById("cart-modal").classList.remove("active");
}

function openCheckoutModal() {
    if (cart.length === 0) {
        alert("Agrega al menos un producto al carrito antes de proceder.");
        return;
    }
    closeCartModal();
    document.getElementById("checkout-modal").classList.add("active");
    
    const checkoutTotal = cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    document.getElementById("checkout-total-val").innerText = `Q${checkoutTotal.toFixed(2)}`;
}

function closeCheckoutModal() {
    document.getElementById("checkout-modal").classList.remove("active");
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-order-btn");
    btn.disabled = true;
    btn.innerText = "⏳ Sincronizando con ERP y Facturando...";

    const payload = {
        customer: {
            name: document.getElementById("cust-name").value,
            email: document.getElementById("cust-email").value,
            phone: document.getElementById("cust-phone").value,
            address: document.getElementById("cust-address").value,
            city: document.getElementById("cust-city").value
        },
        items: cart.map(it => ({
            product_id: it.id,
            name: it.name,
            price_unit: it.price,
            quantity: it.quantity
        }))
    };

    try {
        const resp = await fetch(`${API_BASE}/api/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (data.success) {
            closeCheckoutModal();
            showSuccessModal(data.data);
            cart = [];
            updateCartUI();
        } else {
            alert("Error al procesar pedido: " + (data.detail || "Error desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("Error de red conectando al Middleware API.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirmar Compra y Facturar";
    }
}

function showSuccessModal(orderData) {
    const modal = document.getElementById("success-modal");
    document.getElementById("res-order-num").innerText = orderData.order_number || `SO#${orderData.sale_order_id}`;
    document.getElementById("res-inv-num").innerText = orderData.invoice ? orderData.invoice.name : "Emitida en Odoo";
    document.getElementById("res-total").innerText = `Q${orderData.total.toFixed(2)}`;
    document.getElementById("res-crm-id").innerText = `Lead #${orderData.crm_lead_id} (Oportunidad Ganada)`;
    document.getElementById("res-customer-email").innerText = document.getElementById("cust-email").value;
    modal.classList.add("active");
}

function closeSuccessModal() {
    document.getElementById("success-modal").classList.remove("active");
}

function goToPortalWithEmail() {
    const email = document.getElementById("res-customer-email").innerText;
    window.location.href = `portal.html?email=${encodeURIComponent(email)}`;
}

function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "2rem";
    toast.style.right = "2rem";
    toast.style.background = "#1e293b";
    toast.style.border = "1px solid #8b5cf6";
    toast.style.color = "white";
    toast.style.padding = "0.75rem 1.25rem";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
    toast.style.zIndex = "9999";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

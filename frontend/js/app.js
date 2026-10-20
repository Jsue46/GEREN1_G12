const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";
const CART_KEY = "gamerzone_cart_v2";
const CUSTOMER_KEY = "gamerzone_customer";

let allProducts = [];
let activeCategory = "Todos";
let cart = readStorage(CART_KEY, []);
let currentQuote = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("search-input").addEventListener("input", applyCatalogFilters);
    document.getElementById("register-form").addEventListener("submit", registerCustomer);
    document.getElementById("quote-form").addEventListener("submit", createQuote);
    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal(modal.id);
        });
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") document.querySelectorAll(".modal-overlay.active").forEach(modal => closeModal(modal.id));
    });
    updateCartUI();
    loadProducts();
});

function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
}

function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function money(value) {
    return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value) || 0);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.detail || data.message || "No fue posible completar la solicitud.");
    return data;
}

async function loadProducts() {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = Array.from({ length: 8 }, () => '<div class="product-card skeleton-card" aria-hidden="true"><span></span><span></span><span></span></div>').join("");
    try {
        const data = await apiRequest("/api/products?limit=60");
        allProducts = data.products || [];
        document.getElementById("catalog-count").textContent = `${allProducts.length}`;
        document.getElementById("catalog-status").textContent = `${allProducts.length} productos sincronizados con el ERP`;
        renderCategoryFilters();
        applyCatalogFilters();
    } catch (error) {
        grid.innerHTML = `<div class="empty-state"><strong>No pudimos cargar el catálogo.</strong><p>${escapeHtml(error.message)}</p><button class="secondary-btn" type="button" onclick="loadProducts()">Reintentar</button></div>`;
        document.getElementById("catalog-status").textContent = "El catálogo no está disponible en este momento";
    }
}

function renderCategoryFilters() {
    const categories = ["Todos", ...new Set(allProducts.map(product => product.category || "General"))];
    const container = document.getElementById("filter-pills");
    container.innerHTML = categories.map(category => `<button class="filter-btn ${category === activeCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    container.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        renderCategoryFilters();
        applyCatalogFilters();
    }));
}

function applyCatalogFilters() {
    const term = document.getElementById("search-input").value.trim().toLocaleLowerCase("es");
    const products = allProducts.filter(product => {
        const categoryMatch = activeCategory === "Todos" || product.category === activeCategory;
        const searchable = `${product.name} ${product.category} ${product.sku || ""}`.toLocaleLowerCase("es");
        return categoryMatch && searchable.includes(term);
    });
    renderProducts(products);
}

function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    if (!products.length) {
        grid.innerHTML = '<div class="empty-state"><strong>No encontramos coincidencias.</strong><p>Prueba otra palabra o selecciona una categoría diferente.</p></div>';
        return;
    }
    grid.innerHTML = products.map(product => {
        const inStock = Number(product.stock) > 0;
        const visual = product.image
            ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" width="512" height="512">`
            : `<span class="product-monogram" aria-hidden="true">${escapeHtml(product.name.slice(0, 2).toUpperCase())}</span>`;
        return `<article class="product-card">
            <div class="product-visual">${visual}</div>
            <div class="product-meta"><span>${escapeHtml(product.category || "General")}</span><span class="${inStock ? "stock-ok" : "stock-request"}">${inStock ? `${product.stock} disponibles` : "Bajo pedido"}</span></div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-sku">SKU ${escapeHtml(product.sku || `GZ-${product.id}`)}</p>
            <p class="product-description">${escapeHtml(product.description || "Garantía oficial y compatibilidad verificada por GamerZone.")}</p>
            <div class="product-action"><strong>${money(product.price)}</strong><button class="add-btn" type="button" data-product-id="${product.id}">Agregar</button></div>
        </article>`;
    }).join("");
    grid.querySelectorAll(".add-btn").forEach(button => button.addEventListener("click", () => addToCart(Number(button.dataset.productId))));
}

function addToCart(productId) {
    const product = allProducts.find(item => item.id === productId);
    if (!product) return;
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, name: product.name, sku: product.sku, price: Number(product.price), quantity: 1, image: product.image || null });
    saveCart(); updateCartUI();
    showToast(`${product.name} se agregó al carrito.`);
}

function updateCartUI() {
    document.getElementById("cart-count").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartTotal() { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }

function openCartModal() { renderCart(); openModal("cart-modal"); }

function renderCart() {
    const container = document.getElementById("cart-items-container");
    const quoteButton = document.getElementById("quote-cart-btn");
    const clearButton = document.getElementById("clear-cart-btn");
    if (!cart.length) {
        container.innerHTML = '<div class="empty-state compact"><strong>Tu carrito está vacío.</strong><p>Agrega productos del catálogo para solicitar una cotización.</p></div>';
        quoteButton.disabled = true;
        clearButton.hidden = true;
    } else {
        container.innerHTML = cart.map(item => `<div class="cart-item">
            <div><strong>${escapeHtml(item.name)}</strong><span>${money(item.price)} por unidad</span></div>
            <div class="quantity-control" aria-label="Cantidad de ${escapeHtml(item.name)}">
                <button type="button" onclick="changeQuantity(${item.id}, -1)" aria-label="Reducir cantidad">−</button>
                <span>${item.quantity}</span>
                <button type="button" onclick="changeQuantity(${item.id}, 1)" aria-label="Aumentar cantidad">+</button>
            </div>
            <strong>${money(item.price * item.quantity)}</strong>
            <button class="remove-btn" type="button" onclick="removeFromCart(${item.id})" aria-label="Quitar ${escapeHtml(item.name)}">Quitar</button>
        </div>`).join("");
        quoteButton.disabled = false;
        clearButton.hidden = false;
    }
    document.getElementById("cart-total").textContent = money(cartTotal());
}

function changeQuantity(id, delta) {
    const item = cart.find(entry => entry.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity < 1) cart = cart.filter(entry => entry.id !== id);
    saveCart(); updateCartUI(); renderCart();
}

function removeFromCart(id) { cart = cart.filter(item => item.id !== id); saveCart(); updateCartUI(); renderCart(); }
function clearCart() { cart = []; saveCart(); updateCartUI(); renderCart(); }

function openRegisterModal() { fillCustomerForm(document.getElementById("register-form")); openModal("register-modal"); }

function openQuoteModal() {
    if (!cart.length) return showToast("Agrega al menos un producto antes de cotizar.", "error");
    closeModal("cart-modal");
    fillCustomerForm(document.getElementById("quote-form"));
    document.getElementById("quote-total-value").textContent = money(cartTotal());
    openModal("quote-modal");
}

function fillCustomerForm(form) {
    const customer = readStorage(CUSTOMER_KEY, null);
    if (!customer) return;
    Object.entries(customer).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
}

function formCustomer(form) {
    return Object.fromEntries(["name", "email", "phone", "address", "city"].map(key => [key, form.elements[key].value.trim()]));
}

function validateForm(form) {
    let valid = true;
    form.querySelectorAll("input").forEach(input => {
        const error = input.closest(".form-group").querySelector(".field-error");
        error.textContent = "";
        input.removeAttribute("aria-invalid");
        if (!input.checkValidity()) {
            error.textContent = input.type === "email" ? "Ingresa un correo válido." : "Este campo es obligatorio.";
            input.setAttribute("aria-invalid", "true");
            valid = false;
        }
    });
    if (!valid) form.querySelector("[aria-invalid='true']")?.focus();
    return valid;
}

async function registerCustomer(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateForm(form)) return;
    const button = document.getElementById("register-btn");
    setButtonLoading(button, true, "Registrando...");
    const customer = formCustomer(form);
    try {
        await apiRequest("/api/customers", { method: "POST", body: JSON.stringify(customer) });
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
        closeModal("register-modal");
        showToast("Cuenta creada. Tus datos quedaron guardados para cotizar.");
    } catch (error) { showToast(error.message, "error"); }
    finally { setButtonLoading(button, false); }
}

async function createQuote(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateForm(form)) return;
    const customer = formCustomer(form);
    const button = document.getElementById("create-quote-btn");
    setButtonLoading(button, true, "Guardando en Odoo...");
    try {
        const result = await apiRequest("/api/quotes", {
            method: "POST",
            body: JSON.stringify({ customer, items: cart.map(item => ({ product_id: item.id, name: item.name, price_unit: item.price, quantity: item.quantity })) })
        });
        currentQuote = result.data;
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
        localStorage.setItem("gamerzone_last_quote", JSON.stringify(currentQuote));
        document.getElementById("quote-number").textContent = currentQuote.quote_number;
        document.getElementById("quote-result-total").textContent = money(currentQuote.total);
        closeModal("quote-modal");
        openModal("quote-success-modal");
    } catch (error) { showToast(error.message, "error"); }
    finally { setButtonLoading(button, false); }
}

async function convertCurrentQuote() {
    if (!currentQuote) return;
    const button = document.getElementById("convert-quote-btn");
    setButtonLoading(button, true, "Confirmando orden...");
    try {
        const result = await apiRequest(`/api/quotes/${currentQuote.quote_id}/convert`, {
            method: "POST", body: JSON.stringify({ email: currentQuote.customer_email })
        });
        const order = result.data;
        document.getElementById("result-order").textContent = order.order_number || `SO-${order.sale_order_id}`;
        document.getElementById("result-invoice").textContent = order.invoice?.name || "Emitida en Odoo";
        document.getElementById("result-total").textContent = money(order.total);
        currentQuote.customer_email = order.customer_email;
        cart = []; saveCart(); updateCartUI();
        closeModal("quote-success-modal");
        openModal("order-success-modal");
    } catch (error) { showToast(error.message, "error"); }
    finally { setButtonLoading(button, false); }
}

function finishQuoteLater() {
    cart = []; saveCart(); updateCartUI(); closeModal("quote-success-modal");
    showToast("Cotización guardada. Puedes consultarla en Mis pedidos.");
}

function goToPortal() {
    const customer = readStorage(CUSTOMER_KEY, {});
    window.location.href = `portal.html?email=${encodeURIComponent(currentQuote?.customer_email || customer.email || "")}`;
}

function setButtonLoading(button, loading, label = "") {
    if (loading) {
        button.dataset.label = button.textContent;
        button.textContent = label;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.label || button.textContent;
        button.disabled = false;
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    setTimeout(() => modal.querySelector("button, input")?.focus(), 50);
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove("active");
    if (!document.querySelector(".modal-overlay.active")) document.body.classList.remove("modal-open");
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById("toast-region").appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

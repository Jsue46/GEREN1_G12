from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from pathlib import Path
from threading import Lock
import base64
import hashlib
import logging
import os
import uvicorn

from odoo_client import OdooClient
from payment_service import PaymentService, PaymentValidationError
from config import SERVER_PORT, FRONTEND_ORIGINS

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GamerZone Middleware API (ERP + CRM + E-Commerce)",
    description="API REST de integración bidireccional entre la tienda web y Odoo ERP/CRM para la Fase 3",
    version="1.0.0"
)

# Enable CORS for frontend web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

odoo = OdooClient()
payments = PaymentService(os.getenv("PAYMENTS_DB_PATH"))
# Evita que dos compras atendidas por este proceso validen simultáneamente la
# misma existencia antes de que Odoo complete el primer despacho.
purchase_lock = Lock()

# Pydantic Schemas
class CustomerData(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = "Guatemala"

class OrderItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(default=1, gt=0, le=99)
    name: Optional[str] = None
    price_unit: Optional[float] = None

class CheckoutRequest(BaseModel):
    customer: CustomerData
    items: List[OrderItem]

class QuoteConversionRequest(BaseModel):
    email: EmailStr
    payment_method_id: str = Field(min_length=8)

class PurchaseRequest(CheckoutRequest):
    payment_method_id: str = Field(min_length=8)

class PaymentMethodRequest(BaseModel):
    email: EmailStr
    holder_name: str = Field(min_length=3, max_length=100)
    card_number: str = Field(min_length=13, max_length=25)
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=2020, le=2200)
    cvv: str = Field(min_length=3, max_length=4)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "GamerZone E-Commerce ERP/CRM Middleware",
        "odoo_db": odoo.db,
        "odoo_host": odoo.url,
        "endpoints": {
            "products": "/api/products",
            "checkout": "/api/checkout",
            "payment_methods": "/api/payment-methods",
            "customers": "/api/customers",
            "quotes": "/api/quotes",
            "convert_quote": "/api/quotes/{quote_id}/convert",
            "portal_orders": "/api/portal/orders?email={email}",
            "portal_invoices": "/api/portal/invoices?email={email}",
            "portal_payments": "/api/portal/payments?email={email}",
            "docs": "/docs"
        }
    }

@app.get("/api/health")
def integration_health():
    """Comprueba que el middleware puede autenticarse y consultar la versión de Odoo."""
    try:
        connection = odoo.ping()
        return {"success": True, "status": "online", "odoo": connection}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Odoo no está disponible: {str(e)}")

@app.get("/api/products")
def list_products(limit: int = Query(default=50, ge=1, le=100)):
    """Obtiene el catálogo de productos activos desde Odoo ERP con stock real y precios."""
    try:
        products = odoo.get_products(limit=limit)
        return {"success": True, "count": len(products), "products": products}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando productos de Odoo: {str(e)}")

@app.get("/api/products/{product_id}/image", include_in_schema=False)
def product_image(product_id: int):
    """Entrega imágenes por separado para mantener liviano el JSON del catálogo."""
    try:
        image = odoo.get_product_image(product_id)
        if not image:
            placeholder = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#eef2f7"/><rect x="166" y="166" width="180" height="180" rx="42" fill="#0b57d0"/><text x="256" y="278" text-anchor="middle" font-family="Arial,sans-serif" font-size="66" font-weight="700" fill="white">GZ</text><text x="256" y="392" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#657184">Producto {product_id}</text></svg>'''
            return Response(
                content=placeholder,
                media_type="image/svg+xml",
                headers={"Cache-Control": "public, max-age=3600"}
            )
        content = base64.b64decode(image["content"], validate=True)
        etag = hashlib.sha1(content).hexdigest()
        media_type = "image/jpeg" if content.startswith(b"\xff\xd8\xff") else "image/webp" if content.startswith(b"RIFF") else "image/png"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=86400", "ETag": etag}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error obteniendo la imagen desde Odoo: {str(e)}")

@app.post("/api/customers", status_code=201)
def register_customer(customer: CustomerData):
    """Registra una cuenta de cliente web como contacto de cliente en Odoo."""
    try:
        partner_id = odoo.get_or_create_customer(
            name=customer.name.strip(),
            email=str(customer.email).strip().lower(),
            phone=customer.phone.strip(),
            address=customer.address.strip(),
            city=customer.city.strip()
        )
        return {
            "success": True,
            "message": "Cliente registrado correctamente en Odoo.",
            "customer": {"id": partner_id, **customer.model_dump()}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error registrando el cliente en Odoo: {str(e)}")

def _assert_stock(items, products_by_id):
    shortages = []
    for item in items:
        product = products_by_id.get(item["product_id"])
        available = max(0, float(product.get("stock", 0))) if product else 0
        requested = float(item["quantity"])
        if requested > available:
            shortages.append({
                "product_id": item["product_id"],
                "name": product.get("name", item.get("name", "Producto")) if product else item.get("name", "Producto"),
                "requested": requested,
                "available": available,
            })
    if shortages:
        detail = "; ".join(
            f"{item['name']}: solicitadas {item['requested']:g}, disponibles {item['available']:g}"
            for item in shortages
        )
        raise HTTPException(status_code=409, detail=f"Stock insuficiente. {detail}")


def _prepare_commercial_request(payload: CheckoutRequest, require_stock=True):
    if not payload.items:
        raise HTTPException(status_code=400, detail="El carrito de compras está vacío")
    quantities = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
        if quantities[item.product_id] > 99:
            raise HTTPException(status_code=400, detail="La cantidad máxima por producto es 99")
    official_products = odoo.get_products_by_ids(quantities.keys())
    by_id = {product["id"]: product for product in official_products}
    missing = [product_id for product_id in quantities if product_id not in by_id]
    if missing:
        raise HTTPException(status_code=400, detail=f"Productos no disponibles: {missing}")
    items = [{
        "product_id": product_id,
        "name": by_id[product_id]["name"],
        "price_unit": by_id[product_id]["price"],
        "quantity": quantity
    } for product_id, quantity in quantities.items()]
    if require_stock:
        _assert_stock(items, by_id)
    total = sum(item["price_unit"] * item["quantity"] for item in items)
    summary = "\n".join(
        f"- {item['name']} x{item['quantity']} (Q{item['price_unit']})" for item in items
    )
    return items, total, summary


def _get_payment_method_or_400(email, payment_method_id):
    method = payments.get_method(payment_method_id, str(email))
    if not method:
        raise HTTPException(status_code=400, detail="La tarjeta seleccionada no pertenece a este cliente")
    try:
        payments._validate_expiry(method["expiry_month"], method["expiry_year"])
    except PaymentValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return method


@app.post("/api/payment-methods", status_code=201)
def add_payment_method(payload: PaymentMethodRequest):
    """Tokeniza una tarjeta simulada. PAN y CVV nunca se guardan."""
    try:
        method = payments.add_method(
            email=str(payload.email), holder_name=payload.holder_name,
            card_number=payload.card_number, expiry_month=payload.expiry_month,
            expiry_year=payload.expiry_year, cvv=payload.cvv,
        )
        return {"success": True, "message": "Tarjeta agregada.", "payment_method": method}
    except PaymentValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/payment-methods")
def list_payment_methods(email: EmailStr = Query(...)):
    methods = payments.list_methods(str(email))
    return {"success": True, "count": len(methods), "payment_methods": methods}


@app.get("/api/portal/payments")
def list_simulated_payments(email: EmailStr = Query(...)):
    records = payments.list_payments(str(email))
    return {"success": True, "count": len(records), "payments": records}

@app.post("/api/quotes", status_code=201)
def create_quote(payload: CheckoutRequest):
    """Crea una cotización en borrador en Odoo, lista para convertirse en orden."""
    try:
        items, total_amount, items_summary = _prepare_commercial_request(payload)
        customer = payload.customer
        partner_id = odoo.get_or_create_customer(
            name=customer.name.strip(), email=str(customer.email).strip().lower(),
            phone=customer.phone.strip(), address=customer.address.strip(), city=customer.city.strip()
        )
        lead_id = odoo.create_quote_lead(
            partner_id=partner_id, customer_name=customer.name,
            total_amount=total_amount, items_desc=items_summary
        )
        quote_id = odoo.create_sale_order(partner_id=partner_id, items=items, lead_id=lead_id)
        quote = odoo.get_sale_order(quote_id)
        return {
            "success": True,
            "message": "Cotización creada en Odoo y vinculada al CRM.",
            "data": {
                "quote_id": quote_id,
                "quote_number": quote.get("name"),
                "state": quote.get("state"),
                "crm_lead_id": lead_id,
                "customer_id": partner_id,
                "customer_email": str(customer.email),
                "total": float(quote.get("amount_total", total_amount))
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando la cotización en Odoo: {str(e)}")

@app.post("/api/quotes/{quote_id}/convert")
def convert_quote(quote_id: int, payload: QuoteConversionRequest):
    """Confirma una cotización propia y genera reserva de inventario y factura."""
    try:
        with purchase_lock:
            quote = odoo.get_sale_order(quote_id)
            if quote.get("state") not in ("draft", "sent"):
                raise HTTPException(status_code=409, detail="La cotización ya fue convertida o no está disponible")
            partner = quote.get("partner_id")
            partner_id = partner[0] if isinstance(partner, list) else partner
            if not odoo.quote_belongs_to_email(partner_id, str(payload.email)):
                raise HTTPException(status_code=403, detail="El correo no corresponde a esta cotización")
            _get_payment_method_or_400(payload.email, payload.payment_method_id)
            quote_items = odoo.get_sale_order_items(quote_id)
            official_products = odoo.get_products_by_ids(item["product_id"] for item in quote_items)
            _assert_stock(quote_items, {product["id"]: product for product in official_products})
            order_info = odoo.confirm_sale_order(quote_id)
            odoo.complete_delivery(quote_id)
            opportunity = quote.get("opportunity_id")
            lead_id = opportunity[0] if isinstance(opportunity, list) else opportunity
            try:
                odoo.mark_lead_won(lead_id)
            except Exception as e:
                logger.warning("No se pudo actualizar la oportunidad %s: %s", lead_id, e)
            invoice = None
            invoice_warning = None
            try:
                invoice = odoo.create_and_post_invoice(quote_id)
            except Exception as e:
                invoice_warning = f"La compra fue confirmada, pero la factura quedó pendiente: {str(e)}"
                logger.warning("No se pudo facturar la orden %s: %s", quote_id, e)
            payment = payments.charge(
                email=str(payload.email), payment_method_id=payload.payment_method_id,
                amount=float(quote.get("amount_total", 0)), sale_order_id=quote_id,
                order_number=order_info.get("name"),
                invoice_id=invoice.get("id") if invoice else None,
            )
        return {
            "success": True,
            "message": "Cotización convertida en orden de venta.",
            "data": {
                "sale_order_id": quote_id,
                "order_number": order_info.get("name"),
                "order_state": order_info.get("state"),
                "picking_ids": order_info.get("picking_ids", []),
                "invoice": invoice,
                "invoice_warning": invoice_warning,
                "payment": payment,
                "total": float(quote.get("amount_total", 0)),
                "crm_lead_id": lead_id,
                "customer_email": str(payload.email)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error convirtiendo la cotización: {str(e)}")

@app.post("/api/checkout")
def process_checkout(payload: PurchaseRequest):
    """
    Flujo de integración extremo a extremo automático:
    1. Registra o recupera el Cliente en Odoo (res.partner).
    2. Crea una Oportunidad/Lead en el CRM (crm.lead).
    3. Crea la Orden de Venta en el ERP (sale.order).
    4. Confirma la Orden de Venta (genera descuento automático de Inventario en stock.picking).
    5. Genera y publica la Factura de Cliente (account.move).
    """
    try:
        cust = payload.customer
        _get_payment_method_or_400(cust.email, payload.payment_method_id)
        with purchase_lock:
            items, total_amount, items_summary = _prepare_commercial_request(payload)
            partner_id = odoo.get_or_create_customer(
                name=cust.name, email=str(cust.email), phone=cust.phone,
                address=cust.address, city=cust.city
            )
            lead_id = odoo.create_crm_lead(
                partner_id=partner_id, customer_name=cust.name,
                total_amount=total_amount, items_desc=items_summary
            )
            order_id = odoo.create_sale_order(partner_id=partner_id, items=items, lead_id=lead_id)
            order_info = odoo.confirm_sale_order(order_id)
            odoo.complete_delivery(order_id)
            inv_data = None
            invoice_warning = None
            try:
                inv_data = odoo.create_and_post_invoice(order_id)
            except Exception as error:
                invoice_warning = f"La compra fue confirmada, pero la factura quedó pendiente: {error}"
                logger.warning("No se pudo facturar la orden %s: %s", order_id, error)
            payment = payments.charge(
                email=str(cust.email), payment_method_id=payload.payment_method_id,
                amount=total_amount, sale_order_id=order_id,
                order_number=order_info.get('name'),
                invoice_id=inv_data.get('id') if inv_data else None,
            )

        return {
            "success": True,
            "message": "Pedido procesado y facturado automáticamente en Odoo ERP y CRM.",
            "data": {
                "customer_id": partner_id,
                "crm_lead_id": lead_id,
                "sale_order_id": order_id,
                "order_number": order_info.get('name'),
                "order_state": order_info.get('state'),
                "picking_ids": order_info.get('picking_ids', []),
                "invoice": inv_data,
                "invoice_warning": invoice_warning,
                "payment": payment,
                "total": total_amount
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la orden en Odoo: {str(e)}")

@app.get("/api/portal/orders")
def get_customer_orders(email: str = Query(..., description="Correo del cliente")):
    """Portal de Cliente: Consulta las órdenes de compra asociadas a un correo."""
    try:
        orders = odoo.get_customer_orders(email=email.strip())
        return {"success": True, "email": email, "count": len(orders), "orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando órdenes del cliente: {str(e)}")

@app.get("/api/portal/invoices")
def get_customer_invoices(email: str = Query(..., description="Correo del cliente")):
    """Portal de Cliente: Consulta las facturas asociadas a un correo."""
    try:
        invoices = odoo.get_customer_invoices(email=email.strip())
        simulated = payments.list_payments(email.strip())
        paid_invoice_ids = {record["invoice_id"] for record in simulated if record.get("invoice_id")}
        for invoice in invoices:
            invoice["simulated_payment"] = invoice["id"] in paid_invoice_ids
            if invoice["simulated_payment"]:
                invoice["payment_display"] = "Pagada (simulación educativa)"
        return {"success": True, "email": email, "count": len(invoices), "invoices": invoices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando facturas del cliente: {str(e)}")

@app.get("/api/portal/orders/{order_id}")
def get_customer_order_detail(order_id: int, email: EmailStr = Query(..., description="Correo del cliente")):
    """Devuelve el detalle de una cotización u orden, validando que pertenezca al correo."""
    try:
        order = odoo.get_customer_order_detail(order_id=order_id, email=str(email).strip())
        if not order:
            raise HTTPException(status_code=404, detail="No se encontró el pedido para este cliente")
        return {"success": True, "order": order}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando el detalle del pedido: {str(e)}")

# Serve the compiled React SPA. API routes above always take precedence.
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"

@app.get("/store", include_in_schema=False)
def redirect_store():
    return RedirectResponse(url="/store/")

@app.get("/store/{requested_path:path}", include_in_schema=False)
def serve_store(requested_path: str):
    if not frontend_dist.exists():
        raise HTTPException(status_code=503, detail="Frontend no compilado. Ejecute: cd frontend && npm run build")
    requested_file = (frontend_dist / requested_path).resolve()
    if requested_path and requested_file.is_relative_to(frontend_dist.resolve()) and requested_file.is_file():
        return FileResponse(requested_file)
    return FileResponse(frontend_dist / "index.html", headers={"Cache-Control": "no-cache"})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=SERVER_PORT, reload=True)

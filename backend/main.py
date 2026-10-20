from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import os
import uvicorn

from odoo_client import OdooClient
from config import SERVER_PORT

app = FastAPI(
    title="GamerZone Middleware API (ERP + CRM + E-Commerce)",
    description="API REST de integración bidireccional entre la tienda web y Odoo ERP/CRM para la Fase 3",
    version="1.0.0"
)

# Enable CORS for frontend web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

odoo = OdooClient()

# Pydantic Schemas
class CustomerData(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = "Guatemala"

class OrderItem(BaseModel):
    product_id: int
    name: str
    price_unit: float
    quantity: int = 1

class CheckoutRequest(BaseModel):
    customer: CustomerData
    items: List[OrderItem]

class QuoteConversionRequest(BaseModel):
    email: EmailStr

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
            "customers": "/api/customers",
            "quotes": "/api/quotes",
            "convert_quote": "/api/quotes/{quote_id}/convert",
            "portal_orders": "/api/portal/orders?email={email}",
            "portal_invoices": "/api/portal/invoices?email={email}",
            "docs": "/docs"
        }
    }

@app.get("/api/products")
def list_products(limit: int = 50):
    """Obtiene el catálogo de productos activos desde Odoo ERP con stock real y precios."""
    try:
        products = odoo.get_products(limit=limit)
        return {"success": True, "count": len(products), "products": products}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando productos de Odoo: {str(e)}")

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

def _prepare_commercial_request(payload: CheckoutRequest):
    if not payload.items:
        raise HTTPException(status_code=400, detail="El carrito de compras está vacío")
    if any(item.quantity < 1 for item in payload.items):
        raise HTTPException(status_code=400, detail="Todas las cantidades deben ser mayores que cero")
    items = [item.model_dump() for item in payload.items]
    total = sum(item["price_unit"] * item["quantity"] for item in items)
    summary = "\n".join(
        f"- {item['name']} x{item['quantity']} (Q{item['price_unit']})" for item in items
    )
    return items, total, summary

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
        quote = odoo.get_sale_order(quote_id)
        if quote.get("state") not in ("draft", "sent"):
            raise HTTPException(status_code=409, detail="La cotización ya fue convertida o no está disponible")
        partner = quote.get("partner_id")
        partner_id = partner[0] if isinstance(partner, list) else partner
        if not odoo.quote_belongs_to_email(partner_id, str(payload.email)):
            raise HTTPException(status_code=403, detail="El correo no corresponde a esta cotización")
        order_info = odoo.confirm_sale_order(quote_id)
        opportunity = quote.get("opportunity_id")
        lead_id = opportunity[0] if isinstance(opportunity, list) else opportunity
        odoo.mark_lead_won(lead_id)
        invoice = odoo.create_and_post_invoice(quote_id)
        return {
            "success": True,
            "message": "Cotización convertida en orden de venta.",
            "data": {
                "sale_order_id": quote_id,
                "order_number": order_info.get("name"),
                "order_state": order_info.get("state"),
                "picking_ids": order_info.get("picking_ids", []),
                "invoice": invoice,
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
def process_checkout(payload: CheckoutRequest):
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
        items, total_amount, items_summary = _prepare_commercial_request(payload)

        # 1. Partner in Odoo
        partner_id = odoo.get_or_create_customer(
            name=cust.name,
            email=str(cust.email),
            phone=cust.phone,
            address=cust.address,
            city=cust.city
        )

        # 2. CRM Opportunity
        lead_id = odoo.create_crm_lead(
            partner_id=partner_id,
            customer_name=cust.name,
            total_amount=total_amount,
            items_desc=items_summary
        )

        # 3. Create Sale Order
        order_id = odoo.create_sale_order(
            partner_id=partner_id,
            items=items,
            lead_id=lead_id
        )

        # 4. Confirm Sale Order (triggers inventory delivery)
        order_info = odoo.confirm_sale_order(order_id)

        # 5. Create & Post Invoice
        inv_data = odoo.create_and_post_invoice(order_id)

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
        return {"success": True, "email": email, "count": len(invoices), "invoices": invoices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando facturas del cliente: {str(e)}")

# Mount static frontend directory
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/store", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=SERVER_PORT, reload=True)

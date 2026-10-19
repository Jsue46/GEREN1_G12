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
        items = [it.dict() for it in payload.items]
        
        if not items:
            raise HTTPException(status_code=400, detail="El carrito de compras esta vacio")

        # Total calculation
        total_amount = sum(it['price_unit'] * it['quantity'] for it in items)
        items_summary = "\n".join([f"- {it['name']} x{it['quantity']} (Q{it['price_unit']})" for it in items])

        # 1. Partner in Odoo
        partner_id = odoo.get_or_create_customer(
            name=cust.name,
            email=cust.email,
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

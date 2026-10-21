"""Pruebas del contrato web sin crear registros reales en Odoo."""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, BACKEND_DIR)

import main  # noqa: E402


CUSTOMER = {
    "name": "María Fernanda López",
    "email": "maria.lopez@example.com",
    "phone": "5555-1212",
    "address": "7a avenida 10-20 zona 4",
    "city": "Guatemala",
}

ITEM = {
    "product_id": 17,
    "name": "Teclado Mecánico TKL",
    "price_unit": 749.0,
    "quantity": 2,
}


class EcommerceApiTests(unittest.TestCase):
    def setUp(self):
        self.fake_odoo = MagicMock()
        self.patcher = patch.object(main, "odoo", self.fake_odoo)
        self.patcher.start()
        self.fake_payments = MagicMock()
        self.payment_patcher = patch.object(main, "payments", self.fake_payments)
        self.payment_patcher.start()
        self.fake_payments.get_method.return_value = {
            "id": "pm_sim_test", "email": CUSTOMER["email"], "brand": "Visa",
            "last4": "4242", "expiry_month": 12, "expiry_year": 2099,
        }
        self.fake_payments.charge.return_value = {
            "id": "pay_sim_test", "receipt": "SIM-TEST", "status": "approved",
            "amount": 1498.0, "currency": "GTQ", "order_number": "S00120",
            "card": {"brand": "Visa", "last4": "4242"}, "created_at": "2099-01-01T00:00:00Z",
        }
        self.client = TestClient(main.app)

    def tearDown(self):
        self.patcher.stop()
        self.payment_patcher.stop()

    def test_catalog_returns_more_than_30_products(self):
        self.fake_odoo.get_products.return_value = [
            {"id": index, "name": f"Producto {index}", "price": 100.0, "stock": 5}
            for index in range(1, 34)
        ]
        response = self.client.get("/api/products?limit=60")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 33)

    def test_customer_registration(self):
        self.fake_odoo.get_or_create_customer.return_value = 91
        response = self.client.post("/api/customers", json=CUSTOMER)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["customer"]["id"], 91)

    def test_quote_is_created_as_draft(self):
        self.fake_odoo.get_or_create_customer.return_value = 91
        self.fake_odoo.get_products_by_ids.return_value = [{
            "id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8
        }]
        self.fake_odoo.create_quote_lead.return_value = 44
        self.fake_odoo.create_sale_order.return_value = 120
        self.fake_odoo.get_sale_order.return_value = {
            "id": 120, "name": "S00120", "state": "draft", "amount_total": 1498.0
        }
        response = self.client.post("/api/quotes", json={"customer": CUSTOMER, "items": [ITEM]})
        self.assertEqual(response.status_code, 201)
        body = response.json()["data"]
        self.assertEqual(body["quote_number"], "S00120")
        self.assertEqual(body["state"], "draft")
        self.assertEqual(body["total"], 1498.0)

    def test_quote_uses_odoo_price_instead_of_browser_price(self):
        self.fake_odoo.get_products_by_ids.return_value = [{
            "id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8
        }]
        self.fake_odoo.get_or_create_customer.return_value = 91
        self.fake_odoo.create_quote_lead.return_value = 44
        self.fake_odoo.create_sale_order.return_value = 120
        self.fake_odoo.get_sale_order.return_value = {
            "id": 120, "name": "S00120", "state": "draft", "amount_total": 1498.0
        }
        tampered_item = {**ITEM, "price_unit": 1.0, "name": "Producto manipulado"}
        response = self.client.post("/api/quotes", json={"customer": CUSTOMER, "items": [tampered_item]})
        self.assertEqual(response.status_code, 201)
        sent_items = self.fake_odoo.create_sale_order.call_args.kwargs["items"]
        self.assertEqual(sent_items[0]["price_unit"], 749.0)
        self.assertEqual(sent_items[0]["name"], "Teclado Mecánico TKL")

    def test_quote_conversion_confirms_and_invoices(self):
        self.fake_odoo.get_sale_order.return_value = {
            "id": 120,
            "name": "S00120",
            "state": "draft",
            "amount_total": 1498.0,
            "partner_id": [91, "María Fernanda López"],
            "opportunity_id": [44, "Cotización Web"],
        }
        self.fake_odoo.quote_belongs_to_email.return_value = True
        self.fake_odoo.get_sale_order_items.return_value = [{"product_id": 17, "name": "Teclado Mecánico TKL", "quantity": 2}]
        self.fake_odoo.get_products_by_ids.return_value = [{"id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8}]
        self.fake_odoo.confirm_sale_order.return_value = {
            "name": "S00120", "state": "sale", "picking_ids": [77]
        }
        self.fake_odoo.create_and_post_invoice.return_value = {"id": 31, "name": "INV/2026/0031"}
        response = self.client.post(
            "/api/quotes/120/convert", json={"email": CUSTOMER["email"], "payment_method_id": "pm_sim_test"}
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()["data"]
        self.assertEqual(body["order_state"], "sale")
        self.assertEqual(body["invoice"]["name"], "INV/2026/0031")
        self.fake_odoo.mark_lead_won.assert_called_once_with(44)

    def test_confirmed_order_stays_successful_when_invoice_fails(self):
        self.fake_odoo.get_sale_order.return_value = {
            "id": 120, "name": "S00120", "state": "draft", "amount_total": 1498.0,
            "partner_id": [91, "María Fernanda López"], "opportunity_id": False,
        }
        self.fake_odoo.quote_belongs_to_email.return_value = True
        self.fake_odoo.get_sale_order_items.return_value = [{"product_id": 17, "name": "Teclado Mecánico TKL", "quantity": 2}]
        self.fake_odoo.get_products_by_ids.return_value = [{"id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8}]
        self.fake_odoo.confirm_sale_order.return_value = {
            "name": "S00120", "state": "sale", "picking_ids": [77]
        }
        self.fake_odoo.create_and_post_invoice.side_effect = RuntimeError("Diario contable no configurado")
        response = self.client.post("/api/quotes/120/convert", json={"email": CUSTOMER["email"], "payment_method_id": "pm_sim_test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()["data"]
        self.assertEqual(body["order_state"], "sale")
        self.assertIsNone(body["invoice"])
        self.assertIn("factura quedó pendiente", body["invoice_warning"])

    def test_quote_rejects_quantity_above_stock(self):
        self.fake_odoo.get_products_by_ids.return_value = [{
            "id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 4
        }]
        item = {**ITEM, "quantity": 15}
        response = self.client.post("/api/quotes", json={"customer": CUSTOMER, "items": [item]})
        self.assertEqual(response.status_code, 409)
        self.assertIn("solicitadas 15", response.json()["detail"])
        self.assertIn("disponibles 4", response.json()["detail"])
        self.fake_odoo.create_sale_order.assert_not_called()

    def test_quote_does_not_confirm_or_complete_delivery(self):
        self.fake_odoo.get_products_by_ids.return_value = [{
            "id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8
        }]
        self.fake_odoo.get_or_create_customer.return_value = 91
        self.fake_odoo.create_quote_lead.return_value = 44
        self.fake_odoo.create_sale_order.return_value = 120
        self.fake_odoo.get_sale_order.return_value = {"id": 120, "name": "S00120", "state": "draft", "amount_total": 1498.0}
        response = self.client.post("/api/quotes", json={"customer": CUSTOMER, "items": [ITEM]})
        self.assertEqual(response.status_code, 201)
        self.fake_odoo.confirm_sale_order.assert_not_called()
        self.fake_odoo.complete_delivery.assert_not_called()

    def test_purchase_revalidates_stock_and_completes_delivery(self):
        self.fake_odoo.get_products_by_ids.return_value = [{
            "id": 17, "name": "Teclado Mecánico TKL", "price": 749.0, "stock": 8
        }]
        self.fake_odoo.get_or_create_customer.return_value = 91
        self.fake_odoo.create_crm_lead.return_value = 44
        self.fake_odoo.create_sale_order.return_value = 120
        self.fake_odoo.confirm_sale_order.return_value = {"name": "S00120", "state": "sale", "picking_ids": [77]}
        self.fake_odoo.create_and_post_invoice.return_value = {"id": 31, "name": "INV/2026/0031"}
        response = self.client.post("/api/checkout", json={
            "customer": CUSTOMER, "items": [ITEM], "payment_method_id": "pm_sim_test"
        })
        self.assertEqual(response.status_code, 200)
        self.fake_odoo.complete_delivery.assert_called_once_with(120)
        self.fake_payments.charge.assert_called_once()

    def test_empty_quote_is_rejected(self):
        response = self.client.post("/api/quotes", json={"customer": CUSTOMER, "items": []})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

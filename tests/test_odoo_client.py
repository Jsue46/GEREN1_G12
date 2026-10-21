import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from odoo_client import OdooClient  # noqa: E402


class OdooInventoryTests(unittest.TestCase):
    def test_delivery_validation_skips_sms_wizard(self):
        client = OdooClient.__new__(OdooClient)
        client.db = "test"
        client.uid = 2
        client.password = "test"
        client.ensure_auth = MagicMock()
        client.models = MagicMock()

        picking_reads = iter([
            [{"id": 7, "state": "assigned", "move_line_ids_without_package": [9]}],
            [{"id": 7, "move_line_ids_without_package": [9]}],
        ])

        def execute_kw(_db, _uid, _password, model, method, args, options=None):
            if model == "sale.order" and method == "read":
                return [{"id": 3, "picking_ids": [7]}]
            if model == "stock.picking" and method == "read":
                return next(picking_reads)
            if model == "stock.move.line" and method == "read":
                return [{"id": 9, "product_uom_qty": 1.0, "qty_done": 0.0}]
            return True

        client.models.execute_kw.side_effect = execute_kw
        client.complete_delivery(3)

        validation_calls = [
            call for call in client.models.execute_kw.call_args_list
            if call.args[3:5] == ("stock.picking", "button_validate")
        ]
        self.assertEqual(len(validation_calls), 1)
        self.assertEqual(validation_calls[0].args[6], {"context": {"skip_sms": True}})


if __name__ == "__main__":
    unittest.main()

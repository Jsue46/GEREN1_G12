import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from payment_service import PaymentService, PaymentValidationError  # noqa: E402


class PaymentServiceTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.service = PaymentService(Path(self.temporary_directory.name) / "payments.db")

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_tokenizes_card_without_storing_pan_or_cvv(self):
        method = self.service.add_method(
            "cliente@example.com", "Cliente Prueba", "4242 4242 4242 4242", 12, 2099, "123"
        )
        self.assertEqual(method["brand"], "Visa")
        self.assertEqual(method["last4"], "4242")
        self.assertNotIn("card_number", method)
        self.assertNotIn("cvv", method)

    def test_rejects_invalid_card_number(self):
        with self.assertRaises(PaymentValidationError):
            self.service.add_method(
                "cliente@example.com", "Cliente Prueba", "4242 4242 4242 4241", 12, 2099, "123"
            )

    def test_records_unlimited_simulated_payment(self):
        method = self.service.add_method(
            "cliente@example.com", "Cliente Prueba", "4242 4242 4242 4242", 12, 2099, "123"
        )
        payment = self.service.charge(
            "cliente@example.com", method["id"], 999999999.99, 15, "S00015"
        )
        self.assertEqual(payment["status"], "approved")
        self.assertEqual(len(self.service.list_payments("cliente@example.com")), 1)


if __name__ == "__main__":
    unittest.main()

"""Servicio local de pagos simulados para fines educativos.

Nunca almacena el PAN completo ni el CVV. La tarjeta simulada no tiene límite de
saldo: una aprobación representa únicamente el flujo académico, no un cobro real.
"""

from datetime import datetime, timezone
from pathlib import Path
import re
import sqlite3
import uuid


class PaymentValidationError(ValueError):
    pass


class PaymentService:
    def __init__(self, database_path=None):
        default_path = Path(__file__).resolve().parent / "data" / "payments.db"
        self.database_path = Path(database_path or default_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self):
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS payment_methods (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    holder_name TEXT NOT NULL,
                    brand TEXT NOT NULL,
                    last4 TEXT NOT NULL,
                    expiry_month INTEGER NOT NULL,
                    expiry_year INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1
                );
                CREATE INDEX IF NOT EXISTS idx_payment_methods_email
                    ON payment_methods(email);
                CREATE TABLE IF NOT EXISTS simulated_payments (
                    id TEXT PRIMARY KEY,
                    receipt TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL,
                    payment_method_id TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL,
                    status TEXT NOT NULL,
                    sale_order_id INTEGER NOT NULL,
                    order_number TEXT NOT NULL,
                    invoice_id INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id)
                );
                CREATE INDEX IF NOT EXISTS idx_simulated_payments_email
                    ON simulated_payments(email);
                """
            )

    @staticmethod
    def _digits(value):
        return re.sub(r"\D", "", value or "")

    @classmethod
    def _validate_card_number(cls, card_number):
        digits = cls._digits(card_number)
        if not 13 <= len(digits) <= 19:
            raise PaymentValidationError("El número de tarjeta debe contener entre 13 y 19 dígitos")
        checksum = 0
        parity = len(digits) % 2
        for index, character in enumerate(digits):
            digit = int(character)
            if index % 2 == parity:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        if checksum % 10:
            raise PaymentValidationError("El número de tarjeta no es válido")
        return digits

    @staticmethod
    def _brand(card_number):
        if card_number.startswith("4"):
            return "Visa"
        if card_number[:2].isdigit() and 51 <= int(card_number[:2]) <= 55:
            return "Mastercard"
        if card_number.startswith(("34", "37")):
            return "American Express"
        return "Tarjeta"

    @staticmethod
    def _validate_expiry(month, year):
        if not 1 <= month <= 12:
            raise PaymentValidationError("El mes de vencimiento no es válido")
        now = datetime.now(timezone.utc)
        if (year, month) < (now.year, now.month):
            raise PaymentValidationError("La tarjeta está vencida")

    def add_method(self, email, holder_name, card_number, expiry_month, expiry_year, cvv):
        number = self._validate_card_number(card_number)
        cvv_digits = self._digits(cvv)
        if len(cvv_digits) not in (3, 4):
            raise PaymentValidationError("El CVV debe contener 3 o 4 dígitos")
        self._validate_expiry(expiry_month, expiry_year)
        method_id = f"pm_sim_{uuid.uuid4().hex}"
        normalized_email = email.strip().lower()
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO payment_methods
                   (id, email, holder_name, brand, last4, expiry_month, expiry_year, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (method_id, normalized_email, holder_name.strip(), self._brand(number),
                 number[-4:], expiry_month, expiry_year, created_at),
            )
        # Deliberadamente no se persisten card_number ni cvv.
        return self.get_method(method_id, normalized_email)

    def get_method(self, method_id, email):
        with self._connect() as connection:
            row = connection.execute(
                """SELECT id, email, holder_name, brand, last4, expiry_month, expiry_year, created_at
                   FROM payment_methods WHERE id = ? AND email = ? AND active = 1""",
                (method_id, email.strip().lower()),
            ).fetchone()
        return dict(row) if row else None

    def list_methods(self, email):
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT id, email, holder_name, brand, last4, expiry_month, expiry_year, created_at
                   FROM payment_methods WHERE email = ? AND active = 1 ORDER BY created_at DESC""",
                (email.strip().lower(),),
            ).fetchall()
        return [dict(row) for row in rows]

    def charge(self, email, payment_method_id, amount, sale_order_id, order_number, invoice_id=None):
        method = self.get_method(payment_method_id, email)
        if not method:
            raise PaymentValidationError("La tarjeta seleccionada no pertenece a este cliente")
        self._validate_expiry(method["expiry_month"], method["expiry_year"])
        payment_id = f"pay_sim_{uuid.uuid4().hex}"
        receipt = f"SIM-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}"
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO simulated_payments
                   (id, receipt, email, payment_method_id, amount, currency, status,
                    sale_order_id, order_number, invoice_id, created_at)
                   VALUES (?, ?, ?, ?, ?, 'GTQ', 'approved', ?, ?, ?, ?)""",
                (payment_id, receipt, email.strip().lower(), payment_method_id, float(amount),
                 sale_order_id, order_number, invoice_id, created_at),
            )
        return {
            "id": payment_id, "receipt": receipt, "status": "approved",
            "amount": float(amount), "currency": "GTQ", "order_number": order_number,
            "card": {"brand": method["brand"], "last4": method["last4"]},
            "created_at": created_at,
        }

    def list_payments(self, email):
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT p.id, p.receipt, p.amount, p.currency, p.status, p.sale_order_id,
                          p.order_number, p.invoice_id, p.created_at, m.brand, m.last4
                   FROM simulated_payments p
                   JOIN payment_methods m ON m.id = p.payment_method_id
                   WHERE p.email = ? ORDER BY p.created_at DESC""",
                (email.strip().lower(),),
            ).fetchall()
        return [{
            "id": row["id"], "receipt": row["receipt"], "amount": row["amount"],
            "currency": row["currency"], "status": row["status"],
            "sale_order_id": row["sale_order_id"], "order_number": row["order_number"],
            "invoice_id": row["invoice_id"], "created_at": row["created_at"],
            "card": {"brand": row["brand"], "last4": row["last4"]},
        } for row in rows]

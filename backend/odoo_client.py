import xmlrpc.client
import logging
from config import ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD

logger = logging.getLogger(__name__)

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USER
        self.password = ODOO_PASSWORD
        self.uid = None
        self.common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def authenticate(self):
        try:
            self.uid = self.common.authenticate(self.db, self.username, self.password, {})
            if not self.uid:
                raise Exception("Credenciales invalidas para Odoo")
            return self.uid
        except Exception as e:
            logger.error(f"Error al autenticar en Odoo: {e}")
            raise

    def ensure_auth(self):
        if not self.uid:
            self.authenticate()

    def get_products(self, limit=50):
        self.ensure_auth()
        # Query active saleable products
        domain = [('sale_ok', '=', True)]
        fields = ['id', 'name', 'lst_price', 'qty_available', 'categ_id', 'description_sale']
        products = self.models.execute_kw(
            self.db, self.uid, self.password,
            'product.product', 'search_read',
            [domain], {'fields': fields, 'limit': limit}
        )
        result = []
        for p in products:
            categ_name = p['categ_id'][1] if p['categ_id'] else "General"
            result.append({
                'id': p['id'],
                'name': p['name'],
                'price': float(p['lst_price']),
                'stock': float(p.get('qty_available', 0)),
                'category': categ_name,
                'description': p.get('description_sale') or ""
            })
        return result

    def get_or_create_customer(self, name, email, phone="", address="", city=""):
        self.ensure_auth()
        existing = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=', email)]]
        )
        if existing:
            return existing[0]

        partner_id = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'create',
            [{
                'name': name,
                'email': email,
                'phone': phone,
                'street': address,
                'city': city,
                'customer_rank': 1
            }]
        )
        return partner_id

    def create_crm_lead(self, partner_id, customer_name, total_amount, items_desc=""):
        self.ensure_auth()
        lead_id = self.models.execute_kw(
            self.db, self.uid, self.password,
            'crm.lead', 'create',
            [{
                'name': f"Venta Web - {customer_name}",
                'partner_id': partner_id,
                'expected_revenue': total_amount,
                'probability': 100,
                'type': 'opportunity',
                'description': f"Compra en linea completada desde E-Commerce. Detalle:\n{items_desc}"
            }]
        )
        return lead_id

    def create_sale_order(self, partner_id, items, lead_id=None):
        """
        items: list of dicts: {'product_id': int, 'quantity': float, 'price_unit': float, 'name': str}
        """
        self.ensure_auth()
        order_lines = []
        for it in items:
            order_lines.append((0, 0, {
                'product_id': it['product_id'],
                'product_uom_qty': it.get('quantity', 1),
                'price_unit': it.get('price_unit', 0),
                'name': it.get('name', 'Producto Web')
            }))

        order_vals = {
            'partner_id': partner_id,
            'order_line': order_lines
        }
        if lead_id:
            order_vals['opportunity_id'] = lead_id

        order_id = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'create',
            [order_vals]
        )
        return order_id

    def confirm_sale_order(self, order_id):
        self.ensure_auth()
        self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'action_confirm',
            [[order_id]]
        )
        # Read picking and status
        data = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'read',
            [[order_id], ['name', 'state', 'picking_ids']]
        )[0]
        return data

    def create_and_post_invoice(self, order_id):
        self.ensure_auth()
        # 1. Launch advance payment wizard to generate invoice
        wiz_id = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.advance.payment.inv', 'create',
            [{'advance_payment_method': 'percentage', 'amount': 100}],
            {'context': {'active_ids': [order_id], 'active_model': 'sale.order'}}
        )
        self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.advance.payment.inv', 'create_invoices',
            [[wiz_id]],
            {'context': {'active_ids': [order_id], 'active_model': 'sale.order'}}
        )

        # 2. Retrieve created invoice
        order_data = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'read',
            [[order_id], ['invoice_ids']]
        )[0]
        invoice_ids = order_data.get('invoice_ids', [])
        if not invoice_ids:
            return None

        inv_id = invoice_ids[0]
        # 3. Post invoice
        self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move', 'action_post',
            [[inv_id]]
        )

        # 4. Read invoice details
        inv_data = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move', 'read',
            [[inv_id], ['id', 'name', 'state', 'amount_total', 'payment_state', 'invoice_date']]
        )[0]
        return inv_data

    def get_customer_orders(self, email):
        self.ensure_auth()
        partner_ids = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=', email)]]
        )
        if not partner_ids:
            return []

        orders = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'search_read',
            [[('partner_id', 'in', partner_ids)]],
            {'fields': ['id', 'name', 'date_order', 'amount_total', 'state', 'order_line', 'picking_ids'], 'order': 'id desc'}
        )
        
        results = []
        for o in orders:
            # Map human readable state
            state_map = {
                'draft': 'Cotización',
                'sent': 'Cotización Enviada',
                'sale': 'Orden Confirmada',
                'done': 'Completada / Entregada',
                'cancel': 'Cancelada'
            }
            results.append({
                'id': o['id'],
                'order_number': o['name'],
                'date': o['date_order'],
                'total': float(o['amount_total']),
                'state': o['state'],
                'state_display': state_map.get(o['state'], o['state']),
                'has_delivery': len(o.get('picking_ids', [])) > 0
            })
        return results

    def get_customer_invoices(self, email):
        self.ensure_auth()
        partner_ids = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=', email)]]
        )
        if not partner_ids:
            return []

        invoices = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move', 'search_read',
            [[('partner_id', 'in', partner_ids), ('move_type', '=', 'out_invoice')]],
            {'fields': ['id', 'name', 'invoice_date', 'amount_total', 'state', 'payment_state'], 'order': 'id desc'}
        )
        
        results = []
        for inv in invoices:
            state_map = {
                'draft': 'Borrador',
                'posted': 'Emitida / Publicada',
                'cancel': 'Cancelada'
            }
            pay_map = {
                'not_paid': 'Pendiente de Pago',
                'in_payment': 'En Proceso de Pago',
                'paid': 'Pagada',
                'partial': 'Parcialmente Pagada'
            }
            results.append({
                'id': inv['id'],
                'invoice_number': inv['name'],
                'date': inv.get('invoice_date') or "Pendiente",
                'total': float(inv['amount_total']),
                'state': inv['state'],
                'state_display': state_map.get(inv['state'], inv['state']),
                'payment_state': inv.get('payment_state', 'not_paid'),
                'payment_display': pay_map.get(inv.get('payment_state'), 'Pendiente')
            })
        return results

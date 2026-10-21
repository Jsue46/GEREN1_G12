import xmlrpc.client
import logging
from urllib.parse import urlparse
from config import ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD

logger = logging.getLogger(__name__)


class TimeoutTransport(xmlrpc.client.Transport):
    def __init__(self, timeout=20, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timeout = timeout

    def make_connection(self, host):
        connection = super().make_connection(host)
        connection.timeout = self.timeout
        return connection


class TimeoutSafeTransport(xmlrpc.client.SafeTransport):
    def __init__(self, timeout=20, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timeout = timeout

    def make_connection(self, host):
        connection = super().make_connection(host)
        connection.timeout = self.timeout
        return connection


class FreshServerProxy:
    """Crea un transporte XML-RPC por llamada.

    ``ServerProxy`` conserva una conexión HTTP interna y no es thread-safe. FastAPI
    ejecuta endpoints síncronos en varios hilos (especialmente las imágenes), por
    lo que compartir una sola instancia producía ``Request-sent`` y respuestas 502.
    """

    def __init__(self, url, transport_class):
        self.url = url
        self.transport_class = transport_class

    def __getattr__(self, method_name):
        def call(*args, **kwargs):
            proxy = xmlrpc.client.ServerProxy(
                self.url,
                transport=self.transport_class(),
                allow_none=True
            )
            return getattr(proxy, method_name)(*args, **kwargs)
        return call

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USER
        self.password = ODOO_PASSWORD
        self.uid = None
        transport_class = TimeoutSafeTransport if urlparse(self.url).scheme == "https" else TimeoutTransport
        self.common = FreshServerProxy(f"{self.url}/xmlrpc/2/common", transport_class)
        self.models = FreshServerProxy(f"{self.url}/xmlrpc/2/object", transport_class)

    def authenticate(self):
        try:
            self.uid = self.common.authenticate(self.db, self.username, self.password, {})
            if not self.uid:
                raise Exception("Credenciales invalidas para Odoo")
            return self.uid
        except Exception as e:
            logger.error(f"Error al autenticar en Odoo: {e}")
            raise

    def ping(self):
        self.ensure_auth()
        version = self.common.version()
        return {"uid": self.uid, "server_version": version.get("server_version", "desconocida")}

    def ensure_auth(self):
        if not self.uid:
            self.authenticate()

    def get_products(self, limit=50):
        self.ensure_auth()
        # Query active saleable products
        domain = [('sale_ok', '=', True)]
        fields = ['id', 'name', 'default_code', 'lst_price', 'qty_available', 'free_qty', 'categ_id', 'description_sale']
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
                'sku': p.get('default_code') or f"GZ-{p['id']}",
                'price': float(p['lst_price']),
                # free_qty excluye unidades ya reservadas por otros pedidos.
                'stock': float(p.get('free_qty', p.get('qty_available', 0))),
                'category': categ_name,
                'description': p.get('description_sale') or "",
                'image_url': f"/api/products/{p['id']}/image"
            })
        return result

    def get_products_by_ids(self, product_ids):
        self.ensure_auth()
        unique_ids = list(dict.fromkeys(int(product_id) for product_id in product_ids))
        if not unique_ids:
            return []
        products = self.models.execute_kw(
            self.db, self.uid, self.password,
            'product.product', 'search_read',
            [[('id', 'in', unique_ids), ('sale_ok', '=', True), ('active', '=', True)]],
            {'fields': ['id', 'name', 'default_code', 'lst_price', 'qty_available', 'free_qty']}
        )
        return [{
            'id': product['id'],
            'name': product['name'],
            'sku': product.get('default_code') or f"GZ-{product['id']}",
            'price': float(product['lst_price']),
            'stock': float(product.get('free_qty', product.get('qty_available', 0))),
        } for product in products]

    def get_product_image(self, product_id):
        self.ensure_auth()
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            'product.product', 'read',
            [[product_id], ['image_512', 'write_date']]
        )
        if not records or not records[0].get('image_512'):
            return None
        return {
            'content': records[0]['image_512'],
            'write_date': records[0].get('write_date') or ''
        }

    def get_or_create_customer(self, name, email, phone="", address="", city=""):
        self.ensure_auth()
        existing = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=ilike', email.strip())]],
            {'limit': 1}
        )
        if existing:
            values = {
                'name': name,
                'email': email.strip().lower(),
                'phone': phone,
                'street': address,
                'city': city,
                'customer_rank': 1
            }
            self.models.execute_kw(
                self.db, self.uid, self.password,
                'res.partner', 'write',
                [existing, values]
            )
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

    def create_quote_lead(self, partner_id, customer_name, total_amount, items_desc=""):
        """Registra la solicitud como oportunidad abierta, antes de convertirla en venta."""
        self.ensure_auth()
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            'crm.lead', 'create',
            [{
                'name': f"Cotización Web - {customer_name}",
                'partner_id': partner_id,
                'expected_revenue': total_amount,
                'probability': 25,
                'type': 'opportunity',
                'description': f"Cotización solicitada desde E-Commerce. Detalle:\n{items_desc}"
            }]
        )

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

    def complete_delivery(self, order_id):
        """Reserva y valida los albaranes para descontar la existencia física.

        Debe llamarse únicamente después de comprobar existencias y confirmar una
        compra. Crear una cotización nunca invoca este método.
        """
        self.ensure_auth()
        order = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'read',
            [[order_id], ['picking_ids']]
        )[0]
        picking_ids = order.get('picking_ids', [])
        for picking_id in picking_ids:
            picking = self.models.execute_kw(
                self.db, self.uid, self.password,
                'stock.picking', 'read',
                [[picking_id], ['state', 'move_line_ids_without_package']]
            )[0]
            if picking.get('state') in ('done', 'cancel'):
                continue
            self.models.execute_kw(
                self.db, self.uid, self.password,
                'stock.picking', 'action_assign',
                [[picking_id]]
            )
            picking = self.models.execute_kw(
                self.db, self.uid, self.password,
                'stock.picking', 'read',
                [[picking_id], ['move_line_ids_without_package']]
            )[0]
            move_line_ids = picking.get('move_line_ids_without_package', [])
            move_lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'stock.move.line', 'read',
                [move_line_ids, ['product_uom_qty', 'qty_done']]
            ) if move_line_ids else []
            for line in move_lines:
                self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'stock.move.line', 'write',
                    [[line['id']], {'qty_done': line.get('product_uom_qty', 0)}]
                )
            result = self.models.execute_kw(
                self.db, self.uid, self.password,
                'stock.picking', 'button_validate',
                [[picking_id]],
                {'context': {'skip_sms': True}}
            )
            # Odoo puede devolver el wizard de transferencia inmediata si no se
            # generaron líneas reservadas. Con stock suficiente no debería ocurrir.
            if isinstance(result, dict) and result.get('res_model') == 'stock.immediate.transfer':
                wizard_id = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'stock.immediate.transfer', 'create',
                    [{'pick_ids': [(6, 0, [picking_id])], 'show_transfers': False}]
                )
                self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'stock.immediate.transfer', 'process',
                    [[wizard_id]]
                )
        return picking_ids

    def get_sale_order(self, order_id):
        self.ensure_auth()
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'read',
            [[order_id], ['id', 'name', 'state', 'amount_total', 'partner_id', 'opportunity_id']]
        )
        if not records:
            raise ValueError("La cotización indicada no existe")
        return records[0]

    def get_sale_order_items(self, order_id):
        """Obtiene cantidades oficiales de una cotización para revalidar stock."""
        self.ensure_auth()
        order = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'read',
            [[order_id], ['order_line']]
        )
        if not order:
            raise ValueError("La cotización indicada no existe")
        line_ids = order[0].get('order_line', [])
        if not line_ids:
            return []
        lines = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order.line', 'read',
            [line_ids, ['product_id', 'product_uom_qty', 'display_type']]
        )
        return [{
            'product_id': line['product_id'][0],
            'name': line['product_id'][1],
            'quantity': float(line['product_uom_qty'])
        } for line in lines if line.get('product_id') and not line.get('display_type')]

    def mark_lead_won(self, lead_id):
        """Actualiza la probabilidad cuando la cotización se convierte en orden."""
        if not lead_id:
            return
        self.ensure_auth()
        self.models.execute_kw(
            self.db, self.uid, self.password,
            'crm.lead', 'write',
            [[lead_id], {'probability': 100}]
        )

    def quote_belongs_to_email(self, partner_id, email):
        self.ensure_auth()
        matching = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('id', '=', partner_id), ('email', '=ilike', email.strip())]]
        )
        return bool(matching)

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
            [[('email', '=ilike', email.strip())]]
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

    def get_customer_order_detail(self, order_id, email):
        self.ensure_auth()
        partner_ids = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=ilike', email.strip())]]
        )
        if not partner_ids:
            return None
        orders = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order', 'search_read',
            [[('id', '=', order_id), ('partner_id', 'in', partner_ids)]],
            {'fields': ['id', 'name', 'date_order', 'amount_untaxed', 'amount_tax', 'amount_total', 'state', 'order_line', 'picking_ids'], 'limit': 1}
        )
        if not orders:
            return None
        order = orders[0]
        lines = self.models.execute_kw(
            self.db, self.uid, self.password,
            'sale.order.line', 'read',
            [order.get('order_line', []), ['id', 'name', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal']]
        ) if order.get('order_line') else []
        state_map = {
            'draft': 'Cotización', 'sent': 'Cotización enviada', 'sale': 'Orden confirmada',
            'done': 'Completada', 'cancel': 'Cancelada'
        }
        return {
            'id': order['id'],
            'order_number': order['name'],
            'date': order['date_order'],
            'state': order['state'],
            'state_display': state_map.get(order['state'], order['state']),
            'subtotal': float(order['amount_untaxed']),
            'tax': float(order['amount_tax']),
            'total': float(order['amount_total']),
            'has_delivery': bool(order.get('picking_ids')),
            'lines': [{
                'id': line['id'],
                'name': line['name'],
                'product_id': line['product_id'][0] if line.get('product_id') else None,
                'quantity': float(line['product_uom_qty']),
                'price_unit': float(line['price_unit']),
                'subtotal': float(line['price_subtotal'])
            } for line in lines]
        }

    def get_customer_invoices(self, email):
        self.ensure_auth()
        partner_ids = self.models.execute_kw(
            self.db, self.uid, self.password,
            'res.partner', 'search',
            [[('email', '=ilike', email.strip())]]
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

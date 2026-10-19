# SEMI1_G12 - E-Commerce Integrado con ERP (Odoo), CRM y BI

Proyecto de Transformación Digital para el curso de **Sistemas Organizacionales y Gerenciales 1 (Segundo Semestre 2026)** — Universidad de San Carlos de Guatemala.

---

## 📌 Alcance de la Fase 3: Integración Backend y Portal de Cliente (Integrante 2)

Este repositorio contiene la solución completa para el rol de **Integrante 2**, encargada de la capa de comunicación, lógica de negocio y trazabilidad entre la plataforma E-Commerce y el ERP/CRM en la nube:

1. **Middleware API REST (FastAPI):** Servicio backend que recibe las solicitudes de compra del cliente y las procesa en Odoo sin intervención humana.
2. **Sincronización Bidireccional en Tiempo Real:**
   * **CRM (`crm.lead`):** Registra cada intento y venta como oportunidad ganada con su monto esperado.
   * **ERP Ventas (`sale.order`):** Genera la orden de venta confirmada.
   * **Inventario (`stock.picking`):** Descuenta el stock y genera la orden de despacho en almacén automáticamente.
3. **Facturación Funcional:** Al confirmar la compra, Odoo genera la factura de cliente (`account.move`) y la publica con correlativo contable oficial.
4. **Portal de Cliente:** Endpoints y vistas interactivas para que el comprador consulte el estado de sus pedidos y descargue sus facturas por correo.
5. **Suite de Pruebas de Flujo Completo:** Script automatizado (`tests/test_flow.py`) que valida la trazabilidad de extremo a extremo.

---

## 🏗️ Arquitectura del Sistema

```
[ Cliente / Tienda Web ]
          │  (JSON HTTP / REST)
          ▼
   [ Middleware FastAPI (Puerto 8000) ]
          │  (Protocolo XML-RPC)
          ▼
   [ Servidor Azure: Odoo 14 + PostgreSQL 13 (Puerto 8069) ]
      ├── res.partner (Clientes)
      ├── crm.lead (Oportunidades de CRM)
      ├── sale.order (Órdenes de Venta ERP)
      ├── stock.picking (Reserva y Despacho de Stock)
      └── account.move (Facturación Electrónica Contable)
```

---

## 🌐 Enlaces en Producción (Nube de Azure)

* **Servidor Odoo ERP/CRM:** [http://gamerzone-odoo.northcentralus.cloudapp.azure.com:8069](http://gamerzone-odoo.northcentralus.cloudapp.azure.com:8069)
* **Base de Datos:** `gamerzone_db`
* **Swagger API Docs (Local):** `http://localhost:8000/docs`
* **Tienda Web y Portal (Local):** `http://localhost:8000/store/index.html`

---

## 📁 Estructura del Repositorio

```text
SEMI1_G12/
├── backend/
│   ├── config.py              # Credenciales y endpoints de Odoo en Azure
│   ├── odoo_client.py         # Cliente XML-RPC para modelos de ERP, CRM, Stock y Facturación
│   ├── main.py                # Servidor FastAPI con endpoints REST y CORS
│   └── requirements.txt       # Dependencias de Python
├── frontend/
│   ├── index.html             # Catálogo de 45 productos, carrito y checkout
│   ├── portal.html            # Portal de consulta de pedidos y facturas por correo
│   ├── css/
│   │   └── style.css          # Estilo Dark Mode & Glassmorphism
│   └── js/
│       ├── app.js             # Lógica de tienda y llamada a POST /api/checkout
│       └── portal.js          # Lógica de consulta a GET /api/portal/*
├── tests/
│   └── test_flow.py           # Script de prueba integral paso a paso
├── docs/
│   └── manual_tecnico_integracion.md # Manual técnico oficial para entrega
└── README.md
```

---

## 🚀 Guía de Instalación y Ejecución

### 1. Clonar el Repositorio
```bash
git clone https://github.com/Jsue46/SEMI1_G12.git
cd SEMI1_G12
```

### 2. Instalar Dependencias
```bash
cd backend
pip install -r requirements.txt
```

### 3. Iniciar el Middleware
```bash
python main.py
```
El servicio estará disponible en `http://localhost:8000`.

### 4. Ejecutar la Prueba de Flujo Completo
En otra terminal:
```bash
cd tests
python test_flow.py
```

---

## 📄 Documentación Técnica

Para ver la especificación completa de los endpoints, mapeo detallado de campos con la base de datos de Odoo y evidencias de ejecución, consulta:
👉 [Manual Técnico de Integración](docs/manual_tecnico_integracion.md)

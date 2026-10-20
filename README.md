# SEMI1_G12 - E-Commerce Integrado con ERP (Odoo), CRM y BI

Proyecto de Transformación Digital para el curso de **Sistemas Organizacionales y Gerenciales 1 (Segundo Semestre 2026)** — Universidad de San Carlos de Guatemala.

---

## Alcance de la Fase 3: E-Commerce e Integración

Este repositorio contiene el sitio E-Commerce y la capa de integración con Odoo ERP/CRM:

1. **Catálogo y carrito (Integrante 1):** catálogo sincronizado de más de 30 productos, búsqueda, filtros, cantidades, eliminación, total y persistencia local.
2. **Registro y cotizaciones (Integrante 1):** alta de clientes, cotizaciones en borrador y conversión explícita a orden de venta.
3. **Manual de usuario (Integrante 1):** recorrido ilustrado con capturas de las pantallas principales.
4. **Middleware API REST (FastAPI):** Servicio backend que recibe las solicitudes del sitio y las procesa en Odoo.
5. **Sincronización Bidireccional en Tiempo Real:**
   * **CRM (`crm.lead`):** Registra cada intento y venta como oportunidad ganada con su monto esperado.
   * **ERP Ventas (`sale.order`):** Genera la orden de venta confirmada.
   * **Inventario (`stock.picking`):** Descuenta el stock y genera la orden de despacho en almacén automáticamente.
6. **Facturación Funcional:** Al convertir la cotización, Odoo confirma la venta, reserva inventario y publica la factura de cliente (`account.move`).
7. **Portal de Cliente:** Vista para consultar cotizaciones, pedidos y facturas por correo.
8. **Pruebas:** Contrato API aislado en `tests/test_api.py` y prueba integral en `tests/test_flow.py`.

---

## Arquitectura del Sistema

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

## Enlaces en Producción (Nube de Azure)

* **Servidor Odoo ERP/CRM:** [http://gamerzone-odoo.northcentralus.cloudapp.azure.com:8069](http://gamerzone-odoo.northcentralus.cloudapp.azure.com:8069)
* **Base de Datos:** `gamerzone_db`
* **Swagger API Docs (Local):** `http://localhost:8000/docs`
* **Tienda Web y Portal (Local):** `http://localhost:8000/store/`

---

## Estructura del Repositorio

```text
SEMI1_G12/
├── backend/
│   ├── config.py              # Credenciales y endpoints de Odoo en Azure
│   ├── odoo_client.py         # Cliente XML-RPC para modelos de ERP, CRM, Stock y Facturación
│   ├── main.py                # Servidor FastAPI con endpoints REST y CORS
│   └── requirements.txt       # Dependencias de Python
├── frontend/
│   ├── src/                   # Aplicación React + TypeScript
│   │   ├── components/        # Navegación, productos, formularios y carrito
│   │   ├── pages/             # Catálogo, cuenta, cotización y portal
│   │   ├── lib/api.ts         # Cliente tipado de la API FastAPI
│   │   └── store/             # Estado persistente con Zustand
│   ├── public/                # Recursos estáticos
│   ├── package.json           # Dependencias y comandos del frontend
│   └── vite.config.ts         # Build Vite bajo /store/
├── tests/
│   ├── test_api.py            # Pruebas aisladas de los endpoints web
│   └── test_flow.py           # Script de prueba integral paso a paso
├── docs/
│   ├── manual_tecnico_integracion.md  # Manual técnico oficial
│   ├── manual_usuario_ecommerce.md    # Manual del sitio con capturas
│   └── capturas/                      # Evidencia visual del flujo
└── README.md
```

---

## Guía de Instalación y Ejecución

### 1. Clonar el Repositorio
```bash
git clone https://github.com/Jsue46/SEMI1_G12.git
cd SEMI1_G12
```

### 2. Instalar dependencias del backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Compilar el frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

Para desarrollo con recarga automática puede ejecutar `npm run dev` dentro de `frontend`; Vite redirige `/api` al puerto 8000.

### 4. Iniciar el Middleware
```bash
cd backend
python main.py
```
El servicio estará disponible en `http://localhost:8000` y la tienda en `http://localhost:8000/store/`.

### 5. Ejecutar las pruebas del sitio
En otra terminal:
```bash
source .venv/bin/activate
python -m unittest tests.test_api -v
```

La prueba integral `tests/test_flow.py` crea registros reales en Odoo. Ejecútela solo cuando necesite validar el flujo completo de integración.

---

## Documentación

Para ver la especificación completa de los endpoints, mapeo detallado de campos con la base de datos de Odoo y evidencias de ejecución, consultar el documento oficial:
* [Manual Técnico de Integración](docs/manual_tecnico_integracion.md)
* [Manual de Usuario del E-Commerce](docs/manual_usuario_ecommerce.md)

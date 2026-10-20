# Manual de usuario del sitio web GamerZone

**Proyecto:** Transformación Digital en E-Commerce con ERP, CRM y BI - QuetzalDev  
**Módulo:** Sitio web E-Commerce  
**Versión:** 1.0  
**Fecha:** 19 de octubre de 2026

## 1. Objetivo

Este manual explica cómo navegar el catálogo, administrar el carrito, registrar un cliente, generar una cotización y convertirla en orden de venta. Las acciones comerciales se sincronizan con Odoo ERP y CRM mediante el middleware del proyecto.

## 2. Acceso al sitio

1. Compile el frontend e inicie el middleware:

   ```bash
   npm --prefix frontend install
   npm --prefix frontend run build
   cd backend && python main.py
   ```

2. Abra `http://localhost:8000/store/` en un navegador moderno.
3. Verifique que la página muestre el número de productos sincronizados. El catálogo actual devuelve 54 productos, por encima del mínimo solicitado de 30.

![Página de inicio de GamerZone](capturas/01_inicio.png)

## 3. Navegar y buscar productos

1. Seleccione **Explorar catálogo** o use **Catálogo** en la navegación.
2. Escriba el nombre, categoría o SKU en el campo **Buscar**.
3. Use los filtros de categoría para reducir los resultados.
4. Revise el precio, SKU y existencia reportada por Odoo.
5. Presione **Agregar** en el producto deseado.

![Catálogo con productos sincronizados](capturas/02_catalogo.png)

Si no hay coincidencias, el sitio muestra un estado vacío. Si Odoo no está disponible, se presenta un mensaje de error con la opción **Reintentar**.

## 4. Administrar el carrito

1. Presione **Carrito** en la navegación superior.
2. Use los botones `−` y `+` para modificar la cantidad.
3. Use el icono de papelera para eliminar una línea, o abra **Ver carrito completo** para administrar el pedido con más espacio.
4. Revise el total estimado, calculado automáticamente.
5. Use **Vaciar carrito** para eliminar todos los productos.
6. Presione **Generar cotización** para continuar.

El carrito queda guardado en el navegador. Si la página se actualiza, los productos y cantidades permanecen disponibles.

![Carrito de compras con cantidades y total](capturas/02_carrito.png)

## 5. Registrar un cliente

1. Presione **Crear cuenta** en la navegación superior.
2. Complete nombre, correo electrónico, teléfono, ciudad y dirección.
3. Presione **Crear cuenta**.
4. Espere el mensaje de confirmación.

El sistema valida los campos antes de enviarlos. El cliente se crea en Odoo como un registro `res.partner`; si el correo ya existe, se reutiliza ese cliente y no se duplica.

![Formulario de registro de cliente](capturas/03_registro_cliente.png)

Los datos registrados se guardan localmente para completar automáticamente futuras cotizaciones en el mismo navegador.

## 6. Generar una cotización

1. Agregue al menos un producto al carrito.
2. Abra el carrito y seleccione **Generar cotización**.
3. Confirme o complete los datos del cliente y presione **Revisar cotización**.
4. Revise productos, cantidades, datos y total estimado.
5. Presione **Guardar cotización**.

![Formulario para generar una cotización](capturas/04_generar_cotizacion.png)

El sistema realiza las siguientes acciones:

1. Registra o identifica al cliente en Odoo.
2. Crea una oportunidad abierta en CRM con probabilidad inicial de 25 %.
3. Crea una `sale.order` en estado `draft`.
4. Devuelve el número y total de la cotización al sitio web.

![Confirmación de cotización creada](capturas/05_cotizacion_creada.png)

Mientras no seleccione **Convertir en orden**, el documento permanece como cotización en Odoo y puede consultarse desde **Mis pedidos**.

## 7. Convertir la cotización en orden

1. En la confirmación de cotización, presione **Convertir en orden**.
2. El sistema verifica que el correo corresponda al cliente de la cotización.
3. Odoo confirma la orden, crea la reserva de inventario e intenta generar la factura.
4. El CRM actualiza la oportunidad a 100 %.
5. El sitio abre el detalle de la orden con sus líneas y totales oficiales. Si la configuración contable impide facturar, la orden permanece confirmada y se muestra una advertencia para completar la factura desde Odoo.

![Orden confirmada y factura generada](capturas/06_orden_confirmada.png)

Esta operación no puede repetirse sobre la misma cotización. Si ya fue confirmada, el sitio informa que no está disponible para una segunda conversión.

## 8. Consultar cotizaciones, órdenes y facturas

1. Presione **Mis pedidos**.
2. Ingrese el correo utilizado en el registro o la cotización.
3. Presione **Consultar**.
4. Revise la pestaña **Pedidos**. Las cotizaciones muestran el estado **Cotización** y las ventas confirmadas muestran **Orden confirmada**.
5. Abra **Facturas** para consultar documentos contables y estado de pago.

Después de convertir una cotización, el sitio abre su detalle. Use **Volver al portal** para regresar al historial con el correo ya completado.

## 9. Mensajes frecuentes

| Mensaje | Significado | Acción recomendada |
|---|---|---|
| Tu carrito está vacío | No existen líneas para cotizar | Agregue un producto |
| No pudimos cargar el catálogo | El middleware u Odoo no respondió | Verifique el servidor y presione **Reintentar** |
| Ingresa un correo válido | El formato del correo no es correcto | Corrija el correo antes de continuar |
| El correo no corresponde a esta cotización | La identidad indicada no coincide con el cliente | Use el mismo correo con el que generó la cotización |
| La cotización ya fue convertida | La orden ya está confirmada o cancelada | Consulte su estado en **Mis pedidos** |

## 10. Flujo resumido

```text
Catálogo -> Carrito -> Registro o identificación del cliente
         -> Cotización en borrador -> Conversión en orden
         -> Reserva de inventario -> Factura -> Portal de cliente
```

> Nota sobre las capturas: los números `S00120` e `INV/2026/0031` son datos demostrativos usados únicamente para documentar las pantallas de confirmación. En operación, Odoo asigna los correlativos reales.

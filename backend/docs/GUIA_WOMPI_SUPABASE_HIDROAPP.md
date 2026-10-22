# Guía de Wompi para HidroApp (Flutter + Express + Supabase)

Esta guía adapta la integración de Wompi a la app del Acueducto Veredal Campo Amor.
No uses los modelos `Orden`/`Transaccion`, las rutas de carrito ni las instrucciones
de MongoDB de la guía de TechStore: HidroApp registra cada intento en
`public.payments` y lo relaciona con `public.invoices` y `public.profiles`.

## Flujo de pago de esta app

1. Flutter obtiene una cotización para la factura y muestra el cargo estimado.
2. Flutter solicita registrar el pago a `POST /api/pagos`.
3. Express verifica que la factura pertenezca al usuario, calcula el importe desde
   Supabase y crea un pago pendiente. El backend firma el importe y devuelve los
   datos necesarios para abrir el checkout hospedado de Wompi.
4. Flutter abre `https://checkout.wompi.co/p/`.
5. Wompi notifica el cambio de estado a `POST /api/wompi/webhook`.
6. Express valida la firma del evento, la referencia y el importe. Al aprobarse,
   confirma el pago; el trigger de Supabase aplica el pago a la factura.

El cliente no confirma pagos. Volver desde el checkout no prueba que Wompi haya
aprobado la transacción: la confirmación confiable llega por el webhook.

## Paso 1: obtener las credenciales de Sandbox

En el dashboard de Wompi cambia al ambiente Sandbox/Pruebas y copia:

- Llave pública (`pub_test_...`).
- Secreto de integridad (`test_integrity_...`).
- Secreto de eventos (`test_events_...`).

Completa el alta del comercio con datos correctos para tu situación. Los datos,
perfiles sociales y ejemplos de la guía original corresponden a una tienda de
demostración y no son requisitos de HidroApp.

## Paso 2: configurar el backend

En el entorno local, configura `backend/.env`. En producción, agrega las mismas
variables en el panel del servicio donde está desplegado el backend (por ejemplo,
Railway). Usa los valores reales del dashboard; no copies llaves a Flutter.

```env
WOMPI_AMBIENTE=test
WOMPI_CURRENCY=COP
WOMPI_PUBLIC_KEY=pub_test_TU_LLAVE_PUBLICA
WOMPI_INTEGRITY_KEY=test_integrity_TU_SECRETO
WOMPI_EVENTS_SECRET=test_events_TU_SECRETO
WOMPI_FEE_RATE=0.0265
WOMPI_FIXED_FEE_COP=700
WOMPI_FEE_IVA_RATE=0.19
```

Los nombres `WOMPI_INTEGRITY_KEY` y `WOMPI_EVENTS_SECRET` son los que lee este
backend. El secreto de integridad se queda en Express; la llave pública puede
entregarse a la app. Las variables de tarifa son valores iniciales configurables:
confirma las tarifas contratadas con Wompi antes de cobrar a usuarios. Para que
el comprobante llegue por correo, configura además `BREVO_API_KEY` y `EMAIL_USER`;
el remitente debe estar habilitado en Brevo.

Con los valores de ejemplo (`2.65% + $700 + IVA`), una factura de $12.000 queda
con un cargo estimado de $1.251 y un total de checkout de $13.251. La cotización
usa un solo total para los medios habilitados en Wompi. Si tu contrato aplica
costos especiales por medio (por ejemplo, un programa adicional), confirma la
tarifa y ajusta `WOMPI_FEE_RATE`; el checkout actual no cotiza una tarifa distinta
después de que el pagador elige el medio.

## Paso 3: aplicar la migración de Supabase

En Supabase abre **SQL Editor**, pega y ejecuta una vez el contenido de estas cinco
migraciones, en este orden:

1. `backend/db/migrations/20261020_cargo_wompi.sql`
2. `backend/db/migrations/20261021_comprobante_pago_wompi.sql`
3. `backend/db/migrations/20261022_seguridad_perfil_y_pagos.sql`
4. `backend/db/migrations/20261023_consistencia_auditoria_y_cortes.sql`
5. `backend/db/migrations/20261024_triggers_pago_confirmado.sql`

La primera añade `cargo_wompi` y `monto_total`, preservando en `monto` el valor de
la factura. La segunda guarda el medio de pago reportado por Wompi y cuándo se
envió el comprobante por correo. La tercera restringe el acceso a los perfiles y
evita duplicar pagos pendientes. La cuarta alinea las columnas de auditoría y
cortes con los modelos. La quinta aplica la factura, reconecta el servicio y
crea la notificación en la misma transacción que confirma el pago.

No crees tablas MongoDB ni una tabla nueva de transacciones. Confirma en Table
Editor que `payments` tenga esas dos columnas antes de desplegar este código.

## Paso 4: desplegar y configurar el webhook

Wompi necesita una URL HTTPS accesible desde internet; `localhost` no sirve para
recibir eventos. Despliega el backend y revisa que su endpoint de salud responda:

```text
https://TU-DOMINIO/health
```

En el dashboard de Wompi, configura la URL de eventos de Sandbox como:

```text
https://TU-DOMINIO/api/wompi/webhook
```

Selecciona `transaction.updated`. Configura por separado la URL de eventos de
Sandbox y la de producción. El secreto de eventos configurado en cada ambiente
debe corresponder con el ambiente de las llaves del backend.

Para desarrollo local, puedes usar un túnel HTTPS temporal hacia el puerto 3000 y
registrar su URL de webhook en Sandbox. Si no tienes túnel, puedes desarrollar la
pantalla y crear pagos pendientes, pero Wompi no podrá notificar el resultado a
tu máquina local.

## Paso 5: ejecutar el flujo desde Flutter

1. Inicia el backend con `npm run dev` desde la carpeta `backend`.
2. Inicia la app Flutter apuntando a ese backend. En dispositivo físico, configura
   la URL de la API con la dirección accesible de tu computadora; `localhost` en
   el teléfono se refiere al propio teléfono.
3. Inicia sesión con un usuario que tenga una factura pendiente.
4. Abre la factura y elige pagar con Wompi.
5. Revisa el desglose del valor del servicio, cargo estimado y total; continúa al
   checkout hospedado.
6. Completa una transacción con los datos que Wompi indique para Sandbox.
7. Vuelve a la app y actualiza la lista de facturas o pagos para consultar el
   estado procesado por el webhook.

La cotización se obtiene en `GET /api/pagos/cotizacion-wompi/:facturaId`; el pago
se registra en `POST /api/pagos` con `{"factura_id":"...","metodo":"wompi"}`.
La firma y el monto final se preparan en el backend. El flujo Flutter está en
`frontend/hidroapp/lib/services/wompi_checkout_service.dart` y
`frontend/hidroapp/lib/services/pago_checkout_service.dart`.

## Paso 6: verificar el resultado

En Supabase abre `public.payments` y localiza el pago por su `id`/referencia:

- Antes de la notificación: `confirmado = false`, `estado_wompi = PENDING`.
- Si Wompi aprueba: `confirmado = true`, `estado_wompi = APPROVED` y
  `transaccion_id` contiene el identificador de Wompi. El correo del perfil
  recibe factura, periodo, valor del servicio, cargo, total cobrado, medio, fecha
  y referencia de la transacción.
- La factura relacionada pasa a `estado = pagada` si la validación de base de datos
  acepta el pago.
- En caso de rechazo/anulación, `estado_wompi` refleja el estado recibido y la
  factura permanece pendiente.
- Si se cobró en Wompi pero Supabase no pudo aplicar el pago, revisa
  `APPROVED_NO_APLICADO` y los logs del backend antes de intentar cobrar de nuevo.

También revisa **Mis pagos** en la app y los logs del servicio para mensajes con
prefijo `[wompi]`. No borres pagos pendientes o aprobados a ciegas: primero
verifica su estado en el dashboard de Wompi.

## Paso 7: pasar a producción

Después de validar Sandbox, configura en el dashboard de producción el webhook
HTTPS con `transaction.updated`. En el entorno del backend cambia de forma
conjunta:

```env
WOMPI_AMBIENTE=prod
WOMPI_PUBLIC_KEY=pub_prod_TU_LLAVE_PUBLICA
WOMPI_INTEGRITY_KEY=prod_integrity_TU_SECRETO
WOMPI_EVENTS_SECRET=prod_events_TU_SECRETO
```

Mantén `WOMPI_CURRENCY=COP` y revisa nuevamente las tarifas configuradas. No
mezcles llaves de Sandbox con producción. La llave privada de Wompi no se necesita
en el flujo actual porque el backend no consulta transacciones por polling.

## Resolución de problemas

- **La app informa que Wompi no está disponible:** comprueba que las tres llaves
  tengan prefijo del mismo ambiente y que estén cargadas en el proceso backend.
- **No abre el checkout:** revisa la respuesta de `POST /api/pagos`, la llave
  pública y los campos de firma; mira los logs del backend.
- **Wompi muestra pago aprobado y la app sigue pendiente:** verifica la URL HTTPS,
  el evento `transaction.updated`, el secreto de eventos y que el servicio esté
  desplegado con las variables del mismo ambiente.
- **El pago queda como `APPROVED_NO_APLICADO` o `MONTO_INVALIDO`:** no lo vuelvas
  a cobrar sin revisar primero la transacción y los logs; puede requerir una
  conciliación o devolución manual.
- **La factura se pagó pero no llegó el comprobante:** comprueba `BREVO_API_KEY`,
  `EMAIL_USER` y que `correo_comprobante_enviado_at` siga nulo. El backend responde
  error a Wompi si no puede enviar el correo; al reintentar el evento vuelve a
  intentar el comprobante sin aplicar el pago por segunda vez.

## Lo que debes completar tú

- Crear/activar el comercio Wompi y obtener las credenciales de Sandbox.
- Pegar las variables en `backend/.env` local y en el servicio de producción.
- Ejecutar la migración SQL en el proyecto Supabase correcto.
- Proporcionar una URL HTTPS pública y registrar el webhook en los dashboards de
  Sandbox y producción.
- Confirmar la tarifa Wompi real y sustituir los valores de ejemplo si aplica.
- Hacer una compra de prueba con el método de pago que permita tu Sandbox y revisar
  el pago y la factura en Supabase.

## Referencias oficiales

- [Widget y Web Checkout de Wompi](https://docs.wompi.co/docs/colombia/widget-checkout-web/)
- [Eventos y validación de webhooks de Wompi](https://docs.wompi.co/docs/colombia/eventos/)
- [Estados y consulta de transacciones](https://docs.wompi.co/docs/colombia/transacciones/)
- [Planes y tarifas oficiales de Wompi](https://wompi.co/es/co/planes-tarifas/)

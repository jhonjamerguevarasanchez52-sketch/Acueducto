# Tarea mensual de facturación

## Pagos en línea con Wompi

El móvil consulta `GET /api/pagos/cotizacion-wompi/:facturaId` para mostrar el
valor del servicio, el cargo estimado y el total. Después solicita `POST /api/pagos`
con `metodo: wompi`; el backend firma el total y la app abre el checkout hospedado
de Wompi. La factura se marca pagada por su valor de servicio solo tras validar el
webhook.

El pago físico se registra en `POST /api/pagos/:facturaId/recibo` con una imagen
JPG, PNG o WEBP de hasta 5 MB. El backend crea el bucket privado `payment-receipts`
en Supabase Storage al recibir el primer recibo; la imagen queda pendiente de
revisión y se puede abrir desde el historial de pagos y el panel administrativo.

Configura en el backend las llaves del mismo ambiente:

```env
WOMPI_AMBIENTE=test
WOMPI_CURRENCY=COP
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_INTEGRITY_KEY=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...
WOMPI_FEE_RATE=0.0265
WOMPI_FIXED_FEE_COP=700
WOMPI_FEE_IVA_RATE=0.19
```

Cuando Wompi confirma el pago, el backend conserva el valor del servicio en
`payments.monto`, registra el cargo y total cobrados, y envía un comprobante al
correo del perfil con la factura, periodo, desglose, medio y referencia. Para ese
correo configura `BREVO_API_KEY` y `EMAIL_USER` en el backend. Ejecuta también
`db/migrations/20261021_comprobante_pago_wompi.sql` para guardar el medio de pago y
la fecha del comprobante enviado; los reintentos del webhook vuelven a intentar
el correo si su envío falló.

Ejecuta también `db/migrations/20261022_seguridad_perfil_y_pagos.sql`: evita que
un usuario lea códigos internos o cambie su rol desde Supabase REST, reserva la
creación de pagos y averías al backend y evita dos pagos pendientes para una
misma factura, incluso si llegan solicitudes simultáneas.

Ejecuta `db/migrations/20261023_consistencia_auditoria_y_cortes.sql` para añadir
las columnas que usan los modelos de pagos/cortes y crear `admin_audit_log`.
Ejecuta `db/migrations/20261024_triggers_pago_confirmado.sql` para que la
confirmación del pago actualice la factura, reconecte el servicio, avise al
usuario y cierre intentos pendientes en la misma transacción.

El recargo se estima con la tarifa pública del Plan Avanzado (2,65% + $700 + IVA).
El backend lo calcula y guarda separado del valor de la factura; ejecuta la migración
`db/migrations/20261020_cargo_wompi.sql` antes de activar este cambio. Verifica en
tu panel Wompi que tu plan y medio de pago usan esa tarifa y ajusta las variables
si tu contrato es distinto.

## Pago anticipado de mensualidades

En la factura pendiente el usuario puede pagar 1, 6 o 12 periodos. El cargo de
Wompi se suma al checkout y se almacena separado del valor neto del servicio.
Con la tarifa base configurada, los valores estimados son:

| Periodos | Servicio neto | Cargo Wompi estimado | Total checkout |
| --- | ---: | ---: | ---: |
| 1 mes | $12.000 | $1.251 | $13.251 |
| 6 meses | $72.000 | $3.205 | $75.205 |
| 12 meses | $144.000 | $5.550 | $149.550 |

Antes de publicar el backend, ejecuta `db/migrations/20261026_pago_prepago_servicio.sql`.
La migración registra cada periodo cubierto para impedir que el cron vuelva a
facturarlo, guarda el detalle del plan en la factura y registra la fecha del pago
y la siguiente fecha de generación al confirmarse el pago. El próximo periodo se
factura el primer día del mes siguiente a su vencimiento según el cron mensual.
Ejemplo: semestre desde octubre 2026 → cubre oct 2026 a mar 2027; la factura de
abril 2027 se genera el 1 de mayo de 2027.

Reglas del plan:

- Solo se puede cambiar el plan si la factura no tiene un pago confirmado,
  físico o en curso en Wompi. Un intento rechazado (`DECLINED`, `VOIDED`,
  `ERROR`) o reemplazado no bloquea el cambio.
- Si el usuario elige semestre/año y no lo paga antes de que el cron facture el
  mes siguiente, la factura vuelve a ser mensual ($12.000), se le notifica y se
  genera la factura del nuevo mes con normalidad.
- Una factura anulada libera sus meses: ese mes se puede volver a emitir (a
  mano o con "Generar facturación" eligiendo el mes). El cron no revisa meses
  pasados por sí solo. Solo puede haber una factura de servicio activa por
  usuario y mes.
- La app desactiva los planes que incluyen un mes que ya tiene su propia factura.
- El comprobante por correo lista cada mensualidad pagada, el valor neto del
  servicio, la comisión Wompi, el total cobrado, la transacción y la próxima
  factura.

La migración es re-ejecutable; si ya la corriste antes, vuelve a ejecutarla.

El cálculo corresponde a la tarifa base del Plan Avanzado y puede cambiar según
el contrato y el medio de pago. Verifica los valores en tu cuenta Wompi antes de
cobrar. La tabla de tarifas oficial está en
https://wompi.com/es/co/planes-tarifas/.

En el panel de Wompi, apunta la URL de eventos al endpoint HTTPS público
`/api/wompi/webhook`, selecciona `transaction.updated` y usa llaves de Sandbox
para probar. Para producción, cambia conjuntamente ambiente y las tres llaves
por sus equivalentes `prod`; no mezcles llaves entre ambientes. No subas `.env` ni
compartas llaves privadas.

La tarea `npm run facturar-mensual` genera una factura de servicio para cada
perfil activo con el valor de la **tarifa residencial vigente** que el
administrador registra en el panel (tabla `rates`). Si no hay ninguna tarifa
vigente, usa $12.000 como respaldo y lo avisa en el resumen. Se factura el
periodo anterior al mes de ejecución, se evita duplicar facturas del mismo
periodo y se intenta enviar el aviso al correo registrado en cada perfil.

La fecha límite de pago es el día 15 del mes siguiente al periodo facturado. Para
generar o reintentar el envío de correo de un periodo específico manualmente:

```sh
npm run facturar-mensual -- 2026-09
```

## Tareas automáticas (pg_cron de Supabase)

Ya no hay que acordarse de facturar: Supabase llama al backend todos los días.

1. Aplicar en Supabase `db/migrations/20261030_mejoras_integrales.sql` y
   después `db/migrations/20261110_correcciones_revision.sql`.
2. En Render, definir `CRON_SECRET` con un valor largo y aleatorio:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. En el SQL Editor de Supabase, ejecutar UNA vez (con la URL real y el mismo
   secreto):

   ```sql
   select public.programar_tareas_hidroapp('https://hidro-app.onrender.com', 'TU_CRON_SECRET');
   ```

Esto programa:

| Tarea | Cuándo (hora Colombia) | Qué hace |
| --- | --- | --- |
| `hidroapp-vencer-facturas` | 00:10 diario | SQL puro: pasa a `vencida` las facturas pendientes con fecha límite cumplida y avisa en la app. |
| `hidroapp-tareas-diarias` | 06:00 diario | `POST /api/tareas/diarias`: los días 1 a 5 factura el mes anterior; vence facturas; envía recordatorio 3 días antes del vencimiento (correo + app). |
| `hidroapp-limpiar-audios` | cada hora | `POST /api/interno/limpiar-audios`: borra audios vencidos de GOTA. |
| `hidroapp-mantener-despierto` | cada 10 min, 5 a. m.–11 p. m. | `GET /health` para que el plan gratuito de Render no se duerma. |

Todo es idempotente: si una ejecución falla, la siguiente lo completa. Para correr
las tareas a mano: `npm run tareas-diarias`, o el botón del panel (un
administrador con sesión también puede llamar a `POST /api/tareas/diarias`).

La facturación escribe un resumen en los logs y lo devuelve al panel. Guarda en la factura cuándo se envió el correo, para que una nueva
ejecución del periodo reintente solo los envíos fallidos. El envío usa el proveedor
transaccional Brevo ya integrado en el backend; no usa la API de Gmail para enviar
desde una cuenta Gmail.

## Eliminación de usuarios

Las facturas y los pagos son la contabilidad del acueducto y **nunca se borran**:
un usuario con facturas o pagos no se puede eliminar (la API responde 409 con
`puedeDesactivar: true` y la base de datos lo impide con `ON DELETE RESTRICT`).
Para retirar a alguien, **desactívalo**: pierde el acceso y sale de la
facturación, pero se conserva su historial. Solo se pueden eliminar cuentas sin
movimientos (por ejemplo, creadas por error). Las averías asignadas a un
fontanero eliminado conservan su historial y quedan sin asignación.

## Reglas de las facturas

- Una factura solo queda `pagada` al registrar o confirmar su pago (trigger
  `validar_estado_factura`); no se puede marcar pagada a mano.
- Una factura pagada no se puede reabrir, anular ni cambiar de valor; solo admite
  una observación.

## Acceso de los usuarios

- El administrador crea la cuenta en el panel; nace verificada y le llega un
  correo con dos formas de entrar.
- **Entrar con código** (`POST /api/auth/codigo-acceso` y
  `POST /api/auth/ingresar-con-codigo`): la persona recibe un código de 6
  dígitos en el correo y entra sin contraseña.
- Los intentos fallidos se guardan en la tabla `auth_intentos`, así que el
  bloqueo por fuerza bruta sobrevive a los reinicios del servidor.

## Pagos de Wompi: qué puede hacer el administrador

- **Los pagos de Wompi no se confirman a mano.** Solo el aviso firmado de Wompi
  (webhook) prueba que el dinero llegó. El panel solo ofrece "Confirmar" en los
  recibos físicos.
- **Un checkout de Wompi nunca se borra mientras pueda cobrarse.** Si el usuario
  lo abrió y lo cerró sin pagar, a los 30 minutos se libera solo (o con el botón
  "Liberar"): queda en el historial como reemplazado y, si el usuario llega a
  pagarlo, el webhook todavía lo encuentra y el dinero queda registrado.
- **Cobrado sin aplicar** (`APPROVED_NO_APLICADO` o `MONTO_INVALIDO`): Wompi le
  cobró al usuario pero el pago no se pudo aplicar a la factura. Se devuelve el
  dinero desde el panel de Wompi y luego se usa "Marcar devuelto"
  (estado `REEMBOLSADO`).
- Una factura con un pago en curso no se puede anular ni cambiar de valor hasta
  resolver ese pago.

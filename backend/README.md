# Tarea mensual de facturación

La tarea `npm run facturar-mensual` genera una factura de servicio por **$12.000 COP**
para cada usuario activo con rol `usuario`. Se factura el periodo anterior al mes
de ejecución, se evita duplicar facturas del mismo periodo y se intenta enviar el
aviso al correo registrado en cada perfil.

La fecha límite de pago es el día 15 del mes siguiente al periodo facturado. Para
generar o reintentar el envío de correo de un periodo específico manualmente:

```sh
npm run facturar-mensual -- 2026-09
```

## Activación en Railway

1. En Supabase, ejecutar una vez `db/migrations/20261014_facturacion_mensual.sql`.
   Si el índice no puede crearse porque ya hay facturas de servicio duplicadas,
   resolver esos duplicados antes de continuar.
2. Crear un servicio **Cron** en Railway desde el mismo repositorio, con directorio
   raíz `backend` y comando `npm run facturar-mensual`.
3. Configurar el cron como `0 5 1 * *` (UTC), que corresponde a las 00:00 del
   primer día de cada mes en Colombia y factura el mes que acaba de terminar.
4. Copiar al servicio las variables de entorno del backend, en particular las de
   Supabase y `BREVO_API_KEY` / `EMAIL_USER` para el envío de correos.

La tarea escribe un resumen en los logs y termina con error si alguna factura o
correo falla. Guarda en la factura cuándo se envió el correo, para que una nueva
ejecución del periodo reintente solo los envíos fallidos. El envío usa el proveedor
transaccional Brevo ya integrado en el backend; no usa la API de Gmail para enviar
desde una cuenta Gmail.

## Eliminación de fontaneros

Para eliminar un fontanero y conservar el historial de averías asignadas, ejecutar
en Supabase `db/migrations/20261014_breakdown_assignee_delete.sql`. La migración
quita la asignación (`fontanero_id`) al borrar el perfil, sin eliminar las averías.
La eliminación de una cuenta de usuario sigue siendo permanente y borra su propio
historial asociado.

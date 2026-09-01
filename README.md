# HIDROAPP

Sistema de gestión digital para el Acueducto Veredal Comunitario Campo Amor, ubicado en la vereda Majo, sector Campo Amor — Garzón, Huila, Colombia.



## Equipo de desarrollo

- Deimer Jair León Tovar
- Jhon Jamer Guevara Sánchez
- Carlos Chavarro Ome

## Descripción

HIDROAPP es una plataforma que permite digitalizar y centralizar los procesos administrativos y operativos del Acueducto Campo Amor, reemplazando el manejo manual de usuarios, facturación, pagos, notificaciones y reporte de averías.

La documentación funcional del sistema se encuentra en el SRS v2.0 (IEEE 830).

## Arquitectura

El sistema cuenta con dos componentes independientes que utilizan Supabase como plataforma común:

```
Flutter / Dart ──────┐
                      ├──> Supabase
Node.js / Express ────┘     PostgreSQL + Auth + RLS
```

El frontend Flutter se conecta directamente con Supabase para autenticación y operaciones permitidas. El backend Node.js/Express proporciona una API REST para operaciones administrativas, pruebas e integraciones externas.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | Flutter / Dart |
| Backend | Node.js + Express 5.2.1 |
| Base de datos | PostgreSQL / Supabase |
| Autenticación | Supabase Auth + JWT |
| Seguridad | Row Level Security (RLS) |
| Pruebas | Postman |
| Control de versiones | Git / GitHub |
| Pagos | Wompi |
| Hosting planeado | Railway |

## Roles

- **Administrador:** gestiona usuarios, facturación, pagos, tarifas y cortes.
- **Fontanero:** atiende y actualiza las averías reportadas. El sistema contempla un único fontanero.
- **Usuario final:** consulta sus facturas, realiza pagos y reporta averías.

## Base de datos

Las principales tablas son:

- `profiles`
- `invoices`
- `payments`
- `payment_alerts`
- `breakdowns`
- `notifications`
- `rates`
- `service_outages`

La tabla `breakdowns` utiliza `zona` para identificar la ubicación del beneficiario que reporta la avería, no como zona de asignación del fontanero.

## Seguridad

El sistema utiliza:

- JWT mediante Supabase Auth.
- Middleware de autenticación y autorización por roles.
- Row Level Security (RLS) — una capa de restricción **a nivel de base de datos**, independiente del backend: incluso si una consulta llegara a saltarse la validación del middleware, RLS sigue impidiendo que un usuario lea o modifique datos que no le pertenecen.
- Variables de entorno para credenciales.
- Separación entre cliente público de Supabase y cliente administrativo con Service Role Key.

La `SUPABASE_SERVICE_KEY` y las credenciales privadas de Wompi nunca deben exponerse en el frontend ni almacenarse en el repositorio.

## Variables de entorno

Crear un archivo `.env` en la carpeta del backend con:

```
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_KEY=
PORT=3000
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=
WOMPI_EVENTS_SECRET=
```

## Instalación y ejecución

**Backend:**
```
cd backend
npm install
node server.js
```

**Frontend:**
```
cd frontend
flutter pub get
flutter run
```

## Endpoints principales

| Módulo | Endpoints |
|---|---|
| Autenticación | `POST /api/auth/registro`, `POST /api/auth/login` |
| Perfil | `GET /api/profile/mi-perfil`, `PUT /api/profile/mi-perfil` |
| Facturas | `GET /api/facturas`, `GET /api/facturas/:id` |
| Pagos | `GET /api/pagos`, `POST /api/pagos` |
| Averías | `POST /api/averias`, `GET /api/averias/mis-averias`, `GET /api/averias/zona`, `PUT /api/averias/:id` |
| Notificaciones | `GET /api/notificaciones`, `GET /api/notificaciones/no-leidas`, `PUT /api/notificaciones/:id/leida` |
| Tarifas | `GET /api/tarifas`, `GET /api/tarifas/vigente`, `POST /api/tarifas` |
| Cortes | `GET /api/cortes/mis-cortes`, `GET /api/cortes/estado` |
| Administración | `GET /api/admin/usuarios`, `PUT /api/admin/usuarios/:userId/rol` |

## Pagos

HIDROAPP integra Wompi para permitir pagos mediante Nequi, PSE y tarjeta.

El flujo previsto es:

```
Usuario → HIDROAPP → Wompi → Webhook → Backend → Actualización del pago
```

El backend valida el evento recibido antes de actualizar el estado del pago y de la factura.

## Git

Cada integrante trabaja en su propia rama. Los cambios se integran mediante Pull Request, revisión y aprobación antes de realizar el merge a `main`.

## Estado actual

- SRS v2.0 elaborado.
- Frontend y backend estructurados.
- Autenticación implementada y probada.
- Perfiles, averías y notificaciones probados.
- Validación de roles implementada.
- Pruebas de API realizadas mediante Postman.
- Integración con Wompi en desarrollo.
- Despliegue en Railway pendiente.

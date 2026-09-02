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

Copiar `.env.example` a `.env` y rellenar los valores:

```
SUPABASE_URL=
SUPABASE_KEY=                # clave publishable / anon (pública)
SUPABASE_SERVICE_KEY=        # Service Role Key — SECRETA, solo backend
PORT=3000
CORS_ORIGIN=                 # orígenes permitidos separados por coma; vacío = abierto

EMAIL_USER=                  # remitente verificado en Brevo
EMAIL_SENDER_NAME=Acueducto Campoamor
BREVO_API_KEY=

WOMPI_AMBIENTE=test          # test | prod
WOMPI_PUBLIC_KEY=
WOMPI_INTEGRITY_KEY=
WOMPI_EVENTS_SECRET=         # para validar la firma de los webhooks
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
| Salud | `GET /health` |
| Autenticación | `POST /api/auth/registro`, `POST /api/auth/login`, `POST /api/auth/verificar`, `POST /api/auth/reenviar-codigo`, `POST /api/auth/solicitar-recuperacion`, `POST /api/auth/resetear-password` |
| Perfil | `GET /api/profile/mi-perfil`, `PUT /api/profile/mi-perfil` |
| Facturas (usuario) | `GET /api/facturas`, `GET /api/facturas/:id` |
| Facturas (admin) | `GET /api/facturas/todas`, `POST /api/facturas`, `PUT /api/facturas/:id` |
| Pagos (usuario) | `GET /api/pagos`, `POST /api/pagos` |
| Pagos (admin) | `GET /api/pagos/todos`, `PUT /api/pagos/:id/confirmar` |
| Averías (usuario) | `POST /api/averias`, `GET /api/averias/mis-averias` |
| Averías (fontanero) | `GET /api/averias`, `PUT /api/averias/:id` |
| Notificaciones (usuario) | `GET /api/notificaciones`, `GET /api/notificaciones/no-leidas`, `PUT /api/notificaciones/marcar-todas`, `PUT /api/notificaciones/:id/leida` |
| Notificaciones (admin) | `POST /api/notificaciones` |
| Tarifas | `GET /api/tarifas`, `GET /api/tarifas/vigente` |
| Tarifas (admin) | `POST /api/tarifas`, `PUT /api/tarifas/:id` |
| Cortes (usuario) | `GET /api/cortes/mis-cortes`, `GET /api/cortes/estado` |
| Cortes (admin) | `GET /api/cortes`, `POST /api/cortes`, `PUT /api/cortes/:id/reconectar` |
| Administración | `GET /api/admin/usuarios`, `GET /api/admin/usuarios/:userId`, `PUT /api/admin/usuarios/:userId`, `PUT /api/admin/usuarios/:userId/rol`, `PUT /api/admin/usuarios/:userId/estado` |
| Wompi | `POST /api/wompi/webhook`, `GET /api/wompi/config` |

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
- Autenticación implementada (registro, verificación por código obligatoria en login, recuperación de contraseña).
- Las consultas del backend usan el JWT del usuario, por lo que RLS también aplica en esta ruta.
- Módulos de administración completos: facturación, confirmación de pagos, tarifas, cortes, notificaciones y gestión de usuarios (rol / activación).
- Módulo del fontanero: ve todas las averías y actualiza su estado.
- Integración con Wompi: webhook con verificación de firma y confirmación automática de pagos.
- Seguridad: `helmet`, rate limiting (general y estricto en `/api/auth`), control de intentos en los códigos de un solo uso, CORS configurable.
- Healthcheck (`GET /health`), manejador 404 y manejador central de errores.
- Esquema de base de datos y políticas RLS documentados en `db/schema.sql`.
- Pendiente: pruebas automatizadas y despliegue en Railway.

### Notas para desplegar en Railway

- Comando de inicio: `npm start`.
- Configurar todas las variables de entorno del `.env.example` en el panel de Railway.
- Registrar la URL `https://<tu-app>.up.railway.app/api/wompi/webhook` como URL de eventos en el panel de Wompi.
- `node_modules` ya no se versiona; Railway ejecuta `npm install` en cada despliegue.

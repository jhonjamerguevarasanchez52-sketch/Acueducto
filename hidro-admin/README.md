# HIDROAPP · Panel administrativo

Aplicación web React + Vite para administrar usuarios, facturas, pagos, cortes,
notificaciones y tarifas del Acueducto Campo Amor.

## Estructura

```text
hidro-admin/
├── public/                  # Recursos estaticos
├── src/
│   ├── assets/              # Imagenes usadas por la aplicacion
│   ├── components/          # Componentes compartidos
│   ├── config/              # Acciones y formularios administrativos
│   ├── features/
│   │   ├── auth/            # Acceso y recuperacion
│   │   ├── reports/         # Generacion de informes
│   │   └── sections/        # Vistas por seccion del panel
│   ├── services/            # Comunicacion con la API
│   ├── styles/              # Estilos base y tema
│   ├── utils/               # Formateadores y procesamiento CSV/Excel
│   ├── App.jsx              # Estado y coordinacion del panel
│   ├── index.css            # Punto de entrada de estilos
│   └── main.jsx             # Punto de entrada de React
├── .env.example             # Ejemplo de configuracion local
├── index.html               # Documento HTML de entrada
├── package.json             # Scripts y dependencias
└── vite.config.js            # Configuracion de Vite y proxy local
```

La configuracion de Render esta en `../render.yaml`, en la raiz del repositorio.

## Desarrollo local

Desde esta carpeta:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Edita `VITE_API_URL` en `.env.local` para apuntar al backend. La URL debe ser el
origen público del backend, sin `/api`; el panel agrega esa ruta automáticamente.
Para validar la compilación localmente, ejecuta `npm run build`.

## Despliegue en Render

En Render, crea un Blueprint conectado a este repositorio y selecciona el archivo
`render.yaml` de la raíz. Este define un Static Site llamado `hidro-admin`, instala
dependencias con `npm ci`, compila con Vite y publica `dist`. Los cambios enviados
a la rama conectada disparan una nueva publicación.

La variable pública `VITE_API_URL` está configurada inicialmente como
`https://hidro-app.onrender.com`. Si el backend tiene otra URL, cámbiala en el
Blueprint o en las variables de entorno del Static Site y vuelve a desplegar.

En las variables de entorno del backend, incluye el dominio generado por Render
en `CORS_ORIGIN`, junto con cualquier otro origen que ya utilice la aplicación.
Por ejemplo: `https://hidro-admin.onrender.com`. Sin ese origen, el navegador
bloqueará las solicitudes del panel a la API.

`VITE_API_URL` se incorpora al JavaScript durante la compilación, así que solo
debe contener una URL pública. No pongas claves privadas ni secretos `VITE_*`.

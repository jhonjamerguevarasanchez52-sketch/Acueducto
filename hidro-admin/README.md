# HIDROAPP · Panel administrativo

Aplicación web React + Vite para administrar usuarios, facturas, pagos, cortes,
notificaciones y tarifas del Acueducto Campo Amor.

## Estructura

```text
hidro-admin/
├── public/              # Archivos estáticos servidos tal cual
├── src/
│   ├── assets/          # Imágenes y recursos importados por la app
│   ├── components/      # Componentes reutilizables
│   ├── services/        # Comunicación con la API
│   ├── utils/            # Funciones auxiliares
│   ├── App.jsx           # Interfaz principal del panel
│   ├── App.css           # Estilos de la interfaz
│   ├── index.css         # Estilos globales
│   └── main.jsx          # Entrada de React
├── .env.example         # Ejemplo de configuración local
├── index.html           # Documento HTML de entrada
├── package.json         # Scripts y dependencias
└── vite.config.js       # Configuración de Vite y proxy local
```

La configuración de Render está en `../render.yaml`, en la raíz del repositorio.

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

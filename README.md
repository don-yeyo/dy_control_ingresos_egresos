# Control de Ingresos y Egresos — Don Yeyo S.A.

Sistema para la automatización y registro de movimientos de personal, artículos y documentación en los puestos de Vigilancia (Portería) y Recepción.

---

## 🚀 Arquitectura y Tecnologías

El proyecto sigue una arquitectura **cliente/servidor desacoplada** para desarrollo local, preparado para **despliegue unificado en Netlify** mediante Serverless Functions.

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + MSAL (Microsoft Authentication Library) |
| Backend | Node.js + Express (adaptado a Serverless con `serverless-http`) |
| Base de Datos | MySQL 8 (local o AWS RDS) |
| Autenticación | Azure Active Directory (cuentas `@donyeyo.com.ar`) |
| Deploy | Netlify (Front + Back unificados) |
| Estilos | CSS Variables + Glassmorphism + diseño Mobile-First |

---

## 📁 Estructura del Proyecto

```
dy_control_entradas_salidas/
├── client/                     # Frontend React + Vite
│   ├── src/
│   │   ├── components/         # Componentes UI reutilizables
│   │   │   ├── Button.jsx
│   │   │   ├── Drawer.jsx      # Menú lateral deslizable
│   │   │   ├── FormElements.jsx
│   │   │   ├── Header.jsx      # Header con avatar, nombre y logout
│   │   │   ├── Layout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── config/             # Configuración MSAL y constantes
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Vista de movimientos activos
│   │   │   ├── MovementForm.jsx# Formulario de nueva solicitud
│   │   │   └── Settings.jsx    # Configuración de usuario
│   │   ├── services/           # Capa de comunicación con la API
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env                    # Variables de entorno (NO subir a Git)
│   ├── .env.template           # Plantilla de variables de entorno
│   └── vite.config.js
├── server/                     # Backend Node.js + Express
│   ├── config/                 # Configuración de base de datos
│   ├── controllers/            # Lógica de negocio y queries MySQL
│   ├── routes/
│   │   ├── masters.js          # Endpoints de datos maestros
│   │   └── movements.js        # Endpoints de movimientos
│   ├── index.js                # Entrada del servidor Express
│   ├── netlify-handler.js      # Adaptador para Netlify Functions
│   ├── .env                    # Variables de entorno (NO subir a Git)
│   └── .env.template           # Plantilla de variables de entorno
├── docs/                       # Documentación técnica y dump de DB
├── netlify.toml                # Configuración de despliegue Netlify
├── package.json                # Scripts raíz (inicia ambos servicios)
├── start-mobile.bat            # Script para acceso desde red LAN
├── PRESENTACION_DIRECTORIO.md  # Presentación para el directorio (Logros y Visión)
└── README.md
```

---

## ⚙️ Configuración de Variables de Entorno

### Backend — `/server/.env`

Basarse en `/server/.env.template`:

```env
# Base de datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASS=tu_password
DB_NAME=Acceso_A_Planta
DB_PORT=3306

# Servidor
PORT=5000
NODE_ENV=development

# Paginación — registros por página en Mis Solicitudes (default: 20)
PAGE_SIZE_SOLICITUDES=20

# Azure AD (autenticación)
AZURE_AD_CLIENT_ID=tu_client_id
AZURE_AD_TENANT_ID=tu_tenant_id
AZURE_AD_CLIENT_SECRET=tu_client_secret

# Firma de Códigos QR (HMAC SHA-256)
QR_SECRET=tu_clave_secreta_para_qr_aqui

# Zona horaria (para consistencia con Argentina)
DB_TIMEZONE=-03:00
```

### Frontend — `/client/.env`

Basarse en `/client/.env.template`:

```env
# URL del backend (desarrollo local)
VITE_API_URL=http://localhost:5000/api

# Puerto del cliente Vite (opcional, default: 5173)
# Si lo cambiás, start-mobile.bat lo detectará automáticamente
# VITE_PORT=5173

# Azure AD (autenticación)
VITE_AZURE_AD_CLIENT_ID=tu_client_id
VITE_AZURE_AD_TENANT_ID=tu_tenant_id

# Intervalo de sincronización automática en segundos para portería (default: 60)
VITE_SYNC_INTERVAL_SECONDS=60

# Feature Flags (habilitar/deshabilitar funciones)
VITE_ENABLE_GOOGLE_LOGIN=true
VITE_ENABLE_DOCUMENTS=true
```

---

## 🚩 Feature Flags (Banderas de Funcionalidad)

El sistema permite habilitar o deshabilitar ciertas funciones mediante variables de entorno en el frontend (`client/.env`). Por defecto ambas están activas:

- `VITE_ENABLE_GOOGLE_LOGIN`: (true/false) Define si se muestra o no la opción de inicio de sesión con Google.
- `VITE_ENABLE_DOCUMENTS`: (true/false) Define si los usuarios pueden adjuntar documentación (Remitos, Facturas, etc.) a sus solicitudes.
- `VITE_ENABLE_QR`: (true/false) Habilita o deshabilita la generación y escaneo de códigos QR para autorizaciones.
- `VITE_MOCK_AUTH`: (true/false) **Modo Bypass**. Si es `true`, el sistema ignora el login real y entra como el usuario definido en `VITE_MOCK_AUTH_EMAIL`.
- `VITE_MOCK_AUTH_EMAIL`: El email del usuario a simular (ej: `gabrielt@donyeyo.com.ar`). **Requerido** si `VITE_MOCK_AUTH=true`.
- `VITE_ENABLE_VERSION_CHECK`: (true/false) Habilita o deshabilita el aviso de nueva versión contra el servidor. **Por defecto es false** para evitar bucles durante el desarrollo local.

> [!WARNING]
> El modo Mock Auth solo funciona en entorno de desarrollo (`npm run dev`). Si `VITE_MOCK_AUTH=true` pero no se define un email, el sistema mostrará una alerta y no permitirá el ingreso.

> [!NOTE]
> Para máxima seguridad, estas flags también se pueden configurar en el backend (`server/.env` como `ENABLE_GOOGLE_LOGIN`, `ENABLE_DOCUMENTS` y `ENABLE_QR`) para asegurar que la API rechace peticiones no permitidas.

---

## 🔔 Notificaciones Push
El sistema utiliza **Web Push Notifications** para alertar en tiempo real a los distintos actores del flujo de movimientos.

### Configuración del Servidor (.env)
Para que las notificaciones funcionen, deben generarse llaves VAPID:
1. Ejecutar en el servidor: `node generate_vapid_v2.js` (generará un archivo `vapid_env.txt`).
2. Copiar las llaves resultantes al `.env` del servidor:
   - `VAPID_PUBLIC_KEY=`
   - `VAPID_PRIVATE_KEY=`

### Escenarios cubiertos

| Evento | Quién recibe | Mensaje |
|---|---|---|
| Solicitante crea una solicitud | **Autorizante** | "Nueva solicitud pendiente" |
| Autorizante aprueba la solicitud | **Solicitante** | "Solicitud aprobada" |
| Autorizante rechaza la solicitud | **Solicitante** | "Solicitud rechazada + motivo" |
| Autorizante anula la solicitud | **Solicitante** | "Solicitud anulada + motivo" |
| Autorizante crea en nombre de otro | **Solicitante (personaInterna)** | "Movimiento creado en tu nombre" |
| Portero completa el movimiento (manual o QR) | **Autorizante** | "Paso registrado en portería + hora" |

### Suscripciones por dispositivo
La tabla `push_subscriptions` almacena una suscripción **por navegador/dispositivo**. Un mismo usuario puede tener múltiples registros si usa la app desde distintos navegadores o tiene installada la PWA. Las suscripciones expiradas se eliminan automáticamente al primer intento fallido de envío.

---

### 🧪 Script de diagnóstico (`server/test_push.js`)

Permite probar el sistema de notificaciones **sin necesidad de deployar**. Se ejecuta directamente desde la carpeta `server/`.

```bash
# Modo: solo verificar suscripciones del email (sin enviar nada)
node test_push.js check gabrielt@donyeyo.com.ar

# Modo: enviar una notificación genérica de prueba
node test_push.js send leonelc@donyeyo.com.ar

# Modo: simular "nueva solicitud pendiente" → para probar notificación al AUTORIZANTE
node test_push.js request gabrielt@donyeyo.com.ar

# Modo: simular "solicitud aprobada" → para probar notificación al SOLICITANTE
node test_push.js status leonelc@donyeyo.com.ar

# Modo: simular "movimiento creado en tu nombre" → para probar notificación al SOLICITANTE
node test_push.js created leonelc@donyeyo.com.ar

# Modo: simular "paso registrado en portería" → para probar notificación al AUTORIZANTE
node test_push.js porteria gabrielt@donyeyo.com.ar
```

El script verifica que las VAPID keys estén configuradas, lista las suscripciones activas del email, envía la notificación a todos los dispositivos registrados, e informa si alguna suscripción fue expirada y eliminada automáticamente.

---

## 🔐 Configuración de Azure AD

Para que el login con cuentas `@donyeyo.com.ar` funcione:

1. Ingresá al [Portal de Azure](https://portal.azure.com/).
2. Ir a **Microsoft Entra ID** → **App registrations** → **New registration**.
3. **Nombre:** `Control Accesos Don Yeyo`.
4. **Supported account types:** `Accounts in this organizational directory only (Single tenant)`.
5. **Redirect URI:** Seleccionar `Single-page application (SPA)` y agregar:
   - Desarrollo: `http://localhost:5173`
   - Producción: `https://tu-app.netlify.app`
6. En **Authentication**, marcar `Access tokens` e `ID tokens`.
7. Copiar el **Application (client) ID** y el **Directory (tenant) ID**.
8. En **Certificates & secrets** → **Client secrets** → **New client secret**.
9. Copiar el `Value` generado.

> [!IMPORTANT]
> Guardá el valor del secret inmediatamente. Azure no lo vuelve a mostrar.

---

## 📦 Instalación y Ejecución Local

### Primera vez

```bash
# Desde la raíz del proyecto
npm install && npm run install-all
```

### Desarrollo (servidor + cliente simultáneos)

```bash
npm run dev
```

Esto levanta:
- **Backend** en `http://localhost:5000`
- **Frontend** en `http://localhost:5173`

### Iniciar por separado

```bash
# Solo el backend
npm run server

# Solo el frontend
npm run client
```

### Exponer el cliente en la red local (para celular/tablet)

Al iniciar el frontend para acceso desde la red, hay que arrancar Vite con el flag `--host`:

```bash
cd client
npx vite --host
```

Luego correr `start-mobile.bat` para obtener la URL y configurar el firewall (ver sección siguiente).

---

## 📱 Acceso desde Dispositivos Móviles (Red LAN)

El archivo `start-mobile.bat` permite acceder al sistema desde cualquier celular o tablet conectado a la misma red Wi-Fi, **sin iniciar ningún servidor** (asume que ya están corriendo).

### ¿Qué hace el script?

1. **Lee el puerto del cliente** desde `client/.env` (variable `VITE_PORT`, default: `5173`).
2. **Detecta la IP** de la máquina en la red local automáticamente.
3. **Abre el firewall de Windows** para ese puerto (requiere aceptar permisos de administrador).
4. **Muestra la URL** completa para ingresar desde el celular.

### Pasos para usarlo

1. Iniciá el backend: `npm run server`
2. Iniciá el frontend con host habilitado: `cd client && npx vite --host`
3. Ejecutá **`start-mobile.bat`** (puede pedir permisos de administrador para el firewall).
4. En tu celular (misma red Wi-Fi), abrí la URL que muestra el script, ej: `http://192.168.1.15:5173`

> [!NOTE]
> Si querés que `npm run dev` siempre exponga el cliente en la red, descomentá `host: true` en `client/vite.config.js`.

---

## ☁️ Despliegue en Netlify

El proyecto está configurado para un **despliegue unificado** (Front + Back en el mismo sitio de Netlify):

1. Subir el código a un repositorio de GitHub.
2. En Netlify, crear un **New site from Git** apuntando al repositorio.
3. Netlify leerá `netlify.toml` automáticamente (build + redirects de la API).
4. En **Site Settings → Environment variables**, configurar:
   - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`
   - `VITE_AZURE_AD_CLIENT_ID`, `VITE_AZURE_AD_TENANT_ID`
   - `VITE_API_URL` → `/api` (relativo, en producción Netlify resuelve internamente)
5. Netlify compilará el React y convertirá el Express en una **Netlify Function** accesible bajo `/api`.

---

## 📲 Progressive Web App (PWA)

El sistema está configurado como una **Progressive Web App**, lo que permite instalarlo en dispositivos móviles y de escritorio sin pasar por ninguna tienda de aplicaciones.

### ¿Cómo instalar la app?

**En Android (Chrome):**
1. Abrí el sitio en Chrome.
2. Aparecerá el banner *"Agregar a la pantalla de inicio"* o bien tocá el menú ⋮ → **Instalar app**.

**En iOS (Safari):**
1. Abrí el sitio en Safari.
2. Tocá el ícono de **Compartir** → **Agregar a pantalla de inicio**.

**En escritorio (Chrome/Edge):**
1. Entrá al sitio.
2. En la barra de direcciones aparecerá el ícono de instalación (⊕). Hacé clic en él.

### Estrategia de caché (Workbox)

| Tipo de recurso | Estrategia | Cache |
|---|---|---|
| Assets estáticos (JS, CSS, íconos) | **Cache First** (pre-caché al instalar) | Permanente hasta nueva versión |
| Llamadas a `/api/*` | **Network First** | 24 hs · máx. 100 entradas |

El Service Worker se **actualiza automáticamente** (`registerType: 'prompt'`): cuando se despliega una nueva versión, el SW se reemplaza en segundo plano y recarga la app.

## 🔄 Actualizaciones del Sistema

A partir de la v1.0.10, el sistema incluye un **Chequeo de Versión Forzoso** que compara la versión del cliente con la del servidor mediante una API dedicada (`/api/system/version`).

- Si detecta que estás en una versión atrasada, verás un **modal bloqueante**.
- Al presionar **Actualizar**, la app intentará desregistrar el caché antiguo para forzar la carga de la última versión.

### ¿Cómo actualizar en caso de errores?

| Dispositivo | Método |
|---|---|
| **PWA (Mobile/Desktop)** | Usar el botón de actualización en el modal. Si persiste, cerrar y volver a abrir la app. |
| **Navegador Desktop (vía web)** | Usar <kbd>Ctrl</kbd> + <kbd>F5</kbd> (limpiar caché y recargar). |
| **Navegador Mobile** | Arrastrar hacia abajo para refrescar. Si no funciona, cerrar la pestaña y abrir de nuevo. |

### Build con soporte PWA

```bash
cd client
npm run build
npm run preview   # verifica en http://localhost:4173
```

### Verificación con Lighthouse

En Chrome DevTools → pestaña **Lighthouse** → categoría **Progressive Web App** → el score debería ser ≥ 90.

---

## 📖 Guía de Uso

### 1. Inicio de Sesión

Al ingresar, el sistema redirige al portal de Microsoft. Usar cuenta corporativa `@donyeyo.com.ar`. El nombre y avatar del usuario logueado se muestran en el header.

### 2. Dashboard

Visualiza los movimientos activos registrados en el día. Las tarjetas cambian de color según el estado (Pendiente / Completado) y muestran quién autorizó el movimiento.

### 2.1. Autorización mediante Código QR 📱
Para agilizar el paso por los puntos de control, el sistema cuenta con validación por QR:
- **Usuario Portante:** En la sección "Mis Solicitudes", las autorizaciones en estado **Pendiente** muestran un botón *"Mostrar Código QR"*. Al pulsarlo, se genera un código único firmado digitalmente.
- **Sincronización en Tiempo Real:** Una vez que el portero escanea el código, la pantalla del usuario portante recibe la confirmación automáticamente, muestra un mensaje de éxito y refresca su listado de solicitudes, cerrando el QR sin intervención del usuario.
- **Personal de Portería:** Dispone de un botón flotante (FAB) con el icono de QR. Al escanear, el sistema valida la firma y la vigencia. 
    - **Alerta de Fichaje:** Si el movimiento requiere fichaje (motivos distintos a "Requerimiento Laboral"), el portero verá una alerta visual prominente indicando que debe solicitar el fichaje al personal antes de dejarlo pasar.

### 3. Nueva Solicitud (Formulario de Movimiento)

- Elegí el origen y destino del movimiento.
- **Artículos/Documentos:** Pulsá "Agregar" para vincular herramientas o remitos. Podés marcar artículos como "Sin Retorno" (consumibles).
- **Comportamiento según el rol del usuario:**
  - **Usuario autorizador:** el campo "Persona a autorizar" es un buscador editable (con opción de búsqueda extendida). El movimiento pasa directamente a estado **Pendiente**.
  - **Usuario NO autorizador:** el campo "Persona a autorizar" muestra su propio nombre en **modo de solo lectura** (no puede modificarlo). El subtítulo del formulario cambia a *"Complete los datos para solicitar autorización para un ingreso o egreso."* Debe seleccionar un autorizante; el movimiento queda en estado **Solicitado** hasta que el autorizante lo apruebe.
- **Persistencia de preferencias:** los valores del formulario (tipo, origen, destino, motivo y autorizante seleccionado) se recuerdan en `localStorage` para la próxima vez que el usuario abra el formulario.
- **Búsqueda extendida:** el checkbox "Búsqueda extendida" (solo disponible para autorizadores) cambia la búsqueda de inicio de palabra a coincidencia en cualquier parte del nombre. La preferencia también se persiste en `localStorage`.
- **Cantidad de artículos/documentos:** Se controla con los botones `+` y `−` para mejor compatibilidad en dispositivos móviles.

### 7. Grupos de Movimientos Encadenados (Series)

Cuando un movimiento tiene **retorno** (`conRegreso=1`) y es aprobado, el sistema invoca `sp_GenerarMovimientosDerivados` que genera automáticamente la serie completa de movimientos enlazados por `idGrupo` y `ordenGrupo`.

#### Reglas de visibilidad en "Mis Solicitudes"

| Estado del grupo | Qué ve el usuario |
|---|---|
| **Solicitado** | Solo el primer movimiento (`ordenGrupo=1`) |
| **Aprobado → Pendiente** | El **próximo paso a ejecutar** (menor `ordenGrupo` no completado) |
| **Completados** | Se ven **todos** individualmente |
| **Anulado** | El representante del grupo (primer `ordenGrupo` no completado, ya anulado) |
| **Rechazado** | Solo el `ordenGrupo=1` (los derivados no existen aún al momento de rechazar) |
| **Vencido parcial** | El primero vencido y los consecutivos (los ya completados no se tocan) |

Un badge **🔗 Paso N/M · X ✓** en cada card indica el número de paso dentro de la serie y cuántos están completados.

#### Consistencia de artículos y documentos

Los artículos y documentos tienen su propio sistema de estados (`objetoEstados`: Recibido, Entregado, Devuelto...) con semántica diferente a los estados de movimientos. **No se propagan automáticamente**: su estado lo gestiona el flujo de recepción/entrega en el tablero de vigilancia.

#### Objetos de base de datos requeridos

Ejecutar **una sola vez** el script `server/group_management.sql` contra la BD:

```bash
mysql -u root -p Acceso_A_Planta < server/group_management.sql
```

Esto crea:
- **SP** `sp_AnularGrupo(idMovimiento, observacion)` — anula toda la serie activa del grupo (sin tocar artículos/documentos)
- **SP** `sp_VencerConsecutivos(idMovimiento)` — vence los pasos siguientes al que venció (llamar desde el proceso que marca movimientos como Vencidos)

### 4. Mis Solicitudes

Accesible desde el menú lateral. Permite:
- **Usuarios sin rol autorizador:** ver todas sus solicitudes y el estado de cada una.
- **Usuarios con rol autorizador:** ver sus propias solicitudes + las que requieren su aprobación, con notificación de las pendientes. Pueden **aprobar**, **rechazar** o **anular** directamente desde la tarjeta.
- **Paginación:** El listado está paginado del lado del servidor. La cantidad de registros por página se configura con la variable de entorno `PAGE_SIZE_SOLICITUDES` (default: 20).
- **Filtros server-side:** Se puede filtrar por estado. El filtrado se resuelve en el servidor para mayor eficiencia. Incluye filtro "Anulados".
- **Indicador de vencida:** Los movimientos en estado **Pendiente** cuya fecha autorizada ya pasó se muestran con badge naranja *"Vencida"* y borde naranja, sin alterar el estado real en DB.

#### Acciones del autorizante por estado

| Estado del movimiento | Acciones disponibles |
|---|---|
| **Solicitado** | Aprobar → pasa a Pendiente · Rechazar → pasa a Rechazado |
| **Pendiente** | Anular → pasa a Anulado |

#### Estados de movimiento

| Estado | Color | Descripción |
|---|---|---|
| **Solicitado** | Amarillo | Creado por un no-autorizador, espera aprobación. |
| **Pendiente** | Azul | Aprobado, listo para ejecución en portería. |
| **Vencida** *(visual)* | Naranja | Pendiente cuya fecha ya pasó. Solo indicador visual, no cambia DB. |
| **Completado** | Verde | Registrado por el personal de seguridad. |
| **Rechazado** | Rojo | El autorizante rechazó la solicitud antes de aprobarla. |
| **Anulado** | Violeta | El autorizante anuló el movimiento después de haberlo aprobado. |
| **Vencido** | Gris | El movimiento superó su fecha de validez (estado real en DB). |

### 5. Configuración

Accesible desde el menú lateral (Drawer). Permite ajustar preferencias del usuario.

### 6. Auditoría

Todas las acciones (creación, edición, eliminación) se guardan automáticamente en la tabla `auditoria` de la base de datos mediante triggers configurados en MySQL.

### 8. Roles y Jerarquía de Usuarios

El sistema utiliza un esquema de roles jerárquicos definido por el campo `idRol` en la tabla `legajos`. A mayor ID de rol, mayores son los permisos acumulados.

| ID Rol | Nombre | Permisos |
|---|---|---|
| **1** | Usuario | Solicitante estándar. Puede crear solicitudes (estado Solicitado). |
| **2** | RRHH | **Autorizante por defecto**. Acceso al módulo de **Gestión de Legajos** para administrar roles y estados de autorizador del personal. |
| **100** | Sysadmin | **Administrador total**. Incluye todos los permisos de RRHH y acceso técnico total. |

#### Reglas de Jerarquía:
- Un rol superior hereda todos los permisos del inferior (ej: el rol 100 tiene permisos de 2 y 1).
- Los roles **2 (RRHH)** y **100 (Sysadmin)** son marcados automáticamente como **Autorizantes** (`esAutorizador = 1`).
- Solo RRHH y Sysadmin pueden visualizar el punto de menú secreto en el Drawer para gestionar la tabla de legajos.

### 9. Autorizaciones Recurrentes

El sistema permite marcar una autorización como **Recurrente** (disponible para roles RRHH o superiores). 

- **Funcionamiento**: Cuando un movimiento marcado como recurrente es **Completado** en portería, el sistema genera automáticamente una copia idéntica del movimiento (incluyendo artículos y documentos) para el **día siguiente**.
- **Encadenados**: Si el movimiento original tenía retorno, la recurrencia generará el ciclo completo (Salida y Entrada) para la nueva fecha.
- **Identificación**: Las observaciones del movimiento clonado comenzarán con el prefijo `[RECURRENTE]`.

---

## 🗄️ Actualización de Base de Datos (v1.1.0)

Al actualizar desde una versión anterior, ejecutar el script `update_states.sql` en la base de datos:

```sql
-- Agrega columna esAutorizador a legajos y los nuevos estados
source update_states.sql;
```

El script:
1. Agrega la columna `esAutorizador` (tinyint, default 0) a la tabla `legajos`.
2. Inserta los estados `Solicitado` (id=4), `Rechazado` (id=5) y `Anulado` (id=6) en `movimientoEstados`.
3. Los usuarios autorizadores deben marcarse con `esAutorizador = 1` directamente en la base de datos.

> [!NOTE]
> Si ya ejecutaste el script en una versión anterior, podés agregar el nuevo estado manualmente:
> ```sql
> INSERT INTO movimientoEstados (id, nombre) VALUES (6, 'Anulado')
> ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
> ```

---

## 🛠️ Scripts Disponibles

Desde la **raíz del proyecto**:

| Script | Descripción |
|---|---|
| `npm run dev` | Inicia backend + frontend simultáneamente |
| `npm run server` | Inicia solo el backend (puerto 5000) |
| `npm run client` | Inicia solo el frontend (puerto 5173) |
| `npm run install-all` | Instala dependencias en `/server` y `/client` |

---

## 🛡️ Backoffice de Portería

Módulo diseñado para el personal de vigilancia/recepción de cada punto de control. Accesible desde el Drawer únicamente si el email del usuario logueado corresponde a una cuenta de portería.

### Cuentas de portería configuradas

| Email | Dependencia |
|---|---|
| `vigilancia-pe@donyeyo.com.ar` | Planta Pellegrini |
| `vigilancia-hy@donyeyo.com.ar` | Planta Hipólito Yrigoyen |
| `vigilancia-er@donyeyo.com.ar` | Planta Elguea Román |

### Setup inicial (una sola vez)

Ejecutar el script contra la base de datos:

```bash
mysql -u root -p Acceso_A_Planta < server/porteria_setup.sql
```

Esto:
1. Agrega las columnas `fechaHoraCompletado` y `observacionPorteria` a la tabla `movimientos`
2. Crea las tablas `porterias` y `porteriaDependencias`
3. Inserta los datos de las 3 porterías y sus dependencias

### Funcionalidades

**Pendientes del día** (`/porteria`)
- Cards con los movimientos en estado **Pendiente** del día, filtrados por los lugares de esa portería
- Visualización de artículos y documentos adjuntos
- Al expandir: presetea la hora actual (editable), campo de observación y botón **Completar**
- Respeta la lógica de grupos: muestra el primer paso pendiente de cada serie
- **Escaneo de QR:** Botón flotante (FAB) siempre disponible para procesar entradas/salidas en segundos sin búsqueda manual. Al escanear con éxito, la lista de pendientes se actualiza automáticamente.
- **Sincronización automática:** la pantalla se actualiza en segundo plano según el intervalo definido en `VITE_SYNC_INTERVAL_SECONDS`.

**Historial** (`/porteria/historial`)
- Filtros por rango de fechas y estado
- Tabla paginada (50 registros por página)
- **Exportación a Excel** (.xlsx) de todos los registros filtrados

### 🛠️ Administración de Porteros y Dependencias

Para que un usuario pueda acceder al módulo de portería y ver los movimientos correspondientes, se deben seguir estos pasos en la base de datos:

1.  **Habilitar el Usuario como Portero**:
    Agregar un registro en la tabla `porterias`. 
    - `email`: El correo electrónico `@donyeyo.com.ar` del usuario.
    - `nombre`: Nombre descriptivo (ej: "Portería Planta 1").
    - `activa`: Debe estar en `1`.

2.  **Asignar Lugares de Control**:
    Un portero solo ve movimientos relacionados con sus dependencias asignadas. Esto se configura en la tabla intermedia `porteriaDependencias`.
    - `idPorteria`: El ID generado en el paso anterior.
    - `idLugar`: El ID de la tabla `lugares` que esa portería debe controlar.
    
    > [!TIP]
    > Si una portería controla múltiples lugares (ej: Entrada Principal y Playa de Carga), simplemente agregue múltiples filas en `porteriaDependencias` para esa misma `idPorteria`.
    
    **Lógica de visibilidad**: Un movimiento aparecerá en la pantalla del portero si el **Origen** O el **Destino** coinciden con alguno de sus lugares asignados.

---

## 🔒 Seguridad

- Los archivos `.env` **no deben subirse a Git** (ya están en `.gitignore`).
- Usá siempre los archivos `.env.template` como referencia para onboarding.
- El `start-mobile.bat` crea una regla de firewall con nombre `DonYeyo_Client`. Podés eliminarla manualmente desde el **Panel de control → Firewall de Windows → Reglas de entrada** cuando ya no la necesites.

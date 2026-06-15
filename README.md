# FoodStore — Sistema de Gestión de Pedidos de Comida

Aplicación web full-stack para la gestión integral de un negocio de comidas. Permite a clientes explorar el catálogo, agregar productos al carrito, realizar pedidos con pago integrado vía MercadoPago y hacer seguimiento en tiempo real mediante WebSocket. Administradores gestionan el catálogo, stock, pedidos y usuarios desde un panel centralizado.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand |
| Backend | FastAPI (Python 3.12+) + SQLModel + PostgreSQL |
| Infra | Docker, WebSocket, Cloudinary (imágenes), MercadoPago Checkout PRO |

## Estructura del Proyecto

```
├── .gitignore
├── README.md
├── FoodStore-Backend/       # API REST + WebSocket + MercadoPago + Cloudinary
│   ├── app/
│   ├── tests/               # 238 tests
│   └── docker-compose.yml   # PostgreSQL 16
└── FoodStore-Frontend/      # SPA React + TypeScript
    ├── src/
    ├── package.json
    └── vite.config.ts
```

## Requisitos

- **Python 3.12+** con pip
- **Node.js 18+** con npm
- **Docker Desktop** (para PostgreSQL)

## Levantar el Proyecto

### Backend

```bash
cd FoodStore-Backend

# Entorno virtual
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Dependencias
pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux

# Base de datos
docker compose up -d

# Iniciar servidor
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Swagger disponible en `http://localhost:8000/docs`

### Frontend

```bash
cd FoodStore-Frontend

# Dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abrir `http://localhost:5173`

### Tests

```bash
# Backend
cd FoodStore-Backend
python -m pytest tests/ -v

# Frontend
cd FoodStore-Frontend
npm test
```

## Variables de Entorno

### Backend (`FoodStore-Backend/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql+psycopg://dev_user:dev_password@localhost:5435/parcial_db` |
| `SECRET_KEY` | Clave secreta para JWT (mín 32 chars) | `clave-secreta-minimo-32-caracteres` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `["http://localhost:5173"]` |
| `COOKIES_SECURE` | `true` en producción (HTTPS), `false` en desarrollo | `false` |
| `MP_ACCESS_TOKEN` | Token de acceso de MercadoPago | `TEST-xxxxxxxx` |
| `MP_PUBLIC_KEY` | Public Key de MercadoPago | `TEST-xxxxxxxx` |
| `MP_WEBHOOK_URL` | URL del webhook IPN de MP | `https://xxx.ngrok-free.app/api/v1/pagos/webhook` |
| `NGROK_URL` | URL pública del túnel Ngrok | `https://xxx.ngrok-free.app` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary | `mi-cloud-name` |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary | `123456789012345` |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary | `abcDefGh...` |

### Frontend (`FoodStore-Frontend/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL base de la API | `/api/v1` |
| `VITE_WS_URL` | URL del WebSocket | `ws://localhost:5173/api/v1/ws` |

Estas variables no son obligatorias — los valores por defecto en el código fuente cubren el desarrollo local. Solo se necesitan si el entorno de desarrollo difiere.

## Credenciales de Prueba

El seed crea 4 usuarios para probar todos los roles:

| Rol | Email | Contraseña |
|-----|-------|------------|
| ADMIN | `admin@foodstore.com` | `Admin1234!` |
| STOCK | `stock@foodstore.com` | `Stock1234!` |
| PEDIDOS | `pedidos@foodstore.com` | `Pedidos1234!` |
| CLIENT | `cliente@foodstore.com` | `Cliente1234!` |

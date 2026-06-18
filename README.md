# FoodStore — Sistema de Gestión de Pedidos de Comida

Aplicación web full-stack para la gestión integral de un negocio de comidas. Permite a clientes explorar el catálogo, agregar productos al carrito, realizar pedidos con pago integrado vía MercadoPago y hacer seguimiento en tiempo real mediante WebSocket. Administradores gestionan el catálogo, stock, pedidos y usuarios desde un panel centralizado.

## Integrantes

- Federico Frankenberger
- Emilia Barros
- Miguel Barrera
- Guadalupe Maricchiolo

## Video de presentación

[Ver video de presentación](https://youtu.be/8cT_cX9te9Y)

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + TanStack Query + Zustand + Recharts |
| Backend | FastAPI (Python 3.12+) + SQLModel + PostgreSQL 16 |
| Infra | Docker, WebSocket, Cloudinary (imágenes), MercadoPago Checkout PRO |

---

## Estructura del Proyecto

```
TPI_PROG4/
├── README.md
├── FoodStore-Backend/          # API REST + WebSocket + MercadoPago + Cloudinary
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, routers, lifespan
│   │   ├── core/               # Config, seguridad, deps, WS manager, rate limiter, logging
│   │   ├── models/             # 16 entidades SQLModel
│   │   ├── repositories/       # 14 repositorios + BaseRepository[T]
│   │   ├── routers/            # 10 routers (70 endpoints + 5 estadísticas)
│   │   ├── schemas/            # Schemas Pydantic v2 (Create/Update/Read)
│   │   ├── services/           # 11 servicios de negocio
│   │   ├── uow/                # Unit of Work (context manager)
│   │   └── db/                 # Seed data (4 roles, 5 estados, 30 productos, usuarios demo)
│   ├── tests/                  # 238 tests de integración
│   ├── alembic/                # 6 migraciones
│   ├── docker-compose.yml      # PostgreSQL 16 + pgAdmin
│   └── .env.example
└── FoodStore-Frontend/         # SPA React + TypeScript
    ├── src/
    │   ├── api/                # Cliente HTTP (Axios con interceptors JWT)
    │   ├── components/         # Componentes reutilizables
    │   ├── hooks/              # Custom hooks (WebSocket)
    │   ├── pages/              # Páginas por feature
    │   │   ├── admin/          # Dashboard, CRUDs (productos, pedidos, etc.)
    │   │   ├── checkout/       # Checkout y pago
    │   │   ├── pedidos/        # Listado y detalle de pedidos
    │   │   └── direcciones/    # Gestión de direcciones
    │   ├── services/           # Llamadas a la API
    │   ├── stores/             # 5 stores Zustand (auth, cart, WS, etc.)
    │   ├── types/              # Tipos TypeScript
    │   └── __tests__/          # 164 tests
    ├── package.json
    └── vite.config.ts
```

---

## Requisitos

- **Python 3.12+** con pip
- **Node.js 18+** con npm
- **Docker Desktop** (para PostgreSQL)

---

## Levantar el Proyecto

### 1. Backend

```bash
cd FoodStore-Backend

# Entorno virtual
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

# Dependencias
pip install -r requirements.txt

# Variables de entorno
copy .env.example .env        # Windows
cp .env.example .env          # macOS/Linux
# Editar .env con tus credenciales (ver sección Variables de Entorno)

# Base de datos (PostgreSQL en Docker)
docker compose up -d

# Túnel público para webhooks de MercadoPago (requiere cuenta Ngrok)
ngrok http 8000

# Iniciar servidor
fastapi dev app/main.py
```

- Swagger UI: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`
- El servidor aplica migraciones y ejecuta el seed automáticamente al iniciarse.

### 2. Frontend

```bash
cd FoodStore-Frontend

# Dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abrir `http://localhost:5173`

El frontend proxea `/api/*` hacia `http://localhost:8000` — no se necesita configurar CORS manualmente en desarrollo.

---

## Variables de Entorno

### Backend (`FoodStore-Backend/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql+psycopg://dev_user:dev_password@localhost:5435/parcial_db` |
| `SECRET_KEY` | Clave secreta para JWT (mín. 32 chars) | `clave-secreta-minimo-32-caracteres` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `["http://localhost:5173"]` |
| `COOKIES_SECURE` | `true` en producción (HTTPS), `false` en desarrollo | `false` |
| `MP_ACCESS_TOKEN` | Token de acceso de MercadoPago | `TEST-xxxxxxxx` |
| `MP_PUBLIC_KEY` | Public Key de MercadoPago | `TEST-xxxxxxxx` |
| `NGROK_URL` | URL pública del túnel Ngrok (para webhooks de MercadoPago) | `https://xxx.ngrok-free.app` |
| `FRONTEND_URL` | URL del frontend (para redirect post-pago) | `http://localhost:5173` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary | `mi-cloud-name` |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary | `123456789012345` |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary | `abcDefGh...` |

### Frontend (`FoodStore-Frontend/.env`)

Las variables `VITE_*` son opcionales en desarrollo local; los valores por defecto cubren `localhost`.

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `/api/v1` |
| `VITE_WS_URL` | `ws://localhost:5173/api/v1/ws` |

---

## Credenciales de Prueba

El seed crea 4 usuarios para probar todos los roles:

| Rol | Email | Contraseña |
|-----|-------|------------|
| ADMIN | `admin@foodstore.com` | `Admin1234!` |
| STOCK | `stock@foodstore.com` | `Stock1234!` |
| PEDIDOS | `pedidos@foodstore.com` | `Pedidos1234!` |
| CLIENT | `cliente@foodstore.com` | `Cliente1234!` |

pgAdmin disponible en `http://localhost:5050` — email: `admin@admin.com` / password: `admin`.

---

## API

Prefijo base: `/api/v1`

| Módulo | Descripción |
|--------|-------------|
| **Auth** | Registro, login, refresh, logout, `/me`, CRUD usuarios (ADMIN) |
| **Productos** | CRUD + stock + disponibilidad + ingredientes + categorías |
| **Pedidos** | CRUD + FSM 5 estados + historial append-only |
| **Pagos** | MercadoPago Checkout PRO + webhook IPN |
| **Categorías** | CRUD + árbol jerárquico + imagen Cloudinary |
| **Direcciones** | CRUD + dirección principal por usuario |
| **Ingredientes** | CRUD + stock + alérgenos |
| **Unidades de Medida** | CRUD |
| **Uploads** | Cloudinary (upload + delete) |
| **Estadísticas** | Ventas por período, top productos, pedidos por estado, ingresos por forma de pago, resumen |
| **WebSocket** | `/api/v1/ws` — notificaciones en tiempo real de cambios de estado de pedidos |

Todos los errores siguen RFC 7807 (Problem Details). Los endpoints de listado devuelven paginación (`items`, `total`, `page`, `size`, `pages`).

---

## Tests

```bash
# Backend (238 tests de integración contra PostgreSQL real)
cd FoodStore-Backend
python -m pytest tests/ -v

# Frontend (164 tests)
cd FoodStore-Frontend
npm test
```

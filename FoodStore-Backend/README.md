# FoodStore Backend

API REST + WebSocket para la gestión de pedidos de comida. Desarrollada con FastAPI + SQLModel + PostgreSQL.

## Stack

- Python 3.12+
- FastAPI (framework REST + WebSocket + OpenAPI)
- SQLModel (ORM + schemas Pydantic)
- PostgreSQL 16 (Docker)
- Alembic (migraciones)
- MercadoPago SDK (Checkout PRO)
- Cloudinary SDK (gestión de imágenes)
- Pytest (238 tests)

## Instalación

```bash
# Entorno virtual
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales reales

# Base de datos
docker compose up -d

# Iniciar servidor
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Swagger: `http://localhost:8000/docs`
Redoc: `http://localhost:8000/redoc`

## Tests

```bash
python -m pytest tests/ -v
```

238 tests de integración usando TestClient de FastAPI contra PostgreSQL real.

## Variables de Entorno

Ver `.env.example` para la lista completa. Variables principales:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión a PostgreSQL (Docker expone puerto 5435) |
| `SECRET_KEY` | Clave para firmar JWT (mín 32 caracteres) |
| `CORS_ORIGINS` | Orígenes permitidos (frontend) |
| `MP_ACCESS_TOKEN` | Token de MercadoPago (modo prueba: `TEST-...`) |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary |

## Docker

```bash
docker compose up -d      # Iniciar PostgreSQL + pgAdmin
docker compose down       # Detener
docker compose down -v    # Detener y eliminar datos (reset completo)
```

pgAdmin disponible en `http://localhost:5050` (email: `admin@admin.com`, password: `admin`).

## Estructura

```
app/
├── main.py              # FastAPI app, CORS, routers, lifespan
├── core/                # Config, seguridad, deps, WS manager, rate limiter, logging
├── models/              # 16 entidades SQLModel
├── repositories/        # 14 repositorios + BaseRepository[T]
├── routers/             # 10 routers (70 endpoints + 5 estadísticas)
├── schemas/             # Schemas Pydantic v2 (Create/Update/Read)
├── services/            # 11 servicios de negocio
├── uow/                 # Unit of Work (context manager)
└── db/                  # Seed data (4 roles, 5 estados, 30 productos, usuarios demo)

tests/                   # 238 tests
alembic/                 # 6 migraciones
```

## API

Prefijo: `/api/v1`

- **Auth**: registro, login, refresh, logout, `/me`, CRUD usuarios (ADMIN)
- **Productos**: CRUD + stock + disponibilidad + ingredientes + categorías
- **Pedidos**: CRUD + FSM 5 estados + historial append-only
- **Pagos**: MercadoPago Checkout PRO + webhook IPN
- **Categorías**: CRUD + árbol jerárquico + imagen Cloudinary
- **Direcciones**: CRUD + principal por usuario
- **Ingredientes**: CRUD + stock + alérgenos
- **Unidades de Medida**: CRUD
- **Uploads**: Cloudinary (upload + delete)
- **Estadísticas**: 5 endpoints (ventas, top productos, pedidos por estado, ingresos, resumen)
- **WebSocket**: `/api/v1/ws` — notificaciones en tiempo real

## Mensajes de Error

Todos los errores siguen RFC 7807 (Problem Details) con formato:

```json
{
  "detail": "Mensaje descriptivo",
  "code": "ERROR_CODE",
  "field": "campo_opcional"
}
```

## Paginación

Endpoints de listado devuelven:

```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

import app.models

from alembic.config import Config
from alembic import command
from app.core.config import configuracion
from app.core.logger import setup_logging
from app.core.middleware.logging_middleware import LoggingMiddleware
from app.core.middleware.timing_middleware import TimingMiddleware
from app.core.exceptions.exception_handlers import register_exception_handlers
from app.core.rate_limiter import limiter
from app.db.seed import ejecutar_seed
from app.routers import auth, categorias, direcciones, estadisticas, ingredientes, pagos, pedidos, productos, unidades_medida, uploads, websocket


def aplicar_migraciones() -> None:
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    from app.services.uploads_service import init_cloudinary
    init_cloudinary()
    aplicar_migraciones()
    setup_logging()  # re-aplica tras alembic fileConfig()
    ejecutar_seed()
    yield


app = FastAPI(
    title="API Parcial 1 - Catálogo de Productos",
    description="Backend del parcial integrador — FastAPI + SQLModel + PostgreSQL",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate limiting (slowapi) ───────────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# ── Middlewares propios (orden de ejecución: Logging → Timing → CORS) ─────────
# En Starlette, add_middleware agrega en orden LIFO (el último agregado se
# ejecuta primero). Para que el orden sea Logging → Timing → CORS, los
# registramos en el orden inverso: CORS primero, luego Timing, luego Logging.
app.add_middleware(
    CORSMiddleware,
    allow_origins=configuracion.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TimingMiddleware)
app.add_middleware(LoggingMiddleware)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routers ───────────────────────────────────────────────────────────────────
_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=_PREFIX)
app.include_router(direcciones.router, prefix=_PREFIX)
app.include_router(categorias.router, prefix=_PREFIX)
app.include_router(estadisticas.router, prefix=_PREFIX)
app.include_router(ingredientes.router, prefix=_PREFIX)
app.include_router(productos.router, prefix=_PREFIX)
app.include_router(unidades_medida.router, prefix=_PREFIX)
app.include_router(pedidos.router, prefix=_PREFIX)
app.include_router(pagos.router, prefix=_PREFIX)
app.include_router(uploads.router, prefix=_PREFIX)
app.include_router(websocket.router, prefix=_PREFIX)

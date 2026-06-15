"""
Infraestructura de tests de integración.

Estrategia:
- Los tests corren contra una BD PostgreSQL real separada (parcial_test_db).
- Se crea automáticamente si no existe (requiere el contenedor Docker activo).
- Las tablas se crean una vez por sesión de pytest (scope="session").
- Los datos de usuario/direcciones/tokens se truncan después de cada test.
- La tabla `rol` NO se trunca: se seedea una vez y persiste.
- Se parchea `app.uow.uow.get_session` para que use el engine de test.

Fixtures adicionales:
- `client_sqlite`: TestClient con SQLite in-memory para tests de middlewares
  y exception handlers que no necesitan la BD de Postgres.
"""

import os

# ── Env vars ANTES de cualquier import de la app ─────────────────────────────
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://dev_user:dev_password@127.0.0.1:5435/parcial_test_db",
)
os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-para-tests-minimo-32-caracteres-ok",
)
os.environ.setdefault("DIAS_EXPIRACION_REFRESH_TOKEN", "1")
# Forzamos un límite bajo para que los tests de rate limiting sean rápidos.
# Pydantic-settings prioriza os.environ sobre .env, por lo que esto
# sobreescribe cualquier valor del .env en el entorno de tests.
os.environ.setdefault("RATE_LIMIT_LOGIN", "5/minute")

# ── Imports (después de setear env vars) ────────────────────────────────────
import pytest
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine
from fastapi.testclient import TestClient

# ── Engine de test ────────────────────────────────────────────────────────────
_TEST_DB_URL = os.environ["DATABASE_URL"]
_ADMIN_DB_URL = "postgresql+psycopg://dev_user:dev_password@127.0.0.1:5435/postgres"
_CONNECT_ARGS = {"options": "-c client_encoding=utf8"}

test_engine = create_engine(_TEST_DB_URL, echo=False, connect_args=_CONNECT_ARGS)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _crear_db_si_no_existe() -> None:
    admin_engine = create_engine(
        _ADMIN_DB_URL,
        isolation_level="AUTOCOMMIT",
        connect_args=_CONNECT_ARGS,
    )
    try:
        with admin_engine.connect() as conn:
            existe = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = 'parcial_test_db'")
            ).fetchone()
            if not existe:
                conn.execute(text("CREATE DATABASE parcial_test_db"))
    finally:
        admin_engine.dispose()


def _seed_roles() -> None:
    from app.models.rol import Rol

    roles = [
        Rol(codigo="ADMIN",   nombre="Administrador",  descripcion="Acceso total sin restricciones"),
        Rol(codigo="STOCK",   nombre="Encargado Stock", descripcion="Actualiza stock y disponible"),
        Rol(codigo="PEDIDOS", nombre="Gestor Pedidos",  descripcion="Avanza estados CONFIRMADO→ENTREGADO"),
        Rol(codigo="CLIENT",  nombre="Cliente",         descripcion="Opera solo sus propios datos"),
    ]
    with Session(test_engine) as sesion:
        for rol in roles:
            if not sesion.get(Rol, rol.codigo):
                sesion.add(rol)
        sesion.commit()


def _seed_estados_pedido() -> None:
    from app.models.estado_pedido import EstadoPedido

    estados = [
        EstadoPedido(codigo="PENDIENTE",      descripcion="Pedido recibido, pendiente de confirmación", orden=1, es_terminal=False),
        EstadoPedido(codigo="CONFIRMADO",      descripcion="Pedido confirmado, en preparación pendiente",  orden=2, es_terminal=False),
        EstadoPedido(codigo="EN_PREPARACION",  descripcion="En preparación",                               orden=3, es_terminal=False),
        EstadoPedido(codigo="ENTREGADO",       descripcion="Entregado al cliente",                         orden=4, es_terminal=True),
        EstadoPedido(codigo="CANCELADO",       descripcion="Cancelado",                                    orden=5, es_terminal=True),
    ]
    with Session(test_engine) as sesion:
        for estado in estados:
            if not sesion.get(EstadoPedido, estado.codigo):
                sesion.add(estado)
        sesion.commit()


def _seed_formas_pago() -> None:
    from app.models.forma_pago import FormaPago

    formas = [
        FormaPago(codigo="MERCADOPAGO",   descripcion="Checkout API MercadoPago",  habilitado=True),
        FormaPago(codigo="EFECTIVO",      descripcion="Pago en efectivo (pickup)", habilitado=True),
        FormaPago(codigo="TRANSFERENCIA", descripcion="Transferencia bancaria",    habilitado=True),
    ]
    with Session(test_engine) as sesion:
        for forma in formas:
            if not sesion.get(FormaPago, forma.codigo):
                sesion.add(forma)
        sesion.commit()


def _seed_unidades() -> None:
    from app.models.unidad_medida import UnidadMedida
    from sqlmodel import select

    unidades = [
        UnidadMedida(nombre="kilogramo",      simbolo="kg",  tipo="masa"),
        UnidadMedida(nombre="gramo",          simbolo="g",   tipo="masa"),
        UnidadMedida(nombre="litro",          simbolo="L",   tipo="volumen"),
        UnidadMedida(nombre="mililitro",      simbolo="mL",  tipo="volumen"),
        UnidadMedida(nombre="pieza",          simbolo="u",   tipo="unidad"),
        UnidadMedida(nombre="docena",         simbolo="doc", tipo="unidad"),
        UnidadMedida(nombre="metro cuadrado", simbolo="m²",       tipo="área"),
        UnidadMedida(nombre="porciones",      simbolo="porciones", tipo="contable"),
    ]
    with Session(test_engine) as sesion:
        existentes = {u.simbolo for u in sesion.exec(select(UnidadMedida)).all()}
        for u in unidades:
            if u.simbolo not in existentes:
                sesion.add(u)
        sesion.commit()


def get_test_session() -> Session:
    return Session(test_engine)


# ── Fixtures de sesión (una vez por run de pytest) ────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    _crear_db_si_no_existe()
    import app.models  # noqa: F401 — registra todos los modelos en SQLModel.metadata
    # Eliminar refresh_token manualmente (ya no forma parte del metadata)
    with test_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS refresh_token CASCADE"))
        conn.commit()
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)
    _seed_roles()
    _seed_estados_pedido()
    _seed_formas_pago()
    _seed_unidades()
    yield


# ── Fixtures de función (limpian datos entre tests) ──────────────────────────

@pytest.fixture(autouse=True)
def limpiar_datos():
    yield
    with Session(test_engine) as sesion:
        sesion.execute(text(
            "TRUNCATE TABLE historial_estado_pedido, detalle_pedido, pedido, "
            "usuario_rol, direccion_entrega, usuario, "
            "producto_ingrediente, producto_categoria, producto, ingrediente, "
            "categoria "
            "RESTART IDENTITY CASCADE"
        ))
        sesion.commit()


@pytest.fixture(autouse=True)
def reset_token_blacklist():
    """Limpia la blacklist de JTIs antes de cada test para evitar contaminación."""
    import app.core.token_blacklist as bl
    bl._revoked_jtis.clear()
    yield
    bl._revoked_jtis.clear()


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Limpia los contadores de rate limiting antes de cada test."""
    from app.core.rate_limiter import limiter
    try:
        limiter._storage.reset()
    except Exception:
        pass
    yield


@pytest.fixture(autouse=True)
def reset_ws_manager():
    """Limpia el manager de WebSockets antes y después de cada test.

    Evita que sockets zombis de un test anterior bloqueen broadcasts
    del test siguiente (race condition entre cierre de WS y envío).
    """
    from app.core.websocket_manager import manager
    manager.rooms.clear()
    manager.socket_rooms.clear()
    yield
    manager.rooms.clear()
    manager.socket_rooms.clear()


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setattr("app.uow.uow.get_session", get_test_session)
    from app.main import app
    return TestClient(app, raise_server_exceptions=True, base_url="https://testserver")


# ── Datos de prueba reutilizables ─────────────────────────────────────────────

DATOS_USUARIO = {
    "nombre": "Juan",
    "apellido": "Perez",
    "email": "juan@test.com",
    "contrasena": "password123",
}

DATOS_ADMIN = {
    "nombre": "Admin",
    "apellido": "Sistema",
    "email": "admin@test.com",
    "contrasena": "adminpass123",
}

DATOS_OTRO_USUARIO = {
    "nombre": "Ana",
    "apellido": "Lopez",
    "email": "ana@test.com",
    "contrasena": "anapass456",
}


# ── Fixtures de usuarios ──────────────────────────────────────────────────────

@pytest.fixture
def usuario_creado(client) -> dict:
    r = client.post("/api/v1/auth/register", json=DATOS_USUARIO)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client_autenticado(client, usuario_creado) -> TestClient:
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200, r.text
    return client


@pytest.fixture
def usuario_admin_creado(client) -> dict:
    """Registra un usuario y le asigna rol ADMIN directamente en BD."""
    r = client.post("/api/v1/auth/register", json=DATOS_ADMIN)
    assert r.status_code == 201, r.text
    usuario = r.json()

    from app.models.usuario_rol import UsuarioRol
    with Session(test_engine) as sesion:
        sesion.add(UsuarioRol(usuario_id=usuario["id"], rol_codigo="ADMIN"))
        sesion.commit()
    return usuario


@pytest.fixture
def client_admin(client, usuario_admin_creado) -> TestClient:
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_ADMIN["email"],
        "contrasena": DATOS_ADMIN["contrasena"],
    })
    assert r.status_code == 200, r.text
    return client


# ── Fixture SQLite in-memory para tests de middlewares / exception handlers ───
# No requiere Docker ni PostgreSQL. Usa StaticPool para compatibilidad con
# SQLite en entorno multi-thread (TestClient puede usar threads internamente).

@pytest.fixture
def client_sqlite(monkeypatch) -> TestClient:
    """
    TestClient sin BD para tests de middlewares y exception handlers.

    Los tests que usan este fixture golpean rutas que devuelven 404/401/422
    antes de tocar la BD (rutas inexistentes, endpoints protegidos sin token,
    cuerpos inválidos). No se necesita ninguna tabla real.

    Nota: NO usa SQLite porque algunos modelos tienen columnas ARRAY de
    PostgreSQL que SQLite no soporta. El monkeypatch reemplaza get_session
    por una función que devuelve None; esa sesión nunca llega a ejecutarse.
    """
    monkeypatch.setattr("app.uow.uow.get_session", lambda: None)
    from app.main import app
    return TestClient(app, raise_server_exceptions=False, base_url="https://testserver")

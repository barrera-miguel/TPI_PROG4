import secrets
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import configuracion

contexto_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hashear_contrasena(plain: str) -> str:
    return contexto_pwd.hash(plain)


def verificar_contrasena(plain: str, hashed: str) -> bool:
    return contexto_pwd.verify(plain, hashed)


def crear_token_acceso(usuario_id: int, roles: list[str], delta: timedelta | None = None) -> str:
    expira = datetime.now(timezone.utc) + (
        delta or timedelta(minutes=configuracion.MINUTOS_EXPIRACION_TOKEN)
    )
    payload = {
        "sub": str(usuario_id),
        "roles": roles,
        "type": "access",
        "exp": expira,
    }
    return jwt.encode(payload, configuracion.SECRET_KEY, algorithm=configuracion.ALGORITMO)


def decodificar_token_acceso(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            configuracion.SECRET_KEY,
            algorithms=[configuracion.ALGORITMO],
        )
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def crear_refresh_token(usuario_id: int, delta: timedelta | None = None) -> str:
    """Devuelve un JWT firmado con type='refresh' y un jti único."""
    expira = datetime.now(timezone.utc) + (
        delta or timedelta(days=configuracion.DIAS_EXPIRACION_REFRESH_TOKEN)
    )
    payload = {
        "sub": str(usuario_id),
        "type": "refresh",
        "exp": expira,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, configuracion.SECRET_KEY, algorithm=configuracion.ALGORITMO)


def decodificar_refresh_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, configuracion.SECRET_KEY, algorithms=[configuracion.ALGORITMO])
        if payload.get("type") != "refresh":
            return None
        return payload
    except jwt.PyJWTError:
        return None

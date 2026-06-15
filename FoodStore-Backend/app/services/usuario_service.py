from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.schemas.common import PaginatedResponse

from app.core.config import configuracion
from app.core.security import (
    crear_refresh_token,
    crear_token_acceso,
    decodificar_refresh_token,
    hashear_contrasena,
    verificar_contrasena,
)
from app.core.token_blacklist import esta_revocado, revocar_jti
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.schemas.usuario import Token, UsuarioAdminUpdate, UsuarioCrear, UsuarioPublico
from app.uow.uow import UnidadDeTrabajo


def _roles_de_usuario(uow: UnidadDeTrabajo, usuario_id: int) -> list[str]:
    return [ur.rol_codigo for ur in uow.usuario_roles.obtener_roles_de_usuario(usuario_id)]


def _construir_usuario_publico(usuario: Usuario, roles: list[str]) -> UsuarioPublico:
    return UsuarioPublico(
        id=usuario.id,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        email=usuario.email,
        celular=usuario.celular,
        roles=roles,
        created_at=usuario.created_at,
    )


def registrar_usuario(datos: UsuarioCrear) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        if uow.usuarios.obtener_por_email(datos.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email ya está registrado",
            )
        usuario = Usuario(
            nombre=datos.nombre,
            apellido=datos.apellido,
            email=datos.email,
            celular=datos.celular,
            password_hash=hashear_contrasena(datos.contrasena),
        )
        usuario = uow.usuarios.crear(usuario)
        # Asignar rol CLIENT por defecto
        uow.usuario_roles.asignar(UsuarioRol(usuario_id=usuario.id, rol_codigo="CLIENT"))
        return _construir_usuario_publico(usuario, ["CLIENT"])


def autenticar_usuario(email: str, contrasena: str) -> tuple[Token, str, str]:
    """Devuelve (Token, access_token_raw, refresh_token_raw)."""
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_email(email)
        if not usuario or not verificar_contrasena(contrasena, usuario.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if usuario.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cuenta de usuario deshabilitada",
            )
        roles = _roles_de_usuario(uow, usuario.id)
        usuario_id = usuario.id
        access_token = crear_token_acceso(usuario_id, roles)

    refresh_raw = crear_refresh_token(usuario_id)
    token_schema = Token(
        access_token=access_token,
        refresh_token=refresh_raw,
        token_type="bearer",
        expires_in=configuracion.MINUTOS_EXPIRACION_TOKEN * 60,
    )
    return token_schema, access_token, refresh_raw


def refrescar_token(token_raw: str) -> tuple[Token, str, str]:
    """Valida el refresh token JWT, lo rota y emite nuevos tokens. Devuelve (Token, access_token_raw, nuevo_refresh_token_raw)."""
    payload = decodificar_refresh_token(token_raw)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if jti and esta_revocado(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario_id = int(payload["sub"])

    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario or usuario.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o deshabilitado",
            )
        roles = _roles_de_usuario(uow, usuario.id)
        access_token = crear_token_acceso(usuario.id, roles)

    if jti:
        revocar_jti(jti)
    nuevo_refresh_raw = crear_refresh_token(usuario_id)

    token_schema = Token(
        access_token=access_token,
        refresh_token=nuevo_refresh_raw,
        token_type="bearer",
        expires_in=configuracion.MINUTOS_EXPIRACION_TOKEN * 60,
    )
    return token_schema, access_token, nuevo_refresh_raw


def revocar_refresh_token(token_raw: str) -> None:
    payload = decodificar_refresh_token(token_raw)
    if payload:
        jti = payload.get("jti")
        if jti:
            revocar_jti(jti)


def listar_usuarios(rol: str | None = None, page: int = 1, size: int = 20) -> PaginatedResponse:
    skip = (page - 1) * size
    with UnidadDeTrabajo() as uow:
        usuarios = uow.usuarios.obtener_todos(rol=rol, skip=skip, limit=size)
        total = uow.usuarios.contar(rol=rol)
        items = []
        for u in usuarios:
            roles = _roles_de_usuario(uow, u.id)
            items.append(_construir_usuario_publico(u, roles))
        return PaginatedResponse.crear(items, total, page, size)


def deshabilitar_usuario(usuario_id: int) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        if usuario.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El usuario ya está deshabilitado")
        usuario.deleted_at = datetime.now(timezone.utc)
        usuario = uow.usuarios.actualizar(usuario)
        roles = _roles_de_usuario(uow, usuario.id)
        return _construir_usuario_publico(usuario, roles)


def habilitar_usuario(usuario_id: int) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        usuario.deleted_at = None
        usuario = uow.usuarios.actualizar(usuario)
        roles = _roles_de_usuario(uow, usuario.id)
        return _construir_usuario_publico(usuario, roles)


def asignar_rol(usuario_id: int, rol_codigo: str, asignado_por_id: int) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario or usuario.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        if not uow.roles.obtener_por_codigo(rol_codigo):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rol '{rol_codigo}' no existe")
        if uow.usuario_roles.obtener(usuario_id, rol_codigo):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El usuario ya tiene ese rol")
        uow.usuario_roles.asignar(
            UsuarioRol(usuario_id=usuario_id, rol_codigo=rol_codigo, asignado_por_id=asignado_por_id)
        )
        roles = _roles_de_usuario(uow, usuario_id)
        return _construir_usuario_publico(usuario, roles)


def quitar_rol(usuario_id: int, rol_codigo: str) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario or usuario.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        if not uow.usuario_roles.revocar(usuario_id, rol_codigo):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El usuario no tiene ese rol")
        roles = _roles_de_usuario(uow, usuario_id)
        return _construir_usuario_publico(usuario, roles)


def obtener_usuario(usuario_id: int) -> Optional[UsuarioPublico]:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario or usuario.deleted_at is not None:
            return None
        roles = _roles_de_usuario(uow, usuario_id)
        return _construir_usuario_publico(usuario, roles)


def eliminar_usuario(usuario_id: int, admin_id: int) -> None:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario or usuario.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        if usuario.id == admin_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No podés eliminar tu propio usuario")
        usuario.deleted_at = datetime.now(timezone.utc)
        uow.usuarios.actualizar(usuario)


def actualizar_usuario_admin(usuario_id: int, datos: UsuarioAdminUpdate, admin_id: int) -> UsuarioPublico:
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        if datos.activo is not None:
            usuario.deleted_at = None if datos.activo else datetime.now(timezone.utc)
            usuario = uow.usuarios.actualizar(usuario)

        if datos.roles is not None:
            for rol_codigo in datos.roles:
                if not uow.roles.obtener_por_codigo(rol_codigo):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Rol '{rol_codigo}' no existe",
                    )
            roles_actuales = [ur.rol_codigo for ur in uow.usuario_roles.obtener_roles_de_usuario(usuario_id)]
            if "ADMIN" in roles_actuales and "ADMIN" not in datos.roles:
                todos_admins = uow.usuarios.obtener_todos(rol="ADMIN", skip=0, limit=1000)
                if len(todos_admins) <= 1:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="No se puede quitar el rol ADMIN al último administrador",
                    )
            uow.usuario_roles.revocar_todos(usuario_id)
            for rol_codigo in datos.roles:
                uow.usuario_roles.asignar(
                    UsuarioRol(usuario_id=usuario_id, rol_codigo=rol_codigo, asignado_por_id=admin_id)
                )

        roles = _roles_de_usuario(uow, usuario_id)
        return _construir_usuario_publico(usuario, roles)

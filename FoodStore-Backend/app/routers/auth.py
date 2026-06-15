from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import configuracion
from app.core.deps import obtener_usuario_activo, requerir_rol
from app.core.rate_limiter import limiter
from app.schemas.common import PaginatedResponse
from app.schemas.usuario import LoginRequest, Token, UsuarioAdminUpdate, UsuarioCrear, UsuarioPublico
from app.services import rol_service, usuario_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])

_COOKIE_ACCESS = "access_token"
_COOKIE_REFRESH = "refresh_token"
_MAX_AGE_ACCESS = 30 * 60
_MAX_AGE_REFRESH = 7 * 24 * 3600


def _set_auth_cookies(respuesta: Response, access_token: str, refresh_token: str) -> None:
    _secure = configuracion.COOKIES_SECURE
    _cookie_kwargs = dict(httponly=True, secure=_secure)
    if _secure:
        _cookie_kwargs["samesite"] = "strict"
    respuesta.set_cookie(
        key=_COOKIE_ACCESS, value=access_token,
        max_age=_MAX_AGE_ACCESS, **_cookie_kwargs,
    )
    respuesta.set_cookie(
        key=_COOKIE_REFRESH, value=refresh_token,
        max_age=_MAX_AGE_REFRESH, **_cookie_kwargs,
    )


def _delete_auth_cookies(respuesta: Response) -> None:
    _secure = configuracion.COOKIES_SECURE
    _cookie_kwargs = dict(httponly=True, secure=_secure)
    if _secure:
        _cookie_kwargs["samesite"] = "strict"
    respuesta.delete_cookie(key=_COOKIE_ACCESS, **_cookie_kwargs)
    respuesta.delete_cookie(key=_COOKIE_REFRESH, **_cookie_kwargs)


# ── Registro ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UsuarioPublico, status_code=status.HTTP_201_CREATED)
@limiter.limit(configuracion.RATE_LIMIT_LOGIN)
def registrar(request: Request, datos: UsuarioCrear):
    return usuario_service.registrar_usuario(datos)


# ── Token OAuth2 (solo para Swagger UI) ───────────────────────────────────────

@router.post("/token", include_in_schema=False)
@limiter.limit(configuracion.RATE_LIMIT_LOGIN)
def token_oauth2(
    request: Request,
    respuesta: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    """Endpoint OAuth2 estándar usado por Swagger UI. Devuelve el access_token en el body."""
    token, access_raw, refresh_raw = usuario_service.autenticar_usuario(
        form_data.username, form_data.password
    )
    _set_auth_cookies(respuesta, access_raw, refresh_raw)
    return {"access_token": access_raw, "token_type": "bearer"}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
@limiter.limit(configuracion.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    datos: LoginRequest,
    respuesta: Response,
):
    token, access_raw, refresh_raw = usuario_service.autenticar_usuario(
        datos.email, datos.contrasena
    )
    _set_auth_cookies(respuesta, access_raw, refresh_raw)
    return Token(
        access_token=access_raw,
        refresh_token=refresh_raw,
        token_type="bearer",
        expires_in=_MAX_AGE_ACCESS,
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh")
def refresh(request: Request, respuesta: Response):
    token_raw = request.cookies.get(_COOKIE_REFRESH)
    if not token_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token ausente",
        )
    token, access_raw, nuevo_refresh_raw = usuario_service.refrescar_token(token_raw)
    _set_auth_cookies(respuesta, access_raw, nuevo_refresh_raw)
    return {"mensaje": "Token renovado exitosamente"}


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(request: Request, respuesta: Response):
    token_raw = request.cookies.get(_COOKIE_REFRESH)
    if token_raw:
        usuario_service.revocar_refresh_token(token_raw)
    _delete_auth_cookies(respuesta)
    return {"mensaje": "Sesión cerrada exitosamente"}


# ── Perfil propio ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UsuarioPublico)
def mi_perfil(
    usuario_actual: Annotated[UsuarioPublico, Depends(obtener_usuario_activo)],
):
    return usuario_actual


# ── Admin: usuarios ───────────────────────────────────────────────────────────

@router.get("/admin/usuarios/{usuario_id}", response_model=UsuarioPublico)
def obtener_usuario(
    usuario_id: int,
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    usuario = usuario_service.obtener_usuario(usuario_id)
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return usuario


@router.get("/admin/usuarios", response_model=PaginatedResponse)
def listar_usuarios(
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
    rol: Annotated[Optional[str], Query(description="Filtrar por código de rol")] = None,
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Registros por página")] = 20,
):
    return usuario_service.listar_usuarios(rol=rol, page=page, size=size)


@router.put("/admin/usuarios/{usuario_id}", response_model=UsuarioPublico)
def actualizar_usuario_admin_endpoint(
    usuario_id: int,
    datos: UsuarioAdminUpdate,
    admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return usuario_service.actualizar_usuario_admin(usuario_id, datos, admin.id)


@router.post("/admin/usuarios/{usuario_id}/deshabilitar", response_model=UsuarioPublico)
def deshabilitar_usuario(
    usuario_id: int,
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return usuario_service.deshabilitar_usuario(usuario_id)


@router.post("/admin/usuarios/{usuario_id}/habilitar", response_model=UsuarioPublico)
def habilitar_usuario(
    usuario_id: int,
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return usuario_service.habilitar_usuario(usuario_id)


@router.delete("/admin/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(
    usuario_id: int,
    admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    usuario_service.eliminar_usuario(usuario_id, admin.id)


@router.post("/admin/usuarios/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioPublico)
def asignar_rol(
    usuario_id: int,
    rol_codigo: str,
    admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return usuario_service.asignar_rol(usuario_id, rol_codigo, asignado_por_id=admin.id)


@router.delete("/admin/usuarios/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioPublico)
def quitar_rol(
    usuario_id: int,
    rol_codigo: str,
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return usuario_service.quitar_rol(usuario_id, rol_codigo)


# ── Admin: roles ──────────────────────────────────────────────────────────────

@router.get("/admin/roles")
def listar_roles(
    _admin: Annotated[UsuarioPublico, Depends(requerir_rol(["ADMIN"]))],
):
    return rol_service.listar_roles()

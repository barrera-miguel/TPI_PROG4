import logging

import cloudinary
import cloudinary.uploader

from app.core.config import configuracion

logger = logging.getLogger(__name__)

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def init_cloudinary() -> None:
    cloudinary.config(
        cloud_name=configuracion.CLOUDINARY_CLOUD_NAME,
        api_key=configuracion.CLOUDINARY_API_KEY,
        api_secret=configuracion.CLOUDINARY_API_SECRET,
    )
    logger.info("Cloudinary configurado (cloud_name=%s)", configuracion.CLOUDINARY_CLOUD_NAME)


def subir_imagen(file_bytes: bytes, content_type: str) -> dict:
    if content_type not in _ALLOWED_MIME:
        raise ValueError(f"Tipo de archivo no permitido: {content_type}. Use jpeg, png o webp.")
    if len(file_bytes) > _MAX_SIZE_BYTES:
        raise ValueError("El archivo supera el tamaño máximo permitido de 5 MB.")

    result = cloudinary.uploader.upload(
        file_bytes,
        folder="foodstore/productos",
        allowed_formats=["jpg", "jpeg", "png", "webp"],
        overwrite=False,
        unique_filename=True,
        resource_type="image",
    )
    return result


def eliminar_imagen(public_id: str) -> None:
    cloudinary.uploader.destroy(public_id)


def extraer_public_id(url: str) -> str | None:
    """Extrae el public_id de una URL de Cloudinary."""
    idx = url.find("/upload/")
    if idx == -1:
        return None
    path = url[idx + len("/upload/"):]
    # Eliminar prefijo de versión v1234567/
    parts = path.split("/", 1)
    if len(parts) > 1 and parts[0].startswith("v") and parts[0][1:].isdigit():
        path = parts[1]
    # Eliminar extensión
    dot_idx = path.rfind(".")
    if dot_idx != -1:
        path = path[:dot_idx]
    return path if path else None

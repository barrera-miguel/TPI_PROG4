from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.core.deps import requerir_rol
from app.schemas.upload import CloudinaryResponse
from app.services import uploads_service

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post(
    "/imagen",
    response_model=CloudinaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subir imagen a Cloudinary",
)
async def subir_imagen(
    file: UploadFile,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    file_bytes = await file.read()
    content_type = file.content_type or ""
    try:
        result = uploads_service.subir_imagen(file_bytes, content_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir imagen a Cloudinary: {e}",
        )
    return CloudinaryResponse(
        secure_url=result["secure_url"],
        public_id=result["public_id"],
        width=result.get("width", 0),
        height=result.get("height", 0),
        format=result.get("format", ""),
        resource_type=result.get("resource_type", "image"),
    )


@router.delete(
    "/imagen/{public_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar imagen de Cloudinary",
)
def eliminar_imagen(
    public_id: str,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    try:
        uploads_service.eliminar_imagen(public_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al eliminar imagen de Cloudinary: {e}",
        )

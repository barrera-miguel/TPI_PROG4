from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.core.deps import requerir_rol
from app.schemas.categoria import CategoriaNodo, CategoriaCreate, CategoriaRead, CategoriaUpdate
from app.schemas.common import PaginatedResponse
from app.schemas.upload import ImagenCategoriaUpdate
from app.services import categoria_service

router = APIRouter(prefix="/categorias", tags=["Categorías"])

IdCategoria = Annotated[int, Path(gt=0, description="ID de la categoría")]


@router.get("/arbol", response_model=List[CategoriaNodo])
def obtener_arbol():
    return categoria_service.obtener_arbol()


@router.post("/", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(
    datos: CategoriaCreate,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    try:
        return categoria_service.crear_categoria(datos)
    except ValueError as e:
        msg = str(e)
        if "No existe" in msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)


@router.get("/", response_model=PaginatedResponse)
def listar_categorias(
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Registros por página")] = 20,
    nombre: Annotated[Optional[str], Query(description="Filtrar por nombre")] = None,
    parent_id: Annotated[Optional[int], Query(gt=0, description="Filtrar por categoría padre")] = None,
):
    return categoria_service.obtener_categorias(page, size, nombre, parent_id)


@router.get("/{id}", response_model=CategoriaRead)
def detalle_categoria(id: IdCategoria):
    categoria = categoria_service.obtener_categoria(id)
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )
    return categoria


@router.put("/{id}", response_model=CategoriaRead)
def actualizar_categoria(
    id: IdCategoria,
    datos: CategoriaUpdate,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    try:
        categoria = categoria_service.actualizar_categoria(id, datos)
    except ValueError as e:
        msg = str(e)
        if "ciclo" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )
    return categoria


@router.patch("/{id}/imagen", response_model=CategoriaRead, summary="Actualizar imagen de la categoría")
def actualizar_imagen(
    id: IdCategoria,
    datos: ImagenCategoriaUpdate,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    categoria = categoria_service.actualizar_imagen(id, datos.imagen_url)
    if not categoria:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    return categoria


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(
    id: IdCategoria,
    _: Annotated[object, Depends(requerir_rol(["ADMIN"]))],
):
    try:
        encontrada = categoria_service.eliminar_categoria(id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not encontrada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

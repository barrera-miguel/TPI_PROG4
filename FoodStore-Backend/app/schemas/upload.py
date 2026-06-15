from pydantic import BaseModel


class CloudinaryResponse(BaseModel):
    secure_url: str
    public_id: str
    width: int
    height: int
    format: str
    resource_type: str


class ImagenProductoUpdate(BaseModel):
    imagenes_url: list[str]


class ImagenCategoriaUpdate(BaseModel):
    imagen_url: str | None

import client from '../api/client'
import type { CloudinaryResponse } from '../types'

export const uploadsService = {
  subirImagen: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post<CloudinaryResponse>('/uploads/imagen', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
  eliminarImagen: (public_id: string) => client.delete(`/uploads/imagen/${public_id}`),
}

import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
})

let refreshPromise: Promise<void> | null = null

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      // No redirigir si es el chequeo de sesión inicial de App.tsx
      const isSessionCheck = original.url?.includes('/auth/me') && !original._isLogin
      if (isSessionCheck) return Promise.reject(error)

      original._retry = true
      if (!refreshPromise) {
        refreshPromise = client
          .post('/auth/refresh')
          .then(() => { refreshPromise = null })
          .catch(() => {
            refreshPromise = null
            window.location.href = '/login'
            return Promise.reject(error)
          })
      }
      await refreshPromise
      window.dispatchEvent(new CustomEvent('token-refreshed'))
      return client(original)
    }
    return Promise.reject(error)
  }
)

export default client

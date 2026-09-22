import axios from 'axios'
import { toast } from 'sonner'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  withCredentials: true,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
    // No default Content-Type here — axios already sets "application/json" on
    // its own for a plain object body (see its transformRequest). Forcing it as
    // a blanket default instead broke every multipart/FormData request in this
    // app (file uploads: facility photos, authorization letters): axios's own
    // logic checks the Content-Type header to decide whether a FormData payload
    // should be sent as real multipart or be JSON.stringify'd — with this
    // default present it always took the JSON.stringify path, which can't
    // represent a File at all ("The x field must be a file") and silently
    // mangled everything else in the same form.
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cabs_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status         = err.response?.status
    const isAuthEndpoint = err.config?.url?.includes('/auth/')

    // Session expired — redirect to login
    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('cabs_token')
      localStorage.removeItem('cabs_user')
      window.location.href = '/login'
      return Promise.reject(err)
    }

    // No response at all — network / timeout
    if (!err.response) {
      const msg = err.code === 'ECONNABORTED'
        ? 'Request timed out. Please check your connection.'
        : 'Network error. Please check your connection.'
      toast.error(msg)
      err._toasted = true
      return Promise.reject(err)
    }

    // 403 Forbidden
    if (status === 403) {
      toast.error('You don\'t have permission to do that.')
      err._toasted = true
    }

    // 429 Too Many Requests
    if (status === 429) {
      toast.error('Too many requests. Please slow down.')
      err._toasted = true
    }

    // 500+ Server errors
    if (status >= 500) {
      toast.error('A server error occurred. Please try again.')
      err._toasted = true
    }

    return Promise.reject(err)
  }
)

export default api

import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 180000, // 3 mins for docx2pdf
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem('hrms_user')
  if (raw) {
    const user = JSON.parse(raw)
    if (user?.token) config.headers.Authorization = `Bearer ${user.token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('hrms_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client

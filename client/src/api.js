import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const uploadCSV = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const getDatasets = () => api.get('/datasets')
export const getDataset = (id) => api.get(`/datasets/${id}`)
export const deleteDataset = (id) => api.delete(`/datasets/${id}`)

export const getSummary = (id) => api.get(`/analytics/${id}/summary`)
export const getDistribution = (id, col) => api.get(`/analytics/${id}/distribution/${col}`)
export const getCorrelation = (id) => api.get(`/analytics/${id}/correlation`)
export const getGrouped = (id, groupBy, metric, agg = 'mean') =>
  api.get(`/analytics/${id}/group/${groupBy}/${metric}?agg=${agg}`)
export const getTop = (id, col) => api.get(`/analytics/${id}/top/${col}`)
export const getCompare = (id, col1, col2) => api.get(`/analytics/${id}/compare/${col1}/${col2}`)
export const getZomatoInsights = (id) => api.get(`/analytics/${id}/zomato-insights`)

export const predictLinear = (id, body) => api.post(`/predict/${id}/linear`, body)
export const getTrends = (id, col) => api.get(`/predict/${id}/trends/${col}`)
export const classify = (id, body) => api.post(`/predict/${id}/classify`, body)
export const predictZomato = (id, body) => api.post(`/predict/${id}/zomato-predict`, body)

export const getRows = (id, page = 1, limit = 20) =>
  api.get(`/admin/${id}/rows?page=${page}&limit=${limit}`)
export const addRow = (id, row) => api.post(`/admin/${id}/rows`, row)
export const updateRow = (id, idx, row) => api.put(`/admin/${id}/rows/${idx}`, row)
export const deleteRow = (id, idx) => api.delete(`/admin/${id}/rows/${idx}`)
export const exportCSV = (id) => api.get(`/admin/${id}/export`, { responseType: 'blob' })

export default api

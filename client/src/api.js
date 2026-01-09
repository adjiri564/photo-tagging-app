import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:4000' })

export async function fetchImages() {
  const r = await api.get('/images')
  return r.data
}

export async function fetchCharacters(imageId) {
  const r = await api.get('/characters', { params: { imageId } })
  return r.data
}

export async function startSession(imageId) {
  const r = await api.post('/start', { imageId })
  return r.data
}

export async function validateClick(payload) {
  const r = await api.post('/validate', payload)
  return r.data
}

export async function postScore({ name, timeMs, imageId }) {
  const r = await api.post('/score', { name, timeMs, imageId })
  return r.data
}

export async function fetchScores(imageId) {
  const r = await api.get('/scores', { params: { imageId } })
  return r.data
}

export default api

export async function updateCharacter(id, data) {
  const r = await api.post(`/character/${encodeURIComponent(id)}`, data)
  return r.data
}

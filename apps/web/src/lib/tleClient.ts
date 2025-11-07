import axios from 'axios'
const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
const api = axios.create({ baseURL })
export const fetchSatList = async (q: any) => (await api.get('/satellites', { params: q })).data
export const fetchSatDetail = async (id: number) => (await api.get(`/satellites/${id}`)).data
export const fetchTLE = async (id: number) => (await api.get(`/satellites/${id}/tle`)).data
export const fetchOverflight = async (id: number, t: string) => (await api.get('/overflight', { params:{ noradId:id, time:t } })).data
export const fetchCountries = async () => (await api.get('/countries')).data
export const fetchConstellations = async () => (await api.get('/constellations')).data
export const fetchVisibility = async (params: {lat:number;lon:number;from:string;to:string;minElev:number; ids?: number[]}) =>
  (await api.get('/visibility',{params})).data




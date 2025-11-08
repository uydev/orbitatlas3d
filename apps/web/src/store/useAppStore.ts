import { create } from 'zustand'

type Mode = '3D' | '2D'
export type SatVisualMode = 'billboard' | 'dot'
export interface SatSummary {
  norad_id: number; name: string; owner_country?: string; constellation?: string;
}
interface State {
  mode: Mode
  selected?: SatSummary
  setMode: (m: Mode) => void
  select: (s?: SatSummary) => void
  showSatellites: boolean
  toggleSatellites: () => void
  satVisualMode: SatVisualMode
  setSatVisualMode: (m: SatVisualMode) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}
const useAppStore = create<State>((set)=>(
  {
    mode: '3D',
    selected: undefined,
    showSatellites: true,
    satVisualMode: 'billboard',
    sidebarOpen: true,
    searchQuery: '',
    setMode: (m)=>set({mode:m}),
    select: (s)=>set({selected:s}),
    toggleSatellites: ()=>set((state)=>({showSatellites: !state.showSatellites})),
    setSatVisualMode: (m)=>set({satVisualMode: m}),
    toggleSidebar: ()=>set((state)=>({sidebarOpen: !state.sidebarOpen})),
    setSearchQuery: (q)=>set({searchQuery: q})
  }
))
export default useAppStore




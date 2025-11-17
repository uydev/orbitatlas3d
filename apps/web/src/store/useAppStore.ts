import { create } from 'zustand'

type Mode = '3D' | '2D'
export type SatVisualMode = 'billboard' | 'dot'
export interface SatSummary {
  norad_id: number; name: string; owner_country?: string; constellation?: string;
  // Optional TLEs for 2D-only computations when Cesium viewer is not available
  tle1?: string; tle2?: string;
}
export interface Observer {
  lat: number; lon: number; name?: string;
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
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  observer?: Observer
  setObserver: (o?: Observer) => void
  overheadOnly: boolean
  toggleOverheadOnly: () => void
  showLabels2D: boolean
  toggleLabels2D: () => void
  showTracks2D: boolean
  toggleTracks2D: () => void
  occlude3D: boolean
  toggleOcclude3D: () => void
}
const useAppStore = create<State>((set)=>(
  {
    mode: '3D',
    selected: undefined,
    showSatellites: true,
    satVisualMode: 'billboard',
    sidebarOpen: true,
    observer: undefined,
    overheadOnly: false,
    showLabels2D: false,
    showTracks2D: true,
    occlude3D: false,
    setMode: (m)=>set({mode:m}),
    select: (s)=>set((state)=>({
      selected: s,
      // Ensure the info panel is visible when a selection is made
      sidebarOpen: s ? true : state.sidebarOpen
    })),
    toggleSatellites: ()=>set((state)=>({showSatellites: !state.showSatellites})),
    setSatVisualMode: (m)=>set({satVisualMode: m}),
    setSidebarOpen: (open)=>set({ sidebarOpen: open }),
    toggleSidebar: ()=>set((state)=>({sidebarOpen: !state.sidebarOpen})),
    setObserver: (o)=>set({observer: o}),
    toggleOverheadOnly: ()=>set((state)=>({overheadOnly: !state.overheadOnly})),
    toggleLabels2D: ()=>set((state)=>({showLabels2D: !state.showLabels2D})),
    toggleTracks2D: ()=>set((state)=>({showTracks2D: !state.showTracks2D})),
    toggleOcclude3D: ()=>set((state)=>({occlude3D: !state.occlude3D}))
  }
))
export default useAppStore




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
  // Shared real-time clock used to keep 2D and 3D views in sync
  simulationTime?: Date
  // Orbit playback controls for 3D view
  orbitPlay: boolean
  orbitHorizonHours: number
  orbitResetCounter: number
  trackRefreshToken: number
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
  satLimit: number
  setSatLimit: (n: number) => void
  showOnlySelected: boolean
  toggleShowOnlySelected: () => void
  setSimulationTime: (t: Date) => void
  setOrbitPlay: (play: boolean) => void
  setOrbitHorizonHours: (h: number) => void
  resetOrbitPlayback: () => void
  refreshTracks: () => void
}
const useAppStore = create<State>((set)=>(
  {
    mode: '3D',
    selected: undefined,
    simulationTime: undefined,
    orbitPlay: false,
    orbitHorizonHours: 24,
    orbitResetCounter: 0,
    trackRefreshToken: 0,
    showSatellites: true,
    satVisualMode: 'billboard',
    sidebarOpen: true,
    observer: undefined,
    overheadOnly: false,
    showLabels2D: false,
    showTracks2D: true,
    occlude3D: false,
    satLimit: 600,
    showOnlySelected: false,
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
    toggleOcclude3D: ()=>set((state)=>({occlude3D: !state.occlude3D})),
    setSatLimit: (n)=>set({ satLimit: Math.max(1, Math.floor(n)) }),
    toggleShowOnlySelected: ()=>set((state)=>({showOnlySelected: !state.showOnlySelected})),
    setSimulationTime: (t)=>set({ simulationTime: t }),
    setOrbitPlay: (play)=>set({ orbitPlay: play }),
    setOrbitHorizonHours: (h)=>set({ orbitHorizonHours: Math.max(1, Math.floor(h)) }),
    resetOrbitPlayback: ()=>set((state)=>({
      orbitPlay: false,
      orbitResetCounter: state.orbitResetCounter + 1,
    })),
    refreshTracks: ()=>set((state)=>({ trackRefreshToken: state.trackRefreshToken + 1 })),
  }
))
export default useAppStore




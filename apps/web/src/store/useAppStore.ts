import { create } from 'zustand'

type Mode = '3D' | '2D'
export interface SatSummary {
  norad_id: number; name: string; owner_country?: string; constellation?: string;
}
interface State {
  mode: Mode
  selected?: SatSummary
  setMode: (m: Mode) => void
  select: (s?: SatSummary) => void
}
const useAppStore = create<State>((set)=>(
  {
    mode: '3D',
    selected: undefined,
    setMode: (m)=>set({mode:m}),
    select: (s)=>set({selected:s})
  }
))
export default useAppStore




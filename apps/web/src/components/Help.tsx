import { useState } from 'react'

export default function Help(){
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'about'|'layers'|'keyboard'>('about')
  return (
    <div className="relative">
      <button
        className="px-2 py-1 text-xs font-medium rounded bg-zinc-900 hover:bg-zinc-700 border border-white/10"
        title="Help"
        aria-label="Help"
        onClick={()=>setOpen(v=>!v)}
      >
        ?
      </button>
      {open && (
        <div className="fixed top-[52px] left-2 z-[2100] w-[380px] bg-zinc-900/95 border border-white/10 rounded shadow-md">
          <div className="flex border-b border-white/10">
            <button className={`px-3 py-2 text-xs ${tab==='about'?'bg-zinc-800':''}`} onClick={()=>setTab('about')}>About</button>
            <button className={`px-3 py-2 text-xs ${tab==='layers'?'bg-zinc-800':''}`} onClick={()=>setTab('layers')}>Layers</button>
            <button className={`px-3 py-2 text-xs ${tab==='keyboard'?'bg-zinc-800':''}`} onClick={()=>setTab('keyboard')}>Keyboard</button>
          </div>
          <div className="p-3 text-sm">
            {tab==='about' && (
              <div className="space-y-2">
                <div className="font-medium">OrbitAtlas</div>
                <div className="opacity-80">
                  Explore active satellites in 3D and 2D. Use the sidebar to view details and search.
                </div>
              </div>
            )}
            {tab==='layers' && (
              <div className="space-y-2">
                <div className="opacity-80">Use the gear icon to toggle:</div>
                <ul className="list-disc pl-5 space-y-1 opacity-90">
                  <li>Show labels (2D/3D)</li>
                  <li>Show tracks (2D)</li>
                  <li>Icon vs dot markers</li>
                </ul>
              </div>
            )}
            {tab==='keyboard' && (
              <div className="space-y-2">
                <div className="font-medium">Global</div>
                <ul className="list-disc pl-5 space-y-1 opacity-90">
                  <li>Esc: Close info panel</li>
                  <li>2 / 3: Switch to 2D / 3D</li>
                  <li>Shift: Faster movement</li>
                </ul>
                <div className="font-medium mt-2">2D (Map)</div>
                <ul className="list-disc pl-5 space-y-1 opacity-90">
                  <li>W/A/S/D or Arrows: Pan</li>
                  <li>+ / - : Zoom in / out</li>
                </ul>
                <div className="font-medium mt-2">3D (Globe)</div>
                <ul className="list-disc pl-5 space-y-1 opacity-90">
                  <li>W/A/S/D or Arrows: Move camera</li>
                  <li>+ / - : Move forward / backward</li>
                  <li>R: Rotate right around view (Shift = faster)</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}



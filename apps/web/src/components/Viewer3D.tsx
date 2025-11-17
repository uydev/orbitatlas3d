import { useEffect } from 'react'
import { initCesium } from '../lib/cesiumInit'
export default function Viewer3D(){
  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string
    const viewer = initCesium('cesium-container', token)
    ;(window as any).CESIUM_VIEWER = viewer
    // Augment Cesium's Navigation Help with a "Keyboard" tab and simple About/Layers notes
    try {
      const container = viewer.container as HTMLElement
      const inject = () => {
        const helpRoot = container.querySelector('.cesium-navigation-help') as HTMLElement | null
        if (!helpRoot) return
        if (helpRoot.querySelector('.oa-extra-help')) return
        const wrap = document.createElement('div')
        wrap.className = 'oa-extra-help'
        wrap.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);font-size:12px;color:#fff;'
        // Tabs
        const tabs = document.createElement('div')
        tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:6px'
        const mkBtn = (label: string) => {
          const b = document.createElement('button')
          b.textContent = label
          b.style.cssText = 'padding:4px 8px;background:#1f2937;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:12px'
          b.classList.add('oa-tab-btn')
          return b
        }
        const btnKeyboard = mkBtn('Keyboard')
        const btnAbout = mkBtn('About')
        const btnLayers = mkBtn('Layers')
        tabs.append(btnKeyboard, btnAbout, btnLayers)
        const content = document.createElement('div')
        content.className = 'oa-tab-content'
        const setContent = (html: string) => { content.innerHTML = html }
        const keyboardHtml = `
          <div>
            <div style="font-weight:600;margin-bottom:4px">Global</div>
            <ul style="margin:0 0 6px 18px">
              <li>Esc: Close info panel</li>
              <li>2 / 3: Switch to 2D / 3D</li>
              <li>Shift: Faster movement</li>
            </ul>
            <div style="font-weight:600;margin-bottom:4px">2D (Map)</div>
            <ul style="margin:0 0 6px 18px">
              <li>W/A/S/D or Arrows: Pan</li>
              <li>+ / - : Zoom in / out</li>
            </ul>
            <div style="font-weight:600;margin-bottom:4px">3D (Globe)</div>
            <ul style="margin:0 0 0 18px">
              <li>W/A/S/D or Arrows: Move camera</li>
              <li>+ / - : Move forward / backward</li>
              <li>R: Rotate right around view (Shift = faster)</li>
            </ul>
          </div>`
        const aboutHtml = `
          <div>
            <div style="font-weight:600;margin-bottom:4px">OrbitAtlas</div>
            <div style="opacity:.85">Explore active satellites in 3D and 2D. Use the sidebar to view details and search.</div>
          </div>`
        const layersHtml = `
          <div>
            <div style="opacity:.85">Use the gear icon in the header to toggle Labels, Tracks, Icon/Dot markers, and 3D occlusion.</div>
          </div>`
        // Bind tab actions
        btnKeyboard.onclick = ()=>setContent(keyboardHtml)
        btnAbout.onclick = ()=>setContent(aboutHtml)
        btnLayers.onclick = ()=>setContent(layersHtml)
        // Default tab
        setContent(keyboardHtml)
        wrap.append(tabs, content)
        helpRoot.append(wrap)
      }
      const observer = new MutationObserver(()=>inject())
      observer.observe(container, { childList: true, subtree: true })
      // Also try once in case it's already open
      setTimeout(inject, 200)
    } catch {}
    return () => {
      viewer?.destroy()
      ;(window as any).CESIUM_VIEWER = undefined
    }
  }, [])
  return <div id="cesium-container" className="w-full h-full" />
}




import { useEffect } from 'react'
import { initCesium } from '../lib/cesiumInit'
export default function Viewer3D(){
  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string
    const viewer = initCesium('cesium-container', token)
    ;(window as any).CESIUM_VIEWER = viewer
    // Augment Cesium's Navigation Help with tabs (Keyboard / About / Layers) using Cesium's styles
    try {
      const container = viewer.container as HTMLElement
      const inject = () => {
        const helpRoot = container.querySelector('.cesium-navigation-help') as HTMLElement | null
        if (!helpRoot) return
        if (helpRoot.querySelector('.oa-extra-tabs')) return

        // Row of buttons using Cesium's navigation button styles
        const tabRow = document.createElement('div')
        tabRow.className = 'oa-extra-tabs'
        tabRow.style.cssText = 'margin-top:6px; display:flex; gap:6px;'

        const makeCesiumButton = (label: string) => {
          const b = document.createElement('button')
          b.type = 'button'
          b.textContent = label
          b.className = 'cesium-navigation-button cesium-navigation-button-unselected'
          return b
        }
        const btnKeyboard = makeCesiumButton('Keyboard')
        const btnAbout = makeCesiumButton('About')
        const btnLayers = makeCesiumButton('Layers')
        tabRow.append(btnKeyboard, btnAbout, btnLayers)

        // Instruction containers matching Cesium's help blocks
        const sectionStyle = 'margin-top:6px'
        const secKeyboard = document.createElement('div')
        secKeyboard.className = 'cesium-navigation-help-instructions oa-help-section'
        secKeyboard.style.cssText = sectionStyle
        secKeyboard.innerHTML = `
          <table style="width:100%;color:#fff;opacity:.95">
            <tbody>
              <tr><td colspan="2" style="font-weight:600;padding:2px 0">Global</td></tr>
              <tr><td style="width:18px">•</td><td>Esc: Close info panel</td></tr>
              <tr><td>•</td><td>2 / 3: Switch to 2D / 3D</td></tr>
              <tr><td>•</td><td>Shift: Faster movement</td></tr>
              <tr><td colspan="2" style="height:6px"></td></tr>
              <tr><td colspan="2" style="font-weight:600;padding:2px 0">2D (Map)</td></tr>
              <tr><td>•</td><td>W/A/S/D or Arrows: Pan</td></tr>
              <tr><td>•</td><td>+ / - : Zoom in / out</td></tr>
              <tr><td colspan="2" style="height:6px"></td></tr>
              <tr><td colspan="2" style="font-weight:600;padding:2px 0">3D (Globe)</td></tr>
              <tr><td>•</td><td>W/A/S/D or Arrows: Move camera</td></tr>
              <tr><td>•</td><td>+ / - : Move forward / backward</td></tr>
              <tr><td>•</td><td>R: Rotate right around view (Shift = faster)</td></tr>
            </tbody>
          </table>`

        const secAbout = document.createElement('div')
        secAbout.className = 'cesium-navigation-help-instructions oa-help-section'
        secAbout.style.cssText = sectionStyle
        secAbout.innerHTML = `
          <table style="width:100%;color:#fff;opacity:.95">
            <tbody>
              <tr><td colspan="2" style="font-weight:600;padding:2px 0">OrbitAtlas</td></tr>
              <tr><td>•</td><td>Explore satellites in 3D and 2D; select to view details in the sidebar.</td></tr>
            </tbody>
          </table>`

        const secLayers = document.createElement('div')
        secLayers.className = 'cesium-navigation-help-instructions oa-help-section'
        secLayers.style.cssText = sectionStyle
        secLayers.innerHTML = `
          <table style="width:100%;color:#fff;opacity:.95">
            <tbody>
              <tr><td>•</td><td>Use the gear icon to toggle Labels, Tracks, Icon/Dot markers.</td></tr>
              <tr><td>•</td><td>“Hide satellites behind planet (3D)” enables depth occlusion.</td></tr>
            </tbody>
          </table>`

        // Helper to show one of our sections
        const showSection = (target: HTMLElement, btn: HTMLButtonElement) => {
          helpRoot.querySelectorAll<HTMLElement>('.oa-help-section').forEach(s=>{
            s.style.display = s === target ? 'block' : 'none'
          })
          tabRow.querySelectorAll<HTMLButtonElement>('.cesium-navigation-button').forEach(b=>{
            b.classList.remove('cesium-navigation-button-selected')
            b.classList.add('cesium-navigation-button-unselected')
          })
          btn.classList.remove('cesium-navigation-button-unselected')
          btn.classList.add('cesium-navigation-button-selected')
          // Hide default Mouse/Touch sections when our tabs are active
          helpRoot.querySelectorAll<HTMLElement>('.cesium-navigation-help-instructions').forEach(el=>{
            if (!el.classList.contains('oa-help-section')) {
              el.style.display = 'none'
            }
          })
        }
        btnKeyboard.addEventListener('click', ()=>showSection(secKeyboard, btnKeyboard))
        btnAbout.addEventListener('click', ()=>showSection(secAbout, btnAbout))
        btnLayers.addEventListener('click', ()=>showSection(secLayers, btnLayers))

        // When user clicks original Mouse/Touch buttons, hide our sections and reset our selection
        const mouseBtn = helpRoot.querySelector('.cesium-navigation-button-left') as HTMLButtonElement | null
        const touchBtn = helpRoot.querySelector('.cesium-navigation-button-right') as HTMLButtonElement | null
        const restoreDefault = () => {
          helpRoot.querySelectorAll<HTMLElement>('.oa-help-section').forEach(s=>s.style.display='none')
          tabRow.querySelectorAll<HTMLButtonElement>('.cesium-navigation-button').forEach(b=>{
            b.classList.remove('cesium-navigation-button-selected')
            b.classList.add('cesium-navigation-button-unselected')
          })
          helpRoot.querySelectorAll<HTMLElement>('.cesium-navigation-help-instructions').forEach(el=>{
            if (!el.classList.contains('oa-help-section')) {
              el.style.removeProperty('display')
            }
          })
        }
        mouseBtn?.addEventListener('click', restoreDefault)
        touchBtn?.addEventListener('click', restoreDefault)

        // Insert our UI just after the default Mouse/Touch buttons
        helpRoot.insertBefore(tabRow, helpRoot.children[2] || null)
        helpRoot.appendChild(secKeyboard)
        helpRoot.appendChild(secAbout)
        helpRoot.appendChild(secLayers)

        // Default to Keyboard tab visible
        showSection(secKeyboard, btnKeyboard)
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




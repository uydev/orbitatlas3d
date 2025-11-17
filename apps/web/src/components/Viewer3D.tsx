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

        const makeCesiumButton = (label: string, extraClass?: string) => {
          const b = document.createElement('button')
          b.type = 'button'
          b.textContent = label
          b.className = `cesium-navigation-button cesium-navigation-button-unselected ${extraClass || ''}`.trim()
          return b
        }
        const btnKeyboard = makeCesiumButton('Keyboard', 'cesium-navigation-button-left')
        const btnAbout = makeCesiumButton('About')
        const btnLayers = makeCesiumButton('Layers', 'cesium-navigation-button-right')
        tabRow.append(btnKeyboard, btnAbout, btnLayers)

        // Instruction containers matching Cesium's help blocks
        const sectionStyle = 'margin-top:6px'
        const secKeyboard = document.createElement('div')
        secKeyboard.className = 'cesium-navigation-help-instructions oa-help-section'
        secKeyboard.style.cssText = sectionStyle
        secKeyboard.innerHTML = `
          <div style="color:#fff;opacity:.95;line-height:1.35">
            <div style="font-weight:600;margin:2px 0">Global</div>
            <ul style="margin:0 0 6px 18px;padding:0;list-style:disc">
              <li style="margin:0 0 2px 0">Esc: Close info panel</li>
              <li style="margin:0 0 2px 0">2 / 3: Switch to 2D / 3D</li>
              <li style="margin:0 0 2px 0">Shift: Faster movement</li>
            </ul>
            <div style="font-weight:600;margin:2px 0">2D (Map)</div>
            <ul style="margin:0 0 6px 18px;padding:0;list-style:disc">
              <li style="margin:0 0 2px 0">W/A/S/D or Arrows: Pan</li>
              <li style="margin:0 0 2px 0">+ / - : Zoom in / out</li>
            </ul>
            <div style="font-weight:600;margin:2px 0">3D (Globe)</div>
            <ul style="margin:0 0 0 18px;padding:0;list-style:disc">
              <li style="margin:0 0 2px 0">W/A/S/D or Arrows: Move camera</li>
              <li style="margin:0 0 2px 0">+ / - : Move forward / backward</li>
              <li style="margin:0 0 0 0">R: Rotate right around view (Shift = faster)</li>
            </ul>
          </div>`

        const secAbout = document.createElement('div')
        secAbout.className = 'cesium-navigation-help-instructions oa-help-section'
        secAbout.style.cssText = sectionStyle
        secAbout.innerHTML = `
          <div style="color:#fff;opacity:.95;line-height:1.35">
            <div style="font-weight:700;margin:2px 0 6px 0">OrbitAtlas</div>
            <ul style="margin:0 0 0 18px;padding:0;list-style:disc">
              <li>Explore satellites in 3D and 2D; select to view details in the sidebar.</li>
            </ul>
          </div>`

        const secLayers = document.createElement('div')
        secLayers.className = 'cesium-navigation-help-instructions oa-help-section'
        secLayers.style.cssText = sectionStyle
        secLayers.innerHTML = `
          <div style="color:#fff;opacity:.95;line-height:1.35">
            <ul style="margin:0 0 0 18px;padding:0;list-style:disc">
              <li style="margin:0 0 2px 0">Use the gear icon to toggle Labels, Tracks, Icon/Dot markers.</li>
              <li>“Hide satellites behind planet (3D)” enables depth occlusion.</li>
            </ul>
          </div>`

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

        // Default to Keyboard tab visible whenever help is opened
        const defaultKeyboard = () => showSection(secKeyboard, btnKeyboard)
        defaultKeyboard()

        // Re-apply default each time the help popup becomes visible
        const helpVisibleObserver = new MutationObserver(() => {
          if (helpRoot.classList.contains('cesium-navigation-help-visible')) {
            defaultKeyboard()
          }
        })
        helpVisibleObserver.observe(helpRoot, { attributes: true, attributeFilter: ['class'] })

        // Also attach to the toolbar '?' button if present
        const helpToggleBtn = container.querySelector('.cesium-navigation-help-button') as HTMLButtonElement | null
        helpToggleBtn?.addEventListener('click', () => setTimeout(defaultKeyboard, 0))
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




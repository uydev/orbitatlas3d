import * as Cesium from 'cesium'

export function initCesium(container: string, ionToken: string) {
  const hasIonToken = typeof ionToken === 'string' && ionToken.trim().length > 0
  if (hasIonToken) {
    Cesium.Ion.defaultAccessToken = ionToken
  }

  // Keep the viewer simple and avoid world terrain, which is causing build issues
  const viewer = new Cesium.Viewer(container, {
    // Continuous render loop so animated materials and moving markers are always visible
    requestRenderMode: false,
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: true,
    navigationHelpButton: true,
    sceneModePicker: true,
    // Always use OpenStreetMap imagery; no Cesium World Terrain
    imageryProvider: new (Cesium as any).UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    })
  })

  return viewer
}


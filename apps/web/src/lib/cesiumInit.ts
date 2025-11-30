import * as Cesium from 'cesium'
export function initCesium(container: string, ionToken: string) {
  const hasIonToken = typeof ionToken === 'string' && ionToken.trim().length > 0
  if (hasIonToken) {
    Cesium.Ion.defaultAccessToken = ionToken
  }
  const options: any = {
    // Continuous render loop so animated materials and moving markers are always visible
    requestRenderMode: false,
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: true,
    navigationHelpButton: true,
    sceneModePicker: true,
  }
  if (hasIonToken && typeof (Cesium as any).createWorldTerrain === 'function') {
    options.terrainProvider = (Cesium as any).createWorldTerrain()
  } else {
    // Avoid Ion imagery if no token: use OpenStreetMap tiles
    options.imageryProvider = new (Cesium as any).UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    })
  }
  const viewer = new Cesium.Viewer(container, options)
  return viewer
}




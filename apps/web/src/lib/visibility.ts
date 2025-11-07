  import * as sat from 'satellite.js'
export function solarElevationDeg(lat:number, lon:number, date:Date){
  // Simple approx using sat.solarVector + horizon angle; acceptable for UI.
  const gmst = sat.gstime(date)
  const sunEci = sat.sun(date)
  const ecef = sat.eciToEcf(sunEci, gmst)
  // crude: convert to topocentric at observer (omit full precision; for UI gating)
  const obs = { longitude: lon*Math.PI/180, latitude: lat*Math.PI/180, height: 0 }
  const look = sat.ecfToLookAngles(obs, ecef as any)
  return 90 - (look.elevation * 180/Math.PI)
}




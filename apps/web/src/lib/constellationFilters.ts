export interface ConstellationFilterOption {
  value: string
  label: string
  group: string
  keywords: string[]
  groupId?: string
}

export const CONSTELLATION_FILTERS: ConstellationFilterOption[] = [
  { value: 'finder', label: 'Finder', group: 'Finder', keywords: ['FINDER'] },
  { value: 'starlink', label: 'Starlink', group: 'Internet', keywords: ['STARLINK'], groupId: 'starlink' },
  { value: 'kuiper', label: 'LEO (Kuiper)', group: 'Internet', keywords: ['LEO (KUIPER)', 'KUIPER'], groupId: 'leokuiper' },
  { value: 'oneweb', label: 'OneWeb', group: 'Internet', keywords: ['ONEWEB'], groupId: 'oneweb' },
  { value: 'guowang', label: 'Guowang', group: 'Internet', keywords: ['GUOWANG'] },
  { value: 'galaxyspace', label: 'GalaxySpace', group: 'Internet', keywords: ['GALAXYSPACE'] },
  { value: 'espace', label: 'E-space', group: 'Internet', keywords: ['E-SPACE', 'ESPACE'] },
  { value: 'gps', label: 'GPS', group: 'Positioning', keywords: ['GPS', 'NAVSTAR'], groupId: 'gps' },
  { value: 'galileo', label: 'Galileo', group: 'Positioning', keywords: ['GALILEO'], groupId: 'galileo' },
  { value: 'glonass', label: 'GLONASS', group: 'Positioning', keywords: ['GLONASS'], groupId: 'glonass' },
  { value: 'beidou', label: 'BeiDou', group: 'Positioning', keywords: ['BEIDOU'], groupId: 'beidou' },
  { value: 'swarm', label: 'Swarm', group: 'Science', keywords: ['SWARM'], groupId: 'swarm' },
  { value: 'orbcomm', label: 'Orbcomm', group: 'IoT', keywords: ['ORBCOMM'], groupId: 'orbcomm' },
  { value: 'geespace', label: 'Geespace', group: 'IoT', keywords: ['GEESPACE'] },
  { value: 'tianqi', label: 'Tianqi', group: 'IoT', keywords: ['TIANQI'] },
  { value: 'spire', label: 'Spire', group: 'Weather', keywords: ['SPIRE'], groupId: 'spire' },
  { value: 'planet', label: 'Planet', group: 'Earth Imaging', keywords: ['PLANET'], groupId: 'planet' },
  { value: 'jilin', label: 'Jilin-1', group: 'Earth Imaging', keywords: ['JILIN'], groupId: 'jilin-1' },
  { value: 'satelog', label: 'Satelog', group: 'Earth Imaging', keywords: ['SATELOG'] },
]

export function matchesConstellationFilter(name: string, filter?: string): boolean {
  if (!filter) return true
  const option = CONSTELLATION_FILTERS.find((opt) => opt.value === filter)
  if (!option) return true
  const upper = name.toUpperCase().trim()
  
  // Try exact keyword match first (e.g., "SWARM" matches "SWARM-A", "SWARM B", etc.)
  for (const keyword of option.keywords) {
    const keywordUpper = keyword.toUpperCase()
    if (upper.includes(keywordUpper)) {
      return true
    }
    // Also try with common separators removed (e.g., "STARLINK" matches "STARLINK-1234", "STARLINK 1234")
    const keywordClean = keywordUpper.replace(/[^A-Z0-9]/g, '')
    const nameClean = upper.replace(/[^A-Z0-9]/g, '')
    if (nameClean.includes(keywordClean)) {
      return true
    }
  }
  
  // Also try matching the filter value itself (e.g., "GALAXYSPACE" might be in name as "GALAXY SPACE")
  const filterUpper = filter.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const nameClean = upper.replace(/[^A-Z0-9]/g, '')
  if (nameClean.includes(filterUpper) || filterUpper.includes(nameClean)) {
    return true
  }
  
  return false
}

export function getConstellationFilterOption(value?: string): ConstellationFilterOption | undefined {
  if (!value) return undefined
  return CONSTELLATION_FILTERS.find((opt) => opt.value === value)
}

/**
 * Detect which constellation a satellite belongs to based on its name.
 * Returns the constellation filter option if a match is found.
 */
export function detectConstellationFromName(satelliteName: string): ConstellationFilterOption | undefined {
  if (!satelliteName) return undefined
  
  const upper = satelliteName.toUpperCase().trim()
  
  // Check each constellation filter to see if the satellite name matches
  for (const filter of CONSTELLATION_FILTERS) {
    // Check if any keyword matches
    for (const keyword of filter.keywords) {
      const keywordUpper = keyword.toUpperCase()
      if (upper.includes(keywordUpper)) {
        return filter
      }
      // Also try with separators removed
      const keywordClean = keywordUpper.replace(/[^A-Z0-9]/g, '')
      const nameClean = upper.replace(/[^A-Z0-9]/g, '')
      if (nameClean.includes(keywordClean)) {
        return filter
      }
    }
    
    // Also check if the filter value itself matches
    const filterUpper = filter.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const nameClean = upper.replace(/[^A-Z0-9]/g, '')
    if (nameClean.includes(filterUpper) || filterUpper.includes(nameClean)) {
      return filter
    }
  }
  
  return undefined
}


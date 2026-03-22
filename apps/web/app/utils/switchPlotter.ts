/**
 * Marine MFD–style metadata: pictograms chart plotters would use for these circuits.
 * Icons are Lucide (`i-lucide-*`) for Nuxt Icon.
 */
const PLOTTER_ICONS: Record<string, string> = {
  /* Running / COLREGS suite */
  nav_lights: 'i-lucide-sailboat',
  steaming_lights: 'i-lucide-sun',
  anchor_lights: 'i-lucide-anchor',
  /* Helm / bridge */
  external_helm_light: 'i-lucide-lightbulb',
  external_helm_red_light: 'i-lucide-flame',
  compass_light_external_helm: 'i-lucide-compass',
  /* Domestic */
  water_pressure_pump_stbd: 'i-lucide-droplets',
  water_pressure_pump_port: 'i-lucide-droplets',
}

const PLOTTER_SHORT: Record<string, string> = {
  nav_lights: 'NAV LIGHTS',
  steaming_lights: 'STEAMING',
  anchor_lights: 'ANCHOR',
  external_helm_light: 'HELM WHITE',
  external_helm_red_light: 'HELM RED',
  compass_light_external_helm: 'COMPASS',
  water_pressure_pump_stbd: 'WATER STBD',
  water_pressure_pump_port: 'WATER PORT',
}

export function switchPlotterIcon(switchId: string): string {
  return (
    PLOTTER_ICONS[switchId] ??
    (switchId.includes('pump') ? 'i-lucide-droplets' : 'i-lucide-lightbulb')
  )
}

export function switchPlotterShortLabel(switchId: string, fallbackLabel: string): string {
  const mapped = PLOTTER_SHORT[switchId]
  if (mapped) return mapped
  return fallbackLabel.trim().replaceAll(/\s+/g, ' ').toUpperCase()
}

export function switchPlotterIconAccent(switchId: string): 'red' | 'none' {
  return switchId === 'external_helm_red_light' ? 'red' : 'none'
}

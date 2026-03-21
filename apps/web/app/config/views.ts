export const DEFAULT_VIEWS: Record<string, string[]> = {
  overview: ['battery', 'apparent-wind', 'water-tanks', 'fuel-tanks', 'depth', 'solar'],
  navigation: ['navigation', 'wind', 'apparent-wind', 'depth'],
  electrical: ['battery', 'solar', 'inverter', 'charger'],
  tanks: ['water-tanks', 'fuel-tanks'],
  environment: ['wind', 'apparent-wind', 'depth', 'water-temp'],
  entertainment: ['entertainment'],
  minimal: ['battery', 'apparent-wind', 'depth'],
  steering: ['steering', 'navigation', 'wind'],
  propulsion: ['propulsion', 'battery'],
}

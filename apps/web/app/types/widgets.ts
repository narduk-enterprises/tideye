import type { Component } from 'vue'

/** Dashboard tile height tier — grid row spans on desktop, min-height when stacked on mobile. */
export type WidgetTileSize = 'compact' | 'standard' | 'expanded'

export type WidgetId =
  | 'spacer'
  | 'wind'
  | 'apparent-wind'
  | 'battery'
  | 'water-tanks'
  | 'fuel-tanks'
  | 'water-temp'
  | 'depth'
  | 'solar'
  | 'inverter'
  | 'charger'
  | 'entertainment'
  | 'navigation'
  | 'steering'
  | 'propulsion'
  | 'air-temp'
  | 'barometric-pressure'
  | 'current'
  | 'tide'
  | 'notifications'

export interface BaseWidget {
  id: WidgetId
  component: Component
  name: string
  maxStates: number
  /** Layout tier; defaults to standard when omitted (restored layouts merge from registry). */
  tileSize?: WidgetTileSize
}

export interface Widget extends BaseWidget {
  instanceId: string
  baseId: WidgetId
}

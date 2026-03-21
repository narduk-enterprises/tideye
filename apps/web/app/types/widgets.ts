import type { Component } from 'vue'

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
}

export interface Widget extends BaseWidget {
  instanceId: string
  baseId: WidgetId
}

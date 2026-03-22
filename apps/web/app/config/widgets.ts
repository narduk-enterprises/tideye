import { markRaw } from 'vue'
import type { BaseWidget } from '~/types/widgets'

// Import all widget components
import SpacerWidget from '~/components/dashboard/widgets/spacer/SpacerWidget.vue'
import TrueWindWidget from '~/components/dashboard/widgets/wind/TrueWindWidget.vue'
import ApparentWindWidget from '~/components/dashboard/widgets/wind/ApparentWindWidget.vue'
import BatteryWidget from '~/components/dashboard/widgets/battery/BatteryWidget.vue'
import WaterTanksWidget from '~/components/dashboard/widgets/tanks/water/WaterTanksWidget.vue'
import FuelTanksWidget from '~/components/dashboard/widgets/tanks/fuel/FuelTanksWidget.vue'
import WaterTemperatureWidget from '~/components/dashboard/widgets/temperature/WaterTemperatureWidget.vue'
import DepthWidget from '~/components/dashboard/widgets/depth/DepthWidget.vue'
import SolarWidget from '~/components/dashboard/widgets/solar/SolarWidget.vue'
import InverterWidget from '~/components/dashboard/widgets/inverter/InverterWidget.vue'
import ChargerWidget from '~/components/dashboard/widgets/charger/ChargerWidget.vue'
import EntertainmentWidget from '~/components/dashboard/widgets/entertainment/EntertainmentWidget.vue'
import NavigationWidget from '~/components/dashboard/widgets/navigation/NavigationWidget.vue'
import SteeringWidget from '~/components/dashboard/widgets/steering/SteeringWidget.vue'
import PropulsionWidget from '~/components/dashboard/widgets/propulsion/PropulsionWidget.vue'
import AirTemperatureWidget from '~/components/dashboard/widgets/environment/AirTemperatureWidget.vue'
import BarometricPressureWidget from '~/components/dashboard/widgets/environment/BarometricPressureWidget.vue'
import CurrentWidget from '~/components/dashboard/widgets/environment/CurrentWidget.vue'
import TideWidget from '~/components/dashboard/widgets/environment/TideWidget.vue'
import NotificationsWidget from '~/components/dashboard/widgets/notifications/NotificationsWidget.vue'

export const WIDGET_REGISTRY: BaseWidget[] = [
  {
    id: 'spacer',
    component: markRaw(SpacerWidget),
    name: 'Blank Space',
    maxStates: 1,
    tileSize: 'compact',
  },
  {
    id: 'wind',
    component: markRaw(TrueWindWidget),
    name: 'True Wind',
    maxStates: 1,
    tileSize: 'standard',
  },
  {
    id: 'apparent-wind',
    component: markRaw(ApparentWindWidget),
    name: 'Apparent Wind',
    maxStates: 2,
    tileSize: 'standard',
  },
  {
    id: 'battery',
    component: markRaw(BatteryWidget),
    name: 'Battery',
    maxStates: 3,
    tileSize: 'standard',
  },
  {
    id: 'water-tanks',
    component: markRaw(WaterTanksWidget),
    name: 'Water Tanks',
    maxStates: 4,
    tileSize: 'expanded',
  },
  {
    id: 'fuel-tanks',
    component: markRaw(FuelTanksWidget),
    name: 'Fuel Tanks',
    maxStates: 3,
    tileSize: 'expanded',
  },
  {
    id: 'water-temp',
    component: markRaw(WaterTemperatureWidget),
    name: 'Water Temperature',
    maxStates: 1,
    tileSize: 'compact',
  },
  {
    id: 'depth',
    component: markRaw(DepthWidget),
    name: 'Depth',
    maxStates: 1,
    tileSize: 'compact',
  },
  {
    id: 'solar',
    component: markRaw(SolarWidget),
    name: 'Solar',
    maxStates: 3,
    tileSize: 'standard',
  },
  {
    id: 'inverter',
    component: markRaw(InverterWidget),
    name: 'Inverter',
    maxStates: 3,
    tileSize: 'standard',
  },
  {
    id: 'charger',
    component: markRaw(ChargerWidget),
    name: 'Charger',
    maxStates: 3,
    tileSize: 'standard',
  },
  {
    id: 'entertainment',
    component: markRaw(EntertainmentWidget),
    name: 'Entertainment',
    maxStates: 1,
    tileSize: 'expanded',
  },
  {
    id: 'navigation',
    component: markRaw(NavigationWidget),
    name: 'Navigation',
    maxStates: 1,
    tileSize: 'standard',
  },
  {
    id: 'steering',
    component: markRaw(SteeringWidget),
    name: 'Steering',
    maxStates: 1,
    tileSize: 'standard',
  },
  {
    id: 'propulsion',
    component: markRaw(PropulsionWidget),
    name: 'Propulsion',
    maxStates: 1,
    tileSize: 'standard',
  },
  {
    id: 'air-temp',
    component: markRaw(AirTemperatureWidget),
    name: 'Air Temperature',
    maxStates: 1,
    tileSize: 'compact',
  },
  {
    id: 'barometric-pressure',
    component: markRaw(BarometricPressureWidget),
    name: 'Barometric Pressure',
    maxStates: 1,
    tileSize: 'compact',
  },
  {
    id: 'current',
    component: markRaw(CurrentWidget),
    name: 'Current',
    maxStates: 1,
    tileSize: 'compact',
  },
  { id: 'tide', component: markRaw(TideWidget), name: 'Tide', maxStates: 1, tileSize: 'compact' },
  {
    id: 'notifications',
    component: markRaw(NotificationsWidget),
    name: 'Notifications',
    maxStates: 1,
    tileSize: 'expanded',
  },
]

export const DEFAULT_LAYOUT = ['battery', 'apparent-wind', 'water-tanks', 'fuel-tanks', 'depth']

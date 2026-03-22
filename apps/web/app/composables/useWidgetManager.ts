// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import type { BaseWidget, Widget } from '~/types/widgets'

export function useWidgetManager(allWidgets: BaseWidget[], defaultLayout: string[]) {
  const activeWidgets = ref<Widget[]>([])
  const widgetCycleStates = useLocalStorage('widget-cycle-states', {} as Record<string, number>)

  const generateInstanceId = (widgetId: string) => `${widgetId}-${nanoid()}`

  const loadSavedLayout = () => {
    if (!import.meta.client) return

    const savedLayout = localStorage.getItem('dashboardLayout')
    if (savedLayout) {
      try {
        const savedWidgets = JSON.parse(savedLayout)
        const restoredWidgets = savedWidgets

          .map((saved: any) => {
            const baseWidget = allWidgets.find((w) => w.id === saved.baseId)
            if (baseWidget) {
              return {
                ...baseWidget,
                instanceId: saved.instanceId,
                baseId: saved.baseId,
              }
            }
            return null
          })
          .filter(Boolean)
        if (restoredWidgets.length) {
          activeWidgets.value = restoredWidgets
          return
        }
      } catch (e) {
        console.error('Failed to load dashboard layout:', e)
      }
    }

    // Load default layout
    activeWidgets.value = defaultLayout
      .map((widgetId) => {
        const widget = allWidgets.find((w) => w.id === widgetId)
        if (widget) {
          return {
            ...widget,
            instanceId: generateInstanceId(widget.id),
            baseId: widget.id,
          }
        }
        return null
      })
      .filter(Boolean) as Widget[]

    saveLayout()
  }

  const saveLayout = () => {
    if (!import.meta.client) return

    const layoutToSave = activeWidgets.value.map((widget) => ({
      instanceId: widget.instanceId,
      baseId: widget.baseId,
    }))
    localStorage.setItem('dashboardLayout', JSON.stringify(layoutToSave))
  }

  const removeWidget = (instanceId: string) => {
    activeWidgets.value = activeWidgets.value.filter((w) => w.instanceId !== instanceId)
    saveLayout()
  }

  const addWidget = (baseWidget: BaseWidget) => {
    const widget: Widget = {
      ...baseWidget,
      instanceId: generateInstanceId(baseWidget.id),
      baseId: baseWidget.id,
    }
    activeWidgets.value = [...activeWidgets.value, widget]
    saveLayout()
  }

  const handleWidgetCycle = (widget: Widget) => {
    const currentState = widgetCycleStates.value[widget.instanceId] || 0
    const maxStates = widget.maxStates || 1
    const nextState = (currentState + 1) % maxStates

    widgetCycleStates.value = {
      ...widgetCycleStates.value,
      [widget.instanceId]: nextState,
    }
  }

  // Clean up removed widgets from cycle states
  watch(
    () => activeWidgets.value,
    (widgets) => {
      const activeIds = new Set(widgets.map((w) => w.instanceId))
      const newStates = {} as Record<string, number>

      for (const [id, state] of Object.entries(widgetCycleStates.value)) {
        if (activeIds.has(id)) {
          newStates[id] = state
        }
      }

      widgetCycleStates.value = newStates
    },
    { deep: true },
  )

  return {
    activeWidgets,
    widgetCycleStates,
    loadSavedLayout,
    saveLayout,
    addWidget,
    removeWidget,
    handleWidgetCycle,
  }
}

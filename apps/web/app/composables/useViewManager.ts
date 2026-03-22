// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import { useLocalStorage } from '@vueuse/core'
import type { Widget } from '~/types/widgets'

export interface View {
  id: string
  name: string
  widgets: Array<{ instanceId: string; baseId: string }>
  isDefault?: boolean
}

const STORAGE_KEY = 'dashboardViews'
const CURRENT_VIEW_KEY = 'currentViewId'

export function useViewManager(allWidgets: any[], defaultViews: Record<string, string[]>) {
  const views = useLocalStorage<View[]>(STORAGE_KEY, [])
  const currentViewId = useLocalStorage<string | null>(CURRENT_VIEW_KEY, null)

  // Initialize default views if none exist, or merge missing ones
  if (views.value.length === 0) {
    const defaultViewsList: View[] = Object.entries(defaultViews).map(([id, widgetIds], index) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replaceAll(/([A-Z])/g, ' $1'),
      widgets: widgetIds.map((widgetId) => ({
        instanceId: `${widgetId}-${Date.now()}-${Math.random()}`,
        baseId: widgetId,
      })),
      isDefault: index === 0,
    }))
    views.value = defaultViewsList
    if (defaultViewsList.length > 0) {
      currentViewId.value = defaultViewsList[0].id
    }
  } else {
    const existingViewIds = new Set(views.value.map((v) => v.id))
    const missingViews: View[] = Object.entries(defaultViews)
      .filter(([id]) => !existingViewIds.has(id))
      .map(([id, widgetIds]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replaceAll(/([A-Z])/g, ' $1'),
        widgets: widgetIds.map((widgetId) => ({
          instanceId: `${widgetId}-${Date.now()}-${Math.random()}`,
          baseId: widgetId,
        })),
        isDefault: false,
      }))

    if (missingViews.length > 0) {
      views.value.push(...missingViews)
    }
  }

  const currentView = ref<View | null>(
    views.value.find((v) => v.id === currentViewId.value) || views.value[0] || null,
  )

  const loadView = (viewId: string): Widget[] => {
    const view = views.value.find((v) => v.id === viewId)
    if (!view) return []

    currentViewId.value = viewId
    currentView.value = view

    return view.widgets
      .map((w) => {
        const baseWidget = allWidgets.find((bw) => bw.id === w.baseId)
        if (baseWidget) {
          return {
            ...baseWidget,
            instanceId: w.instanceId,
            baseId: w.baseId,
          }
        }
        return null
      })
      .filter(Boolean) as Widget[]
  }

  const saveCurrentView = (widgets: Widget[]) => {
    if (!currentView.value) return

    const viewIndex = views.value.findIndex((v) => v.id === currentView.value!.id)
    if (viewIndex !== -1) {
      views.value[viewIndex] = {
        ...currentView.value,
        widgets: widgets.map((w) => ({
          instanceId: w.instanceId,
          baseId: w.baseId,
        })),
      }
      currentView.value = views.value[viewIndex]
    }
  }

  const createView = (name: string, widgets: Widget[]): View => {
    const newView: View = {
      id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      widgets: widgets.map((w) => ({
        instanceId: w.instanceId,
        baseId: w.baseId,
      })),
    }
    views.value.push(newView)
    return newView
  }

  const duplicateView = (viewId: string, newName?: string): View | null => {
    const view = views.value.find((v) => v.id === viewId)
    if (!view) return null

    const duplicated = createView(
      newName || `${view.name} (Copy)`,
      view.widgets
        .map((w) => {
          const baseWidget = allWidgets.find((bw) => bw.id === w.baseId)
          if (baseWidget) {
            return {
              ...baseWidget,
              instanceId: `${w.baseId}-${Date.now()}-${Math.random()}`,
              baseId: w.baseId,
            }
          }
          return null
        })
        .filter(Boolean) as Widget[],
    )

    return duplicated
  }

  const renameView = (viewId: string, newName: string): boolean => {
    const view = views.value.find((v) => v.id === viewId)
    if (!view) return false

    view.name = newName
    if (currentView.value?.id === viewId) {
      currentView.value.name = newName
    }
    return true
  }

  const deleteView = (viewId: string): boolean => {
    const index = views.value.findIndex((v) => v.id === viewId)
    if (index === -1) return false
    if (views.value.length <= 1) return false

    views.value.splice(index, 1)

    if (currentViewId.value === viewId) {
      currentViewId.value = views.value[0]?.id || null
      currentView.value = views.value[0] || null
    }

    return true
  }

  const setDefaultView = (viewId: string): boolean => {
    const view = views.value.find((v) => v.id === viewId)
    if (!view) return false

    for (const v of views.value) {
      v.isDefault = false
    }

    view.isDefault = true
    return true
  }

  watch(currentViewId, (newId) => {
    if (newId) {
      currentView.value = views.value.find((v) => v.id === newId) || null
    }
  })

  return {
    views,
    currentView: computed(() => currentView.value),
    currentViewId: computed(() => currentViewId.value),
    loadView,
    saveCurrentView,
    createView,
    duplicateView,
    renameView,
    deleteView,
    setDefaultView,
  }
}

# mapkit-large-annotations

Use this skill when building or refactoring Apple MapKit JS views that need to
handle dozens to thousands of annotations, especially when the data is live,
filterable, or updates every few seconds.

This skill is for MapKit JS in web apps, not native `MKMapView`.

## When To Use This Pattern

Use the simple component-driven pattern when:

- There are fewer than ~50 annotations
- The dataset changes infrequently
- Rebuilding all annotations on prop change is acceptable
- Built-in clustering solves the problem

Switch to the large-annotation pattern when:

- The map has many moving markers
- Updates arrive on an interval or stream
- Filters or selection change often
- Full annotation rebuilds cause jank
- Marker DOM needs to stay stable between updates

## Core Rules

1. Split low-churn and high-churn layers.
2. Keep self/current-user markers separate from traffic/background markers.
3. Do not rebuild every annotation on each reactive change.
4. Key all annotations by stable entity id.
5. Update `annotation.coordinate` in place when the marker only moved.
6. Rebuild markers only when their DOM shape actually changed.
7. Use overlays for derived visuals like vectors, trails, route lines, and
   dense point clouds.
8. Avoid reactive wrapping of raw MapKit objects. Store them in plain `Map`s and
   local variables.

## Default Architecture

For dense or live data, do not route everything through a generic `items` prop.
Instead:

- Keep the base map in a reusable MapKit component or loader
- Manage high-churn annotations in a dedicated composable or client component
- Access the live map instance directly
- Run a diff-based refresh loop keyed by vessel/entity id

Recommended local state:

```ts
declare const mapkit: any

interface MapKitMap {
  addAnnotation(annotation: MapKitAnnotationRef): void
  removeAnnotation(annotation: MapKitAnnotationRef): void
  addOverlay(overlay: unknown): void
  removeOverlay(overlay: unknown): void
  selectedAnnotation: unknown | null
}

interface MapKitAnnotationRef {
  coordinate: unknown
}

const annotations = new Map<string, MapKitAnnotationRef>()
const lastRendered = new Map<string, { lat: number; lng: number }>()
const labelEls = new Map<string, HTMLElement>()
const iconEls = new Map<string, HTMLElement>()
const vectorOverlays = new Map<string, unknown>()

let pinnedId: string | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
```

## Choose The Rendering Strategy

Pick the lightest strategy that still satisfies the UX:

### A. Static or low-frequency pins

Use normal annotations and optionally MapKit clustering.

Good for:

- Search results
- Saved places
- Low-frequency datasets

### B. Large live marker sets

Use direct `mapkit.Annotation` management with a keyed diff loop.

Good for:

- Vessel traffic
- Vehicle fleets
- Aircraft
- Any stream of moving entities

### C. Huge point clouds with minimal interactivity

Use `CircleOverlay` or other overlays instead of DOM-backed annotations.

Good for:

- Heat-like point layers
- Detection clouds
- Density previews

## Refresh Loop

For high-churn markers, refresh by diffing the current dataset against what is
already on the map.

```ts
const MOVEMENT_THRESHOLD_M = 15

function refreshAnnotations(map: MapKitMap, entities: Entity[]) {
  const visible = entities.filter((entity) => entity.lat != null && entity.lng != null)
  const nextIds = new Set(visible.map((entity) => entity.id))

  for (const [id, annotation] of annotations) {
    if (nextIds.has(id)) continue
    map.removeAnnotation(annotation)
    annotations.delete(id)
    lastRendered.delete(id)
    iconEls.delete(id)
    labelEls.delete(id)
    if (pinnedId === id) pinnedId = null
  }

  let anyMoved = false

  for (const entity of visible) {
    const existing = annotations.get(entity.id)
    const prev = lastRendered.get(entity.id)

    if (!existing) {
      const created = createAnnotation(entity)
      if (!created) continue
      map.addAnnotation(created.annotation)
      annotations.set(entity.id, created.annotation)
      iconEls.set(entity.id, created.icon)
      if (created.label) labelEls.set(entity.id, created.label)
      lastRendered.set(entity.id, { lat: entity.lat, lng: entity.lng })
      anyMoved = true
      continue
    }

    if (
      prev &&
      haversineMeters(prev.lat, prev.lng, entity.lat, entity.lng) >= MOVEMENT_THRESHOLD_M
    ) {
      existing.coordinate = new mapkit.Coordinate(entity.lat, entity.lng)
      updateMarkerVisual(iconEls.get(entity.id)!, labelEls.get(entity.id) ?? null, entity)
      lastRendered.set(entity.id, { lat: entity.lat, lng: entity.lng })
      anyMoved = true
    }
  }

  if (anyMoved) refreshDerivedOverlays(map, visible)
}
```

## Rebuild Triggers

Recreate all annotations only when one of these changes:

- Label visibility mode
- Marker template or sizing
- Filters that materially change the visible set
- Callout structure
- Category/icon taxonomy

Do not recreate all annotations just because:

- Coordinates changed
- Heading changed
- One marker was selected
- The camera moved

## Marker Construction Rules

When creating annotations:

- Use fixed annotation sizes
- Use a stable anchor offset
- Keep the DOM small
- Put detailed information in the callout, not the base marker
- Set `animates: false` unless animation is clearly needed

Recommended pattern:

```ts
function createAnnotation(entity: Entity) {
  const root = document.createElement('div')
  root.style.cssText =
    'position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer;touch-action:manipulation;'

  const iconEl = document.createElement('div')
  root.appendChild(iconEl)

  let labelEl: HTMLElement | null = null
  if (shouldShowLabel(entity)) {
    labelEl = document.createElement('div')
    labelEl.style.cssText =
      'position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;pointer-events:none;'
    root.appendChild(labelEl)
  }

  root.addEventListener('click', (event) => {
    event.stopPropagation()
    pinnedId = entity.id
  })

  updateMarkerVisual(iconEl, labelEl, entity)

  const annotation = new mapkit.Annotation(
    new mapkit.Coordinate(entity.lat, entity.lng),
    () => root,
    {
      anchorOffset: new DOMPoint(0, -4),
      calloutEnabled: true,
      animates: false,
      size: { width: 28, height: 28 },
      data: { entityId: entity.id },
    },
  )

  return {
    annotation,
    icon: iconEl,
    label: labelEl,
  }
}
```

## Labels

Labels are expensive. Default to one of these policies:

- Show labels only for the selected annotation
- Show labels only when total visible count is small
- Show labels behind a user toggle

Do not render labels for every marker in dense views unless the count is known
to stay small.

## Callouts

Use callouts for heavy detail instead of stuffing the marker DOM.

Recommended behavior:

- Hover previews on pointer devices
- Click/tap pins the callout
- Moving from marker to callout should not immediately close it
- Clear the pinned state when the map deselects the annotation

If MapKit callouts are used, generate the callout element lazily from fresh data
so it reflects the latest entity state.

## Camera Control

Never auto-fit on every live update.

Use these rules:

- Keep a `cameraMode` such as `fit`, `follow`, or `lead`
- Suspend auto-camera briefly after wheel, pointer, or touch interaction
- Track the user-selected zoom span separately from auto-follow span
- Recenter only the pinned or followed entity, not the whole dataset

## Derived Overlays

Keep overlays in separate keyed maps from annotations.

Typical overlays:

- Prediction vectors
- Trails
- Completed route segments
- Wake lines

Rules:

- Rebuild overlays only when source geometry materially changed
- Remove stale overlays by id
- Use overlays instead of more annotations when the visual is not directly
  interactive

## Clustering And Circle Fallbacks

For reusable map components that receive a plain list of items:

- Use MapKit clustering for medium-density static pins
- Use circle overlays when you need many visible points but not per-point DOM
- Expose both strategies so the caller can choose based on count and update rate

Do not force clustering onto live, frequently-moving traffic if the UX requires
precise per-entity selection and custom refresh logic. In that case, direct
annotation management is usually cleaner.

## Vue / Nuxt Guidance

If using Vue or Nuxt:

- Keep MapKit objects in local variables or `Map`s, not reactive deep state
- Use shallow refs only for external inputs, not raw annotations
- Watch arrays with `deep: false` when the array identity changes upstream
- Start the overlay logic only after the map instance exists
- Stop timers and remove annotations on `onBeforeUnmount`, `onDeactivated`, and
  similar lifecycle exits if the view is cached

## Cleanup Checklist

Always clean up:

- Refresh intervals
- Hover-hide timers
- Selection listeners
- All annotations
- All overlays
- All keyed DOM reference maps
- Any pinned or selected ids

## Implementation Checklist

When asked to build a large MapKit annotation feature:

1. Classify each map layer as low-churn, high-churn, or overlay-only.
2. Decide whether generic component props are sufficient or whether direct
   MapKit access is required.
3. Build keyed annotation maps and a diff-based refresh loop.
4. Add a movement threshold so tiny GPS jitter does not trigger updates.
5. Move detail UI into callouts.
6. Limit label rendering aggressively.
7. Keep camera logic separate from annotation refresh logic.
8. Add full cleanup for timers, listeners, annotations, and overlays.

## What To Avoid

- Rebuilding every annotation on every reactive state change
- Storing raw MapKit objects in deep reactive structures
- Auto-fitting the map after each refresh tick
- Rendering full labels for hundreds of markers
- Mixing self-marker, traffic markers, routes, vectors, and selection logic into
  one giant watcher
- Using annotations when a lightweight overlay would do

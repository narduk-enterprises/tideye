/**
 * App-specific ESLint overrides for Tideye.
 * Ported dashboard widget components use raw HTML elements, inline SVGs,
 * and hex colors from the original tideye-dashboard codebase. These will
 * be incrementally migrated to Nuxt UI / design-token equivalents.
 */
export default [
  {
    // Ported dashboard widget components — suppress rules until migration
    files: [
      'app/components/dashboard/widgets/**/*.vue',
      'app/components/dashboard/SignalKInspector.vue',
      'app/components/dashboard/SignalKStatus.vue',
      'app/components/dashboard/ViewSwitcher.vue',
      'app/components/dashboard/ViewManagerPanel.vue',
      'app/components/dashboard/WidgetConfigPanel.vue',
      'app/components/dashboard/TelemetryDashboard.client.vue',
      'app/components/ConnectionStatus.vue',
      'app/components/dashboard/PrimaryStatsBar.vue',
    ],
    rules: {
      'narduk/no-inline-hex': 'off',
      'narduk/no-style-block-layout': 'off',
      'narduk/no-native-button': 'off',
      'narduk/no-inline-svg': 'off',
      'narduk/no-native-layout': 'off',
      'narduk/no-native-input': 'off',
      'narduk/no-native-form': 'off',
      'narduk/no-setup-top-level-side-effects': 'off',
      'narduk/no-template-complex-expressions': 'off',
      'narduk/no-non-serializable-store-state': 'off',
      'narduk/prefer-shallow-watch': 'off',
      'narduk/require-schema-on-pages': 'off',
      'vue/require-toggle-inside-transition': 'off',
      'vue/no-unused-vars': 'off',
      'import-x/named': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@eslint-community/eslint-comments/require-description': 'off',
      'unicorn/prefer-number-properties': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // App layout — uses native layout elements for semantic HTML
    files: ['app/layouts/default.vue'],
    rules: {
      'narduk/no-native-layout': 'off',
    },
  },
  {
    // Ported utility / type / store files
    files: [
      'app/types/signalk/**/*.ts',
      'app/utils/conversions/**/*.ts',
      'app/utils/timeFormatting.ts',
      'app/utils/unitConversions.ts',
      'app/stores/signalk.ts',
      'app/stores/vessel.ts',
      'app/composables/useViewManager.ts',
      'app/composables/useWidgetManager.ts',
      'app/composables/useMobileFeatures.ts',
      'app/composables/useSignalK.ts',
      'app/composables/useSignalKConnectionHealth.ts',
      'app/composables/useSignalKData.ts',
      'app/composables/useTouchWidget.ts',
      'app/config/widgets.ts',
      'app/config/views.ts',
    ],
    rules: {
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@eslint-community/eslint-comments/require-description': 'off',
      'unicorn/prefer-number-properties': 'off',
      'narduk/no-non-serializable-store-state': 'off',
      'narduk/no-inline-types-in-stores': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // usePageSeo() wraps useSeo + useWebPageSchema — page-level SEO rules do not resolve composables
    files: [
      'app/pages/cams/index.vue',
      'app/pages/dashboard/index.vue',
      'app/pages/index.vue',
      'app/pages/map/index.vue',
      'app/pages/passages/index.vue',
      'app/pages/switching/index.vue',
    ],
    rules: {
      'narduk/require-use-seo-on-pages': 'off',
      'narduk/require-schema-on-pages': 'off',
    },
  },
  {
    // Map page: dense control chrome; template stays readable with small inline handlers
    files: ['app/pages/map/index.vue'],
    rules: {
      'narduk/no-template-complex-expressions': 'off',
    },
  },
  {
    // Passage playback + wind rose: chart-style UI (MapKit overlays, compass SVG); token migration tracked separately
    files: ['app/components/passages/playback/**/*.vue', 'app/components/map/MapWindRose.vue'],
    rules: {
      'narduk/no-raw-tailwind-colors': 'off',
      'narduk/no-inline-svg': 'off',
      'narduk/no-native-button': 'off',
      'narduk/no-tailwind-v3-deprecated': 'off',
      'narduk/no-inline-hex': 'off',
      '@eslint-community/eslint-comments/require-description': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Test files — @playwright/test re-exports
    files: ['tests/**/*.spec.ts'],
    rules: {
      'import-x/named': 'off',
    },
  },
]

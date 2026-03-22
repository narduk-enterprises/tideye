<script setup lang="ts">
useSeo({
  title: 'Dashboard — Tideye',
  description:
    'Real-time vessel telemetry dashboard with customizable widgets for battery, wind, navigation, and more.',
})
useWebPageSchema({
  name: 'Dashboard — Tideye',
  description:
    'Real-time vessel telemetry dashboard with customizable widgets for battery, wind, navigation, and more.',
})
</script>

<template>
  <DashboardTelemetryDashboard />
</template>

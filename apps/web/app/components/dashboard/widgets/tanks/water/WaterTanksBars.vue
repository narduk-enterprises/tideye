<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankBarsDisplay from '../shared/TankBarsDisplay.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankBarsDisplay
      title="Fresh Water"
      :tanks="tanks.freshWater"
      :get-tank-color="getTankColor"
      large-percentage
    />
  </TanksWidgetBase>
</template>

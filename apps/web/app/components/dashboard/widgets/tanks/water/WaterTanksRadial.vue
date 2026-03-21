<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankRadialDisplay from '../shared/TankRadialDisplay.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankRadialDisplay
      title="Fresh Water"
      :tanks="tanks.freshWater"
      :get-tank-color="getTankColor"
    />
  </TanksWidgetBase>
</template>

<style scoped>
/* Same styles as before for radial view */
</style>

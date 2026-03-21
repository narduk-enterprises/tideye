<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankRadialDisplay from '../shared/TankRadialDisplay.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankRadialDisplay title="Fuel" :tanks="tanks.fuel" :get-tank-color="getTankColor" />
  </TanksWidgetBase>
</template>

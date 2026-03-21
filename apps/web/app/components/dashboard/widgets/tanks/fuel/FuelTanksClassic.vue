<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankDisplay from '../shared/TankDisplay.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankDisplay title="Fuel" :tanks="tanks.fuel" :get-tank-color="getTankColor" />
  </TanksWidgetBase>
</template>

<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankDisplay from '../shared/TankDisplay.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankDisplay title="Fresh Water" :tanks="tanks.freshWater" :get-tank-color="getTankColor" />
  </TanksWidgetBase>
</template>

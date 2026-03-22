<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankBarsDisplay from './TankBarsDisplay.vue'

defineProps<{ title: string; tankKey: 'fuel' | 'freshWater' }>()
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankBarsDisplay
      :title="title"
      :tanks="tanks[tankKey]"
      :get-tank-color="getTankColor"
      large-percentage
    />
  </TanksWidgetBase>
</template>

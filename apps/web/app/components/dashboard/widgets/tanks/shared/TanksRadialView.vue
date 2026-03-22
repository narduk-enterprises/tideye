<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankRadialDisplay from './TankRadialDisplay.vue'

defineProps<{ title: string; tankKey: 'fuel' | 'freshWater' }>()
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankRadialDisplay :title="title" :tanks="tanks[tankKey]" :get-tank-color="getTankColor" />
  </TanksWidgetBase>
</template>

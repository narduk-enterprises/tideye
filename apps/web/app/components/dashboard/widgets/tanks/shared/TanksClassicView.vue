<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import TankDisplay from './TankDisplay.vue'

defineProps<{ title: string; tankKey: 'fuel' | 'freshWater' }>()
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getTankColor }">
    <TankDisplay :title="title" :tanks="tanks[tankKey]" :get-tank-color="getTankColor" />
  </TanksWidgetBase>
</template>

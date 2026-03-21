<script setup lang="ts">
import WindWidgetBase from './WindWidgetBase.vue'
import WindDisplayBase from './WindDisplayBase.vue'
</script>

<template>
  <WindWidgetBase v-slot="{ trueWindSpeed, trueWindAngle }">
    <WindDisplayBase
      title="True Wind"
      :speed="trueWindSpeed"
      :angle="trueWindAngle"
      :show-compass="false"
    />
  </WindWidgetBase>
</template>

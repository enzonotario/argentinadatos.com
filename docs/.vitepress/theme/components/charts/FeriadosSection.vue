<script setup lang="ts">
import { ref } from 'vue'
import ChartProximoFeriado from './ChartProximoFeriado.vue'
import ChartFeriados from './ChartFeriados.vue'
import ChartFeriadosCalendario from './ChartFeriadosCalendario.vue'

const year = ref(new Date().getFullYear())
</script>

<template>
  <div class="flex flex-col gap-8">
    <ChartProximoFeriado />

    <div class="flex flex-col">
      <div class="flex justify-start items-center space-x-4">
        <h3 style="margin: 0">Feriados del año</h3>
        <input
          v-model="year"
          type="number"
          min="2000"
          :max="new Date().getFullYear() + 1"
          step="1"
          class="rounded p-2 bg-muted border border-gray-300 dark:border-gray-700"
        />
      </div>

      <ChartFeriados :year="year" />

      <ChartFeriadosCalendario :year="year" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'

const api = useApi()
const loading = ref(false)
const feriados = ref([])
const year = ref(new Date().getFullYear())

const feriadosOrdenados = computed(() => {
  return feriados.value
    .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
})

function capitalize(str: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatDate(dateStr: string) {
  const date = parseISO(dateStr)
  return capitalize(format(date, 'EEEE, d MMMM yyyy', { locale: es }))
}

async function fetchFeriados() {
  loading.value = true
  try {
    const response = await api.get(`/feriados-bancarios/${year.value}`)
    feriados.value = response
  }
  catch (error) {
    console.error('Error fetching feriados bancarios:', error)
    feriados.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFeriados()
})

watch(year, () => {
  fetchFeriados()
})
</script>

<template>
  <div class="feriados-bancarios-table">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold m-0">Feriados Bancarios {{ year }}</h3>
      <div class="flex items-center space-x-2">
        <label for="year-select" class="text-sm text-gray-600 dark:text-gray-400">Año:</label>
        <select
          id="year-select"
          v-model="year"
          class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          @change="fetchFeriados"
        >
          <option v-for="y in [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]" :key="y" :value="y">
            {{ y }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <div class="text-gray-500 dark:text-gray-400">Cargando feriados...</div>
    </div>

    <div v-else-if="feriadosOrdenados.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      No se encontraron feriados bancarios para el año {{ year }}
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse bg-white dark:bg-gray-900 rounded-lg shadow-sm">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-800">
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              Fecha
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              Nombre
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="feriado in feriadosOrdenados"
            :key="feriado.fecha"
            class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {{ formatDate(feriado.fecha) }}
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ feriado.nombre }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
      <p>Total de feriados bancarios: {{ feriadosOrdenados.length }}</p>
    </div>
  </div>
</template>

<style scoped>
.feriados-bancarios-table {
  font-family: inherit;
}
</style>
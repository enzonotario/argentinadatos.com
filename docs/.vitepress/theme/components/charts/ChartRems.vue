<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApi } from '../../composables/useApi'

const api = useApi()

const endpoints = ref<string[]>([])
const error = ref(false)
const filtro = ref('')

onMounted(async () => {
  try {
    const data = await api.get('/rems')
    endpoints.value = Array.isArray(data) ? data : []
  }
  catch {
    error.value = true
    endpoints.value = []
  }
})

const filtrados = computed(() => {
  const q = filtro.value.trim().toLowerCase()
  if (!q)
    return endpoints.value
  return endpoints.value.filter(p => p.toLowerCase().includes(q))
})
</script>

<template>
  <div class="not-prose my-6 space-y-4">
    <h3 class="text-lg font-semibold">
      Índice REM
    </h3>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Rutas relativas devueltas por <code class="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">GET /rems</code>. Filtrá por texto para buscar un período.
    </p>
    <div v-if="error" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      No se pudo cargar el índice.
    </div>
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-sm text-gray-600 dark:text-gray-400" for="rem-index-filter">Filtrar</label>
        <input
          id="rem-index-filter"
          v-model="filtro"
          type="search"
          placeholder="ej. 2025 o ultimo"
          class="min-w-[12rem] flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
        <span class="text-xs text-gray-500">{{ filtrados.length }} / {{ endpoints.length }}</span>
      </div>
      <div
        v-if="endpoints.length === 0"
        class="text-sm text-gray-500"
      >
        Cargando…
      </div>
      <div
        v-else
        class="max-h-[28rem] overflow-auto"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/95">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                #
              </th>
              <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                Ruta
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
            <tr
              v-for="(path, i) in filtrados"
              :key="path"
              class="hover:bg-gray-50 dark:hover:bg-gray-900/40"
            >
              <td class="whitespace-nowrap px-3 py-2 text-gray-500">
                {{ i + 1 }}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                {{ path }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

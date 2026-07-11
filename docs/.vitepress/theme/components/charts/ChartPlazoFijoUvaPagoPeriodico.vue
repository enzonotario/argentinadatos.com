<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '../../composables/useApi'
import ChartPlazoFijoUvaPagoPeriodicoProveedor from './ChartPlazoFijoUvaPagoPeriodicoProveedor.vue'
import type { ProveedorPlazoFijoUva } from './ChartPlazoFijoUvaPagoPeriodicoProveedor.vue'
import 'vue-data-ui/style.css'

const api = useApi()

const loading = ref(false)
const proveedores = ref<ProveedorPlazoFijoUva[]>([])

async function cargarProveedores() {
  loading.value = true
  try {
    const data: ProveedorPlazoFijoUva[] = await api.get('/finanzas/tasas/plazoFijoUvaPagoPeriodico')
    proveedores.value = Array.isArray(data) ? data : []
  }
  catch {
    proveedores.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  await cargarProveedores()
})
</script>

<template>
  <div class="not-prose flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-4">
      <h3 class="m-0 text-lg font-semibold">
        Plazo fijo UVA con pago periódico
      </h3>
      <span
        v-if="loading"
        class="h-5 w-5 shrink-0 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"
      />
    </div>

    <p
      v-if="!loading && proveedores.length === 0"
      class="m-0 text-sm text-gray-500 dark:text-gray-400"
    >
      No hay proveedores con tasas UVA de pago periódico en este momento.
    </p>

    <div class="flex flex-col gap-6">
      <ChartPlazoFijoUvaPagoPeriodicoProveedor
        v-for="p in proveedores"
        :key="p.id"
        :proveedor="p"
      />
    </div>
  </div>
</template>

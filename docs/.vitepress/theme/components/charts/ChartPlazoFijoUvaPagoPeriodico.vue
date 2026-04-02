<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '../../composables/useApi'
import ChartPlazoFijoUvaPagoPeriodicoProveedor from './ChartPlazoFijoUvaPagoPeriodicoProveedor.vue'
import type { ProveedorPlazoFijoUva } from './ChartPlazoFijoUvaPagoPeriodicoProveedor.vue'

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
  <div class="flex flex-col gap-10">
    <div class="flex flex-wrap items-center gap-4">
      <h3 class="m-0">
        Plazo fijo UVA con pago periódico
      </h3>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full shrink-0" />
    </div>
    <ChartPlazoFijoUvaPagoPeriodicoProveedor
      v-for="p in proveedores"
      :key="p.id"
      :proveedor="p"
    />
  </div>
</template>

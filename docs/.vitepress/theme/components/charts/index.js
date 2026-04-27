import { defineAsyncComponent } from 'vue'

export default {
  ChartFeriados: defineAsyncComponent(() => import('./ChartFeriados.vue')),
  ChartProximoFeriado: defineAsyncComponent(
    () => import('./ChartProximoFeriado.vue'),
  ),
  ChartDolares: defineAsyncComponent(() => import('./ChartDolares.vue')),
  ChartDolaresCasa: defineAsyncComponent(
    () => import('./ChartDolaresCasa.vue'),
  ),
  ChartDolaresCasaFecha: defineAsyncComponent(
    () => import('./ChartDolaresCasaFecha.vue'),
  ),
  ChartEventosPresidenciales: defineAsyncComponent(
    () => import('./ChartEventosPresidenciales.vue'),
  ),
  ChartIndicesInflacion: defineAsyncComponent(
    () => import('./ChartIndicesInflacion.vue'),
  ),
  ChartIndicesInflacionInteranual: defineAsyncComponent(
    () => import('./ChartIndicesInflacionInteranual.vue'),
  ),
  ChartTasasDepositos30Dias: defineAsyncComponent(
    () => import('./ChartTasasDepositos30Dias.vue'),
  ),
  ChartIndicesUva: defineAsyncComponent(() => import('./ChartIndicesUva.vue')),
  ChartIndicesRiesgoPais: defineAsyncComponent(() => import('./ChartIndicesRiesgoPais.vue')),
  ChartDiputadosBloque: defineAsyncComponent(() => import('./ChartDiputadosBloque.vue')),
  ChartDiputadosProvincia: defineAsyncComponent(() => import('./ChartDiputadosProvincia.vue')),
  ChartDiputadosProvinciaBloque: defineAsyncComponent(() => import('./ChartDiputadosProvinciaBloque.vue')),
  ChartSenadoresPartido: defineAsyncComponent(() => import('./ChartSenadoresPartido.vue')),
  ChartSenadoresProvincia: defineAsyncComponent(() => import('./ChartSenadoresProvincia.vue')),
  ChartSenadoresProvinciaPartido: defineAsyncComponent(() => import('./ChartSenadoresProvinciaPartido.vue')),
  ChartPlazoFijo: defineAsyncComponent(() => import('./ChartPlazoFijo.vue')),
  ChartCuentasRemuneradasUsd: defineAsyncComponent(
    () => import('./ChartCuentasRemuneradasUsd.vue'),
  ),
  ChartPlazoFijoUvaPagoPeriodico: defineAsyncComponent(
    () => import('./ChartPlazoFijoUvaPagoPeriodico.vue'),
  ),
  ChartFeriadosCalendario: defineAsyncComponent(() => import('./ChartFeriadosCalendario.vue')),
  ChartSenadoActasVotos: defineAsyncComponent(() => import('./ChartSenadoActasVotos.vue')),
  ChartSenadoActasResultado: defineAsyncComponent(() => import('./ChartSenadoActasResultado.vue')),
  ChartSenadoActasArbol: defineAsyncComponent(() => import('./ChartSenadoActasArbol.vue')),
  ChartSenadoActasPresentismo: defineAsyncComponent(() => import('./ChartSenadoActasPresentismo.vue')),
  ChartDiputadosActasVotos: defineAsyncComponent(() => import('./ChartDiputadosActasVotos.vue')),
  ChartDiputadosActasResultado: defineAsyncComponent(() => import('./ChartDiputadosActasResultado.vue')),
  ChartDiputadosActasArbol: defineAsyncComponent(() => import('./ChartDiputadosActasArbol.vue')),
  ChartDiputadosActasPresentismo: defineAsyncComponent(() => import('./ChartDiputadosActasPresentismo.vue')),
  ChartPresidentes: defineAsyncComponent(() => import('./ChartPresidentes.vue')),
  ChartRems: defineAsyncComponent(() => import('./ChartRems.vue')),
  ChartRemIpc: defineAsyncComponent(() => import('./ChartRemIpc.vue')),
  ChartRemDashboard: defineAsyncComponent(() => import('./ChartRemDashboard.vue')),

  FeriadosSection: defineAsyncComponent(() => import('./FeriadosSection.vue')),
}

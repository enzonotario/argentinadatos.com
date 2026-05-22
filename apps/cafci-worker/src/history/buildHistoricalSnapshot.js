import { buildFundSlug } from '../utils/buildFundSlug.js'
import {
  inferHistoryCategoryKey,
  inferHistoryCategoryLabel,
} from './historyCategories.js'

function roundMetric(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }

  return Number(value.toFixed(6))
}

function normalizeAum(value) {
  return typeof value === 'number' && value > 0 ? value : null
}

export function buildHistoricalSnapshot(input, context = {}) {
  const slug =
    input.slug ||
    buildFundSlug({
      nombre: input.nombre,
      fondoId: input.fondoId || 'unknown',
      claseId: input.claseId || 'unknown',
    })

  const valorCuotaparte =
    typeof input.valorCuotaparte === 'number' &&
    !Number.isNaN(input.valorCuotaparte)
      ? input.valorCuotaparte
      : null
  const patrimonio = normalizeAum(input.patrimonio)
  const primerValorCuotaparte =
    context.firstSnapshot?.valorCuotaparte ?? valorCuotaparte ?? null
  const valorCuotaparteAnterior =
    context.previousSnapshot?.valorCuotaparte ?? null
  const patrimonioAnterior = context.previousSnapshot?.patrimonio ?? null

  const retornoDiario =
    valorCuotaparte !== null &&
    valorCuotaparteAnterior &&
    valorCuotaparteAnterior !== 0
      ? roundMetric(
          ((valorCuotaparte - valorCuotaparteAnterior) /
            valorCuotaparteAnterior) *
            100,
        )
      : null

  const retornoAcumulado =
    valorCuotaparte !== null &&
    primerValorCuotaparte &&
    primerValorCuotaparte !== 0
      ? roundMetric(
          ((valorCuotaparte - primerValorCuotaparte) / primerValorCuotaparte) *
            100,
        )
      : valorCuotaparte !== null
        ? 0
        : null

  const flujoEstimado =
    patrimonio !== null && patrimonioAnterior !== null && retornoDiario !== null
      ? roundMetric(patrimonio - patrimonioAnterior * (1 + retornoDiario / 100))
      : null

  const categoriaKey =
    input.categoriaKey || inferHistoryCategoryKey(input.categoria) || null
  const categoria =
    input.categoria || inferHistoryCategoryLabel(categoriaKey) || null

  return {
    slug,
    fondoId: input.fondoId ?? null,
    claseId: input.claseId ?? null,
    nombre: input.nombre,
    fecha: input.fecha,
    categoriaKey,
    categoria,
    horizonte: input.horizonte ?? null,
    valorCuotaparte,
    patrimonio,
    retornoDiario,
    retornoAcumulado,
    flujoEstimado,
    origen: input.origen,
    fuenteOriginal: input.fuenteOriginal ?? null,
  }
}

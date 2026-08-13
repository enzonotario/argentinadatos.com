import { mapHorizonteSerie } from './seriesCategories.js'

function derivarCcp(vcp, patrimonio, cantidadCuotapartes) {
  if (cantidadCuotapartes != null) {
    return cantidadCuotapartes
  }

  if (
    typeof vcp === 'number' &&
    vcp !== 0 &&
    typeof patrimonio === 'number'
  ) {
    return patrimonio / vcp
  }

  return null
}

/**
 * Adapta un fondo del snapshot SQLite al contrato de /v1/finanzas/fci/{serie}.
 */
export function mapFondoToSerieItem(fondo) {
  const vcp = fondo.rendimientos?.valorCuotaparte ?? null
  const patrimonio = fondo.patrimonio ?? null

  return {
    fondo: fondo.nombre,
    horizonte: mapHorizonteSerie(fondo.horizonte),
    fecha: fondo.fecha ?? null,
    vcp,
    ccp: derivarCcp(vcp, patrimonio, fondo.cantidadCuotapartes),
    patrimonio,
  }
}

/**
 * Adapta un snapshot histórico al mismo contrato de series.
 */
export function mapHistoricoToSerieItem(snapshot) {
  const vcp = snapshot.valorCuotaparte ?? null
  const patrimonio = snapshot.patrimonio ?? null

  return {
    fondo: snapshot.nombre,
    horizonte: mapHorizonteSerie(snapshot.horizonte),
    fecha: snapshot.fecha ?? null,
    vcp,
    ccp: derivarCcp(vcp, patrimonio, snapshot.cantidadCuotapartes),
    patrimonio,
  }
}

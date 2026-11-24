import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import type { RecintoAsiento, RecintoPayload } from './scrapeRecinto.ts'
import { claveApellidoNombre, fold } from './scrapeNominaFotos.ts'

/**
 * Historial de bancas del recinto (`/v1/diputados/recinto/historial`).
 *
 * El recinto web de la HCDN solo muestra el estado actual. Cada scrape que
 * cambia el mapa banca → persona agrega un snapshot; si no cambió, solo se
 * extiende `hasta`. Así se puede saber dónde se sentaba cada diputado en el
 * momento de una votación, aunque después se haya ido o lo hayan reemplazado.
 */

export const RECINTO_HISTORIAL_ENDPOINT = 'diputados/recinto/historial'
export const RECINTO_ENDPOINT = 'diputados/recinto'

/**
 * Un acta se asigna al snapshot más cercano si la distancia al intervalo
 * `[desde, hasta]` es menor o igual a esto. Cubre el caso normal: el crawl
 * levanta el recinto y las actas de los últimos días en la misma corrida.
 */
export const TOLERANCIA_SNAPSHOT_DIAS = 7
const TOLERANCIA_SNAPSHOT_MS = TOLERANCIA_SNAPSHOT_DIAS * 24 * 60 * 60 * 1000

export interface RecintoSnapshotAsiento {
  banca: number
  diputadoId: string | null
  apellido: string
  nombre: string
  distrito: string
  bloque: string | null
}

export interface RecintoSnapshot {
  /** Primer scrape (ISO) en el que se observó este mapa de bancas. */
  desde: string
  /** Último scrape (ISO) en el que se observó este mismo mapa. */
  hasta: string
  asientos: RecintoSnapshotAsiento[]
  /** Bancas sin ocupante en este snapshot (p. ej. 223). */
  vacantes: number[]
}

function toSnapshotAsiento(a: RecintoAsiento): RecintoSnapshotAsiento {
  return {
    banca: a.banca,
    diputadoId: a.diputadoId ?? null,
    apellido: a.apellido,
    nombre: a.nombre,
    distrito: a.distrito,
    bloque: a.bloque ?? null,
  }
}

export function snapshotFromPayload(payload: RecintoPayload): RecintoSnapshot {
  return {
    desde: payload.scrapedAt,
    hasta: payload.scrapedAt,
    asientos: payload.asientos.map(toSnapshotAsiento),
    vacantes: [...payload.vacantes],
  }
}

/**
 * Firma del mapa banca → persona. Ignora bloque y metadatos para que un cambio
 * de bloque no genere un snapshot nuevo: solo cuenta quién se sienta dónde.
 */
export function recintoSignature(asientos: readonly RecintoSnapshotAsiento[]): string {
  return asientos
    .map(a => `${a.banca}:${a.diputadoId || `${a.apellido}|${a.nombre}`}`)
    .sort()
    .join(';')
}

function sameMap(last: RecintoSnapshot, next: RecintoSnapshot): boolean {
  return recintoSignature(last.asientos) === recintoSignature(next.asientos)
}

/**
 * Agrega el scrape al historial (sin mutar). Si el mapa de bancas es igual al
 * del último snapshot, solo extiende `hasta` y refresca bloques / ids.
 */
export function appendRecintoSnapshot(
  historial: readonly RecintoSnapshot[],
  payload: RecintoPayload,
): RecintoSnapshot[] {
  const next = snapshotFromPayload(payload)
  const last = historial[historial.length - 1]
  if (!last) return [next]

  if (sameMap(last, next)) {
    const hasta = Date.parse(next.hasta) > Date.parse(last.hasta) ? next.hasta : last.hasta
    return [...historial.slice(0, -1), { ...next, desde: last.desde, hasta }]
  }
  return [...historial, next]
}

/**
 * Lee el historial guardado. Si todavía no existe, lo inicializa con el
 * `/v1/diputados/recinto` ya publicado (la foto previa al primer scrape con historial).
 */
export function readRecintoHistorial(): RecintoSnapshot[] {
  const raw = readEndpoint(RECINTO_HISTORIAL_ENDPOINT)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length) return parsed as RecintoSnapshot[]
    }
    catch {
      // historial corrupto: se reconstruye desde el recinto publicado
    }
  }

  const previo = readEndpoint(RECINTO_ENDPOINT)
  if (!previo) return []
  try {
    const payload = JSON.parse(previo) as RecintoPayload
    if (Array.isArray(payload?.asientos) && payload.scrapedAt) {
      return [snapshotFromPayload(payload)]
    }
  }
  catch {
    // sin foto previa utilizable
  }
  return []
}

export function writeRecintoHistorial(historial: readonly RecintoSnapshot[]): string {
  return writeEndpoint(RECINTO_HISTORIAL_ENDPOINT, historial, { compact: true })
}

/** Snapshot que mejor representa a `fecha`, o `null` si ninguno está a menos de la tolerancia. */
export function findSnapshotForFecha(
  historial: readonly RecintoSnapshot[],
  fecha: Date | string,
  toleranciaMs = TOLERANCIA_SNAPSHOT_MS,
): RecintoSnapshot | null {
  const t = fecha instanceof Date ? fecha.getTime() : Date.parse(fecha)
  if (!Number.isFinite(t)) return null

  let best: RecintoSnapshot | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const snapshot of historial) {
    const desde = Date.parse(snapshot.desde)
    const hasta = Date.parse(snapshot.hasta)
    if (!Number.isFinite(desde) || !Number.isFinite(hasta)) continue
    const distance = t < desde ? desde - t : t > hasta ? t - hasta : 0
    if (distance < bestDistance) {
      best = snapshot
      bestDistance = distance
    }
  }
  return best && bestDistance <= toleranciaMs ? best : null
}

/**
 * Resolver nombre-en-acta ("Apellido, Nombre") → banca de un snapshot.
 * Ignora la banca 0 (podio) y las claves ambiguas (dos personas con el mismo
 * apellido + primer nombre).
 */
export function createBancaResolver(
  snapshot: RecintoSnapshot,
): (nombreVoto: string) => number | null {
  const corta = new Map<string, number | null>()
  const completa = new Map<string, number | null>()
  const indexar = (map: Map<string, number | null>, clave: string | null, banca: number) => {
    if (clave) map.set(clave, map.has(clave) ? null : banca)
  }

  for (const a of snapshot.asientos) {
    if (a.banca <= 0) continue
    const nombre = `${a.apellido}, ${a.nombre}`
    indexar(corta, claveApellidoNombre(nombre), a.banca)
    indexar(completa, claveApellidoCompleto(nombre), a.banca)
  }

  return (nombreVoto) => {
    const clave = claveApellidoNombre(nombreVoto)
    if (!clave) return null
    // Apellidos compuestos ("De Sensi" / "De la Rosa") colisionan en la clave corta.
    return corta.get(clave) ?? completa.get(claveApellidoCompleto(nombreVoto) || '') ?? null
  }
}

/** Apellido completo + primer nombre (desempata apellidos compuestos). */
function claveApellidoCompleto(nombre: string): string | null {
  const [apellido, ...resto] = fold(nombre).split(',')
  const primerNombre = resto.join(',').trim().split(/\s+/)[0]
  const apellidoCompleto = apellido?.trim().replace(/\s+/g, ' ')
  return apellidoCompleto && primerNombre ? `${apellidoCompleto}|${primerNombre}` : null
}

interface ActaConBancas {
  fecha: Date
  votos: Array<{ diputado: string, banca?: number | null }>
}

/**
 * Completa `voto.banca` en las actas que todavía no la tienen, usando el
 * snapshot del recinto vigente en la fecha del acta. No pisa valores existentes
 * (la banca guardada es la que vale aunque hoy el recinto sea otro).
 * Devuelve cuántas actas se completaron.
 */
export function asignarBancasHistoricas<T extends ActaConBancas>(
  actas: readonly T[],
  historial: readonly RecintoSnapshot[],
): number {
  if (!historial.length) return 0

  const resolvers = new Map<RecintoSnapshot, ReturnType<typeof createBancaResolver>>()
  let completadas = 0

  for (const acta of actas) {
    if (!(acta.fecha instanceof Date) || !Array.isArray(acta.votos)) continue
    if (acta.votos.some(v => typeof v.banca === 'number')) continue

    const snapshot = findSnapshotForFecha(historial, acta.fecha)
    if (!snapshot) continue

    let resolve = resolvers.get(snapshot)
    if (!resolve) {
      resolve = createBancaResolver(snapshot)
      resolvers.set(snapshot, resolve)
    }

    let matched = 0
    for (const voto of acta.votos) {
      const banca = resolve(voto.diputado)
      if (banca != null) {
        voto.banca = banca
        matched++
      }
    }
    if (matched) completadas++
  }

  return completadas
}

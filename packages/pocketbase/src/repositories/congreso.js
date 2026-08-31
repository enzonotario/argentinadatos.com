import { andFilters, eq } from '../filter.js'
import { listAllRecords, upsertByFilter } from '../records.js'

function sanitizeNumber(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return num
}

function parseJsonField(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export class DiputadosRepository {
  constructor(pb) {
    this.pb = pb
  }

  async upsertDiputado(diputado, timestamp) {
    const periodoMandatoInicio = diputado.periodoMandato?.inicio || null
    if (!diputado.id || !periodoMandatoInicio) {
      throw new Error('diputado.id y periodoMandato.inicio son requeridos')
    }

    await upsertByFilter(
      this.pb,
      'diputados',
      andFilters(
        eq('diputadoId', String(diputado.id)),
        eq('periodoMandatoInicio', periodoMandatoInicio),
      ),
      {
        diputadoId: String(diputado.id),
        nombre: diputado.nombre,
        apellido: diputado.apellido || null,
        genero: diputado.genero || null,
        provincia: diputado.provincia || null,
        periodoMandatoInicio,
        periodoMandatoFin: diputado.periodoMandato?.fin || null,
        juramentoFecha: diputado.juramentoFecha || null,
        ceseFecha: diputado.ceseFecha || null,
        bloque: diputado.bloque || null,
        periodoBloqueInicio: diputado.periodoBloque?.inicio || null,
        periodoBloqueFin: diputado.periodoBloque?.fin || null,
        foto: diputado.foto || null,
        data: diputado,
        timestamp,
      },
    )
  }

  async insertDiputado(diputado, timestamp) {
    await this.upsertDiputado(diputado, timestamp)
  }

  async insertBatchDiputados(items) {
    for (const item of items) {
      await this.upsertDiputado(item.diputado, item.timestamp)
    }
  }

  async getAllDiputados() {
    const rows = await listAllRecords(this.pb, 'diputados', {
      sort: 'diputadoId,periodoMandatoInicio',
    })
    return rows.map(row => parseJsonField(row.data, row.data))
  }
}

export class DiputadosActasRepository {
  constructor(pb) {
    this.pb = pb
  }

  async upsertActa(acta, anio, timestamp) {
    const safeAnio = sanitizeNumber(anio)
    const safeActaId = sanitizeNumber(acta.id)
    if (safeAnio == null) throw new Error(`Invalid año value: ${anio}`)
    if (safeActaId == null) throw new Error(`Invalid actaId value: ${acta.id}`)

    const fecha =
      acta.fecha instanceof Date
        ? acta.fecha.toISOString()
        : acta.fecha || null

    await upsertByFilter(
      this.pb,
      'diputados_actas',
      andFilters(eq('actaId', safeActaId), eq('anio', safeAnio)),
      {
        actaId: safeActaId,
        anio: safeAnio,
        periodo: acta.periodo || null,
        reunion: acta.reunion || null,
        numeroActa: acta.numeroActa || null,
        titulo: acta.titulo || null,
        resultado: acta.resultado || null,
        fecha,
        presidente: acta.presidente || null,
        votosAfirmativos: sanitizeNumber(acta.votosAfirmativos),
        votosNegativos: sanitizeNumber(acta.votosNegativos),
        abstenciones: sanitizeNumber(acta.abstenciones),
        ausentes: sanitizeNumber(acta.ausentes),
        data: acta,
        timestamp,
      },
    )
  }

  async insertActa(acta, anio, timestamp) {
    await this.upsertActa(acta, anio, timestamp)
  }

  async insertBatchActas(items) {
    for (const item of items) {
      await this.upsertActa(item.acta, item.año ?? item.anio, item.timestamp)
    }
  }

  async getActasByAño(anio) {
    const safeAnio = sanitizeNumber(anio)
    if (safeAnio == null) return []
    const rows = await listAllRecords(this.pb, 'diputados_actas', {
      filter: eq('anio', safeAnio),
      sort: 'fecha',
    })
    return rows.map(row => {
      const acta = parseJsonField(row.data, {})
      return {
        ...acta,
        fecha: acta.fecha ? new Date(acta.fecha) : acta.fecha,
      }
    })
  }

  async getAllActas() {
    const rows = await listAllRecords(this.pb, 'diputados_actas', {
      sort: 'fecha',
    })
    return rows.map(row => {
      const acta = parseJsonField(row.data, {})
      return {
        ...acta,
        fecha: acta.fecha ? new Date(acta.fecha) : acta.fecha,
      }
    })
  }
}

export class SenadoresRepository {
  constructor(pb) {
    this.pb = pb
  }

  async upsertSenador(senador, timestamp) {
    const senadorId = sanitizeNumber(senador.id)
    const periodoLegalInicio = senador.periodoLegal?.inicio || null
    if (senadorId == null || !periodoLegalInicio) {
      throw new Error('senador.id y periodoLegal.inicio son requeridos')
    }

    await upsertByFilter(
      this.pb,
      'senadores',
      andFilters(
        eq('senadorId', senadorId),
        eq('periodoLegalInicio', periodoLegalInicio),
      ),
      {
        senadorId,
        nombre: senador.nombre,
        provincia: senador.provincia || null,
        partido: senador.partido || null,
        periodoLegalInicio,
        periodoLegalFin: senador.periodoLegal?.fin || null,
        periodoRealInicio: senador.periodoReal?.inicio || null,
        periodoRealFin: senador.periodoReal?.fin || null,
        reemplazo: senador.reemplazo || null,
        observaciones: senador.observaciones || null,
        foto: senador.foto || null,
        email: senador.email || null,
        telefono: senador.telefono || null,
        redes: senador.redes ? JSON.stringify(senador.redes) : null,
        data: senador,
        timestamp,
      },
    )
  }

  async insertSenador(senador, timestamp) {
    await this.upsertSenador(senador, timestamp)
  }

  async insertBatchSenadores(items) {
    for (const item of items) {
      await this.upsertSenador(item.senador, item.timestamp)
    }
  }

  async getAllSenadores() {
    const rows = await listAllRecords(this.pb, 'senadores', {
      sort: 'nombre',
    })
    return rows.map(row => parseJsonField(row.data, row.data))
  }
}

export class SenadoActasRepository {
  constructor(pb) {
    this.pb = pb
  }

  async upsertActa(actaId, anio, data, timestamp) {
    const safeActaId = sanitizeNumber(actaId)
    const safeAnio = sanitizeNumber(anio)
    if (safeActaId == null) throw new Error(`Invalid actaId value: ${actaId}`)
    if (safeAnio == null) throw new Error(`Invalid año value: ${anio}`)

    await upsertByFilter(
      this.pb,
      'senado_actas',
      andFilters(eq('actaId', safeActaId), eq('anio', safeAnio)),
      {
        actaId: safeActaId,
        anio: safeAnio,
        titulo: data.titulo || null,
        fecha: data.fecha || null,
        votosAfirmativos: sanitizeNumber(data.votosAfirmativos),
        votosNegativos: sanitizeNumber(data.votosNegativos),
        abstenciones: sanitizeNumber(data.abstenciones),
        ausentes: sanitizeNumber(data.ausentes),
        presidente: data.presidente || null,
        data,
        timestamp,
      },
    )
  }

  async insertActa(actaId, anio, data, timestamp) {
    await this.upsertActa(actaId, anio, data, timestamp)
  }

  async insertBatchActas(items) {
    for (const item of items) {
      await this.upsertActa(
        item.actaId,
        item.año ?? item.anio,
        item.data,
        item.timestamp,
      )
    }
  }

  async getActasByAño(anio) {
    const safeAnio = sanitizeNumber(anio)
    if (safeAnio == null) return []
    const rows = await listAllRecords(this.pb, 'senado_actas', {
      filter: eq('anio', safeAnio),
      sort: 'actaId',
    })
    return rows.map(row => parseJsonField(row.data, row.data))
  }

  async getAllActas() {
    const rows = await listAllRecords(this.pb, 'senado_actas', {
      sort: '-anio,actaId',
    })
    return rows.map(row => parseJsonField(row.data, row.data))
  }
}

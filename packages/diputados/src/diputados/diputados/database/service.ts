import type { Diputado } from '../crawlDiputados.ts'
import { createClient } from '@libsql/client'
import { MigrationRunner } from './migrations/migration-runner.ts'

export class DiputadosDatabaseService {
  private db: any
  private migrationRunner: MigrationRunner

  constructor(url: string, authToken: string) {
    this.db = createClient({
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(this.db)
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async insertDiputado(diputado: Diputado, timestamp: string) {
    await this.db.execute({
      sql: `
        INSERT OR REPLACE INTO diputados (diputadoId, nombre, apellido, genero, provincia, periodoMandatoInicio, periodoMandatoFin, juramentoFecha, ceseFecha, bloque, periodoBloqueInicio, periodoBloqueFin, foto, data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        diputado.id,
        diputado.nombre,
        diputado.apellido || null,
        diputado.genero || null,
        diputado.provincia || null,
        diputado.periodoMandato.inicio || null,
        diputado.periodoMandato.fin || null,
        diputado.juramentoFecha || null,
        diputado.ceseFecha || null,
        diputado.bloque || null,
        diputado.periodoBloque.inicio || null,
        diputado.periodoBloque.fin || null,
        diputado.foto || null,
        JSON.stringify(diputado),
        timestamp,
      ],
    })
  }

  async insertBatchDiputados(items: Array<{ diputado: Diputado, timestamp: string }>) {
    if (items.length === 0) {
      return
    }

    const CHUNK_SIZE = 100
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE)
      const statements = chunk.map(item => ({
        sql: `
        INSERT OR REPLACE INTO diputados (diputadoId, nombre, apellido, genero, provincia, periodoMandatoInicio, periodoMandatoFin, juramentoFecha, ceseFecha, bloque, periodoBloqueInicio, periodoBloqueFin, foto, data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        args: [
          item.diputado.id,
          item.diputado.nombre,
          item.diputado.apellido || null,
          item.diputado.genero || null,
          item.diputado.provincia || null,
          item.diputado.periodoMandato.inicio || null,
          item.diputado.periodoMandato.fin || null,
          item.diputado.juramentoFecha || null,
          item.diputado.ceseFecha || null,
          item.diputado.bloque || null,
          item.diputado.periodoBloque.inicio || null,
          item.diputado.periodoBloque.fin || null,
          item.diputado.foto || null,
          JSON.stringify(item.diputado),
          item.timestamp,
        ],
      }))

      await this.db.batch(statements)
    }
  }

  async getAllDiputados() {
    const result = await this.db.execute({
      sql: `
        SELECT data
        FROM diputados
        ORDER BY id ASC, periodoMandatoInicio ASC
      `,
    })
    return result.rows.map((row: any) => JSON.parse(row.data))
  }

  close() {
    this.db.close()
  }
}

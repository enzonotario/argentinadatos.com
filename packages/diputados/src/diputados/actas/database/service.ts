import type { Acta } from '../crawlActas.ts'
import {
  DiputadosActasRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class ActasDatabaseService {
  private pb: ReturnType<typeof createPocketBaseClient>
  private repo: DiputadosActasRepository

  constructor(url?: string, authToken?: string) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new DiputadosActasRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertActa(acta: Acta, año: number, timestamp: string) {
    await this.repo.insertActa(acta, año, timestamp)
  }

  async insertBatchActas(
    items: Array<{ acta: Acta, año: number, timestamp: string }>,
  ) {
    await this.repo.insertBatchActas(items)
  }

  async getActasByAño(año: number) {
    return this.repo.getActasByAño(año) as Promise<Acta[]>
  }

  async getAllActas() {
    return this.repo.getAllActas() as Promise<Acta[]>
  }

  close() {}
}

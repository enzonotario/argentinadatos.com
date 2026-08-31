import {
  SenadoActasRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class ActasDatabaseService {
  private pb: ReturnType<typeof createPocketBaseClient>
  private repo: SenadoActasRepository

  constructor(url?: string, authToken?: string) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new SenadoActasRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertActa(actaId: number, año: number, data: any, timestamp: string) {
    await this.repo.insertActa(actaId, año, data, timestamp)
  }

  async insertBatchActas(
    items: Array<{
      actaId: number
      año: number
      data: any
      timestamp: string
    }>,
  ) {
    await this.repo.insertBatchActas(items)
  }

  async getActasByAño(año: number) {
    return this.repo.getActasByAño(año)
  }

  async getAllActas() {
    return this.repo.getAllActas()
  }

  close() {}
}

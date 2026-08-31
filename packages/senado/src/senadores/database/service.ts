import type { Senador } from '../crawlSenadores.ts'
import {
  SenadoresRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class SenadoresDatabaseService {
  private pb: ReturnType<typeof createPocketBaseClient>
  private repo: SenadoresRepository

  constructor(url?: string, authToken?: string) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new SenadoresRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertSenador(senador: Senador, timestamp: string) {
    await this.repo.insertSenador(senador, timestamp)
  }

  async insertBatchSenadores(
    items: Array<{ senador: Senador, timestamp: string }>,
  ) {
    await this.repo.insertBatchSenadores(items)
  }

  async getAllSenadores() {
    return this.repo.getAllSenadores() as Promise<Senador[]>
  }

  close() {}
}

import type { Diputado } from '../crawlDiputados.ts'
import {
  DiputadosRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class DiputadosDatabaseService {
  private pb: ReturnType<typeof createPocketBaseClient>
  private repo: DiputadosRepository

  constructor(url?: string, authToken?: string) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new DiputadosRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertDiputado(diputado: Diputado, timestamp: string) {
    await this.repo.insertDiputado(diputado, timestamp)
  }

  async insertBatchDiputados(
    items: Array<{ diputado: Diputado, timestamp: string }>,
  ) {
    await this.repo.insertBatchDiputados(items)
  }

  async getAllDiputados() {
    return this.repo.getAllDiputados() as Promise<Diputado[]>
  }

  close() {}
}

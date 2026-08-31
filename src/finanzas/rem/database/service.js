import {
  RemRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class RemDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new RemRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async deleteAllExpectativas() {
    return this.repo.deleteAllExpectativas()
  }

  async deleteInforme(informe) {
    return this.repo.deleteInforme(informe)
  }

  async upsertExpectativa(item) {
    return this.repo.upsertExpectativa(item)
  }

  async getAllExpectativas() {
    return this.repo.getAllExpectativas()
  }

  async getLatestExpectativas() {
    return this.repo.getLatestExpectativas()
  }

  close() {}
}

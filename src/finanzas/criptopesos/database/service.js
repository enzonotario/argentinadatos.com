import {
  CriptopesosRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class CriptopesosDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new CriptopesosRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertCriptopeso(token, entidad, tna, timestamp) {
    return this.repo.insertCriptopeso(token, entidad, tna, timestamp)
  }

  async getLatestCriptopesoByEntity(token, entidad) {
    return this.repo.getLatestCriptopesoByEntity(token, entidad)
  }

  async getAllLatestCriptopesos() {
    return this.repo.getAllLatestCriptopesos()
  }

  close() {}
}

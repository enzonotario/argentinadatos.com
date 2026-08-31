import {
  CuentasRemuneradasUsdRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class CuentasRemuneradasUsdDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new CuentasRemuneradasUsdRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertCuentaRemuneradaUsd(entidad, tasa, tope, timestamp) {
    return this.repo.insertCuentaRemuneradaUsd(entidad, tasa, tope, timestamp)
  }

  async getLatestCuentaRemuneradaByEntity(entidad) {
    return this.repo.getLatestCuentaRemuneradaByEntity(entidad)
  }

  async getAllLatestCuentasRemuneradasUsd() {
    return this.repo.getAllLatestCuentasRemuneradasUsd()
  }

  close() {}
}

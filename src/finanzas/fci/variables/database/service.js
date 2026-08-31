import {
  FciVariablesRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class FciVariablesDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new FciVariablesRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertFciVariables(
    nombre,
    fondo,
    tipo,
    tna,
    tea,
    tope,
    fecha,
    condiciones,
    condicionesCorto,
    timestamp,
  ) {
    return this.repo.insertFciVariables(
      nombre,
      fondo,
      tipo,
      tna,
      tea,
      tope,
      fecha,
      condiciones,
      condicionesCorto,
      timestamp,
    )
  }

  async getLatestFciVariablesByNombre(nombre) {
    return this.repo.getLatestFciVariablesByNombre(nombre)
  }

  async getAllLatestFciVariables() {
    return this.repo.getAllLatestFciVariables()
  }

  async getPenultimoFciVariables() {
    return this.repo.getPenultimoFciVariables()
  }

  async getHistorialPorNombre(nombre) {
    return this.repo.getHistorialPorNombre(nombre)
  }

  async getAllNombres() {
    return this.repo.getAllNombres()
  }

  close() {}
}

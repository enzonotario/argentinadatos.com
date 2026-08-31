import {
  FciOtrosRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class FciOtrosDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new FciOtrosRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async insertFciOtros(
    fondo,
    tna,
    tea,
    tope,
    fecha,
    condiciones,
    condicionesCorto,
    plazoMinDias,
    plazoMaxDias,
    timestamp,
  ) {
    return this.repo.insertFciOtros(
      fondo,
      tna,
      tea,
      tope,
      fecha,
      condiciones,
      condicionesCorto,
      plazoMinDias,
      plazoMaxDias,
      timestamp,
    )
  }

  async getLatestFciOtrosByFondo(fondo) {
    return this.repo.getLatestFciOtrosByFondo(fondo)
  }

  async getAllLatestFciOtros() {
    return this.repo.getAllLatestFciOtros()
  }

  async getFciOtrosByFecha(fecha) {
    return this.repo.getFciOtrosByFecha(fecha)
  }

  async getPenultimoFciOtros() {
    return this.repo.getPenultimoFciOtros()
  }

  async getHistorialPorFondo(fondo) {
    return this.repo.getHistorialPorFondo(fondo)
  }

  async getAllFondos() {
    return this.repo.getAllFondos()
  }

  close() {}
}

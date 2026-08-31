import {
  LetrasRepository,
  createPocketBaseClient,
  runMigrations,
} from '@argentinadatos/pocketbase'

export class LetrasDatabaseService {
  constructor(url, authToken) {
    this.pb = createPocketBaseClient(url, authToken)
    this.repo = new LetrasRepository(this.pb)
  }

  async initialize() {
    await runMigrations(this.pb)
  }

  async upsertLetra(ticker, fechaEmision, fechaVencimiento, tem, vpv) {
    return this.repo.upsertLetra(
      ticker,
      fechaEmision,
      fechaVencimiento,
      tem,
      vpv,
    )
  }

  async getAllLetras() {
    return this.repo.getAllLetras()
  }

  async deleteLetrasExcept(tickers) {
    return this.repo.deleteLetrasExcept(tickers)
  }

  close() {
    // PocketBase HTTP/memory client no mantiene conexión persistente
  }
}

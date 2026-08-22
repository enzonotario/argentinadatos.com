import axios from 'axios'
import { getPocketBaseConfig } from '../config.js'

export function createPocketBaseClient(config = getPocketBaseConfig()) {
  const http = axios.create({
    baseURL: `${config.url}/api`,
    headers: {
      Authorization: config.token,
      'Content-Type': 'application/json',
    },
    timeout: 60_000,
  })

  return {
    url: config.url,
    async getCollection(name) {
      const { data } = await http.get(`/collections/${name}`)
      return data
    },
    async createCollection(body) {
      const { data } = await http.post('/collections', body)
      return data
    },
    async updateCollection(name, body) {
      const { data } = await http.patch(`/collections/${name}`, body)
      return data
    },
    async truncateCollection(name) {
      await http.delete(`/collections/${name}/truncate`)
    },
    async createRecord(collection, body) {
      const { data } = await http.post(`/collections/${collection}/records`, body)
      return data
    },
    async listRecords(
      collection,
      { page = 1, perPage = 500, sort = '', filter = '' } = {},
    ) {
      const params = { page, perPage }
      if (sort) params.sort = sort
      if (filter) params.filter = filter
      const { data } = await http.get(`/collections/${collection}/records`, {
        params,
      })
      return data
    },
  }
}

import axios from 'axios'
import { getPocketBaseConfig, shouldUseMemoryBackend } from './config.js'
import { createMemoryPocketBaseClient } from './memoryClient.js'

export function createHttpPocketBaseClient(config = getPocketBaseConfig()) {
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
    kind: 'http',
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
    async deleteCollection(name) {
      await http.delete(`/collections/${name}`)
    },
    async truncateCollection(name) {
      await http.delete(`/collections/${name}/truncate`)
    },
    async createRecord(collection, body) {
      const { data } = await http.post(
        `/collections/${collection}/records`,
        body,
      )
      return data
    },
    async updateRecord(collection, id, body) {
      const { data } = await http.patch(
        `/collections/${collection}/records/${id}`,
        body,
      )
      return data
    },
    async deleteRecord(collection, id) {
      await http.delete(`/collections/${collection}/records/${id}`)
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

/**
 * @param {string} [url]
 * @param {string} [authToken]
 */
export function createPocketBaseClient(url, authToken) {
  if (shouldUseMemoryBackend(url)) {
    return createMemoryPocketBaseClient({ scope: url })
  }

  if (
    typeof url === 'string' &&
    authToken &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('libsql') &&
    !url.includes('turso.io')
  ) {
    return createHttpPocketBaseClient({
      url: url.replace(/\/+$/, ''),
      token: authToken,
    })
  }

  return createHttpPocketBaseClient(getPocketBaseConfig())
}

import fs from 'node:fs'
import path from 'node:path'
import { DATOS_PATH } from '../constants.ts'

export function writeEndpoint(endpoint: string, data: any): string {
  const filePath = path.join(DATOS_PATH, ...endpoint.split('/'), 'index.json')
  const jsonData = JSON.stringify(data)

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, jsonData, 'utf-8')

  return filePath
}

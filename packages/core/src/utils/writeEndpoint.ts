import fs from 'node:fs'
import path from 'node:path'
import { DATOS_PATH } from '../constants.ts'

export interface WriteEndpointOptions {
  /** Indentación. `0` o `undefined` con `compact: true` → una línea. Default: `2` (pretty). */
  space?: number
  /** Si true, escribe `JSON.stringify(data)` + `\n` (sin pretty-print). */
  compact?: boolean
}

export function writeEndpoint(
  endpoint: string,
  data: any,
  options: WriteEndpointOptions = {},
): string {
  const filePath = path.join(DATOS_PATH, ...endpoint.split('/'), 'index.json')
  const jsonData = options.compact || options.space === 0
    ? `${JSON.stringify(data)}\n`
    : JSON.stringify(data, null, options.space ?? 2)

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, jsonData, 'utf-8')

  return filePath
}

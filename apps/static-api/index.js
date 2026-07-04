import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStaticServer } from './server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = process.env.STATIC_DIR ?? join(__dirname, '../../datos')
const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT ?? '3000', 10)

startStaticServer(STATIC_DIR, HTTP_PORT)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, rootDir, ''),
    ...loadEnv(mode, process.cwd(), ''),
  }

  return {
    test: {
      env,
    },
  }
})

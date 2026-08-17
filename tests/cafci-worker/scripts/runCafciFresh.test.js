import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseFreshArgs,
  resetSqliteFiles,
} from '../../../apps/cafci-worker/src/runCafciFresh.js'

describe('runCafciFresh helpers', () => {
  it('parsea flags de fresh', () => {
    expect(
      parseFreshArgs([
        '--from',
        '2020-01-02',
        '--to',
        '2026-08-14',
        '--delay-ms',
        '250',
        '--upload',
        '--keep-db',
      ]),
    ).toEqual({
      fromDate: '2020-01-02',
      toDate: '2026-08-14',
      delayMs: 250,
      upload: true,
      keepDb: true,
    })
  })

  it('borra sqlite y sus archivos WAL', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cafci-fresh-'))
    const databasePath = join(directory, 'db.sqlite')
    writeFileSync(databasePath, 'x')
    writeFileSync(`${databasePath}-wal`, 'x')
    writeFileSync(`${databasePath}-shm`, 'x')

    resetSqliteFiles(databasePath)

    expect(existsSync(databasePath)).toBe(false)
    expect(existsSync(`${databasePath}-wal`)).toBe(false)
    expect(existsSync(`${databasePath}-shm`)).toBe(false)
  })
})

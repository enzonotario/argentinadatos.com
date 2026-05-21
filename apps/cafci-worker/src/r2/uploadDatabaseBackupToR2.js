import { PutObjectCommand } from '@aws-sdk/client-s3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getR2Config, isR2BackupConfigured } from '../config.js'
import { createR2Client } from './r2Client.js'

export async function uploadDatabaseBackupToR2(repository) {
  if (!isR2BackupConfigured()) {
    return false
  }

  const client = createR2Client()
  const config = getR2Config()
  const tempDirectory = mkdtempSync(join(tmpdir(), 'cafci-worker-'))
  const snapshotPath = join(tempDirectory, 'db.sqlite')

  try {
    repository.exportDatabaseSnapshot(snapshotPath)

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: config.objectKey,
        Body: readFileSync(snapshotPath),
        ContentType: 'application/vnd.sqlite3',
        Metadata: {
          source: 'cafci-worker',
          uploadedAt: new Date().toISOString(),
        },
      }),
    )

    console.log('[cafci-worker] SQLite uploaded to R2', {
      bucket: config.bucket,
      objectKey: config.objectKey,
    })

    return true
  } finally {
    rmSync(tempDirectory, {
      recursive: true,
      force: true,
    })
  }
}

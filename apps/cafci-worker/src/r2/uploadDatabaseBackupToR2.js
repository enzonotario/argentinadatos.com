import { PutObjectCommand } from '@aws-sdk/client-s3'
import { gzipSync } from 'node:zlib'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getR2Config, isR2BackupConfigured } from '../config.js'
import { createR2Client } from './r2Client.js'

export async function uploadFileToR2({
  filePath,
  objectKey = getR2Config().objectKey,
  metadata = {},
}) {
  if (!isR2BackupConfigured()) {
    return false
  }

  const client = createR2Client()
  const config = getR2Config()

  const compressed = gzipSync(readFileSync(filePath))

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: compressed,
      ContentType: 'application/vnd.sqlite3',
      ContentEncoding: 'gzip',
      Metadata: {
        source: 'cafci-worker',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    }),
  )

  console.log('[cafci-worker] SQLite uploaded to R2', {
    bucket: config.bucket,
    objectKey,
  })

  return true
}

export async function uploadDatabaseBackupToR2(repository) {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'cafci-worker-'))
  const snapshotPath = join(tempDirectory, 'db.sqlite')

  try {
    repository.exportDatabaseSnapshot(snapshotPath)
    return await uploadFileToR2({
      filePath: snapshotPath,
    })
  } finally {
    rmSync(tempDirectory, {
      recursive: true,
      force: true,
    })
  }
}

import { Upload } from '@aws-sdk/lib-storage'
import { createReadStream, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createGzip } from 'node:zlib'
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

  const upload = new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: objectKey,
      Body: createReadStream(filePath).pipe(createGzip()),
      ContentType: 'application/vnd.sqlite3',
      ContentEncoding: 'gzip',
      Metadata: {
        source: 'cafci-worker',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    },
    queueSize: 1,
    partSize: 10 * 1024 * 1024,
  })

  await upload.done()

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

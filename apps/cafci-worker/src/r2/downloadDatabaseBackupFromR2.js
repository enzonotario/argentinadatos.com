import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import {
  getDatabasePath,
  getR2Config,
  isR2BackupConfigured,
} from '../config.js'
import { createR2Client } from './r2Client.js'

export async function downloadDatabaseBackupFromR2({
  destinationPath = getDatabasePath(),
  objectKey = getR2Config().objectKey,
  failIfMissing = false,
} = {}) {
  if (!isR2BackupConfigured()) {
    console.log('[cafci-worker] R2 backup not configured, skipping download')
    return false
  }

  const client = createR2Client()
  const config = getR2Config()

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      }),
    )

    const body = response.Body

    if (!body) {
      throw new Error('R2 response body is empty')
    }

    mkdirSync(dirname(destinationPath), {
      recursive: true,
    })

    const tempDirectory = mkdtempSync(join(tmpdir(), 'cafci-worker-download-'))
    const tempPath = join(tempDirectory, 'db.sqlite')

    try {
      const source =
        response.ContentEncoding === 'gzip' ? body.pipe(createGunzip()) : body

      await pipeline(source, createWriteStream(tempPath))
      renameSync(tempPath, destinationPath)
    } finally {
      rmSync(tempDirectory, {
        recursive: true,
        force: true,
      })
    }

    console.log('[cafci-worker] SQLite downloaded from R2', {
      destinationPath,
      bucket: config.bucket,
      objectKey,
      contentEncoding: response.ContentEncoding || 'identity',
    })

    return {
      destinationPath,
      bucket: config.bucket,
      objectKey,
      lastModified: response.LastModified?.toISOString?.() ?? null,
      uploadedAt: response.Metadata?.uploadedat ?? null,
      contentEncoding: response.ContentEncoding || null,
    }
  } catch (error) {
    if (
      error?.name === 'NoSuchKey' ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      if (failIfMissing) {
        throw new Error(`R2 object not found: ${config.bucket}/${objectKey}`)
      }

      console.warn('[cafci-worker] R2 backup not found, skipping download', {
        bucket: config.bucket,
        objectKey,
      })
      return false
    }

    throw error
  }
}

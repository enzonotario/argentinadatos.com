import { GetObjectCommand } from '@aws-sdk/client-s3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
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

    const body = await response.Body?.transformToByteArray()

    if (!body) {
      throw new Error('R2 response body is empty')
    }

    mkdirSync(dirname(destinationPath), {
      recursive: true,
    })

    writeFileSync(destinationPath, Buffer.from(body))
    console.log('[cafci-worker] SQLite downloaded from R2', {
      destinationPath,
      bucket: config.bucket,
      objectKey,
    })

    return true
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

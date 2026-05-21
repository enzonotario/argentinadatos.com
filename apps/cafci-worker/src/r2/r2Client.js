import { S3Client } from '@aws-sdk/client-s3'
import { getR2Config, isR2BackupConfigured } from '../config.js'

export function createR2Client() {
  if (!isR2BackupConfigured()) {
    return null
  }

  const config = getR2Config()

  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

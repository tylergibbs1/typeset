import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface Storage {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
  del(key: string): Promise<void>
}

/** Local filesystem storage for development */
export function createLocalStorage(dir: string, baseUrl: string): Storage {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  fs.mkdirSync(dir, { recursive: true })

  return {
    async put(key, data) {
      const filePath = path.join(dir, key)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, data)
    },
    async getSignedUrl(key) {
      return `${baseUrl}/files/${key}`
    },
    async del(key) {
      const filePath = path.join(dir, key)
      try { fs.unlinkSync(filePath) } catch {}
    },
  }
}

export function createStorage(opts: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}): Storage {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  })

  return {
    async put(key, data, contentType) {
      await s3.send(new PutObjectCommand({
        Bucket: opts.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }))
    },

    async getSignedUrl(key, expiresIn = 3600) {
      const command = new GetObjectCommand({ Bucket: opts.bucket, Key: key })
      return s3GetSignedUrl(s3, command, { expiresIn })
    },

    async del(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: opts.bucket, Key: key }))
    },
  }
}

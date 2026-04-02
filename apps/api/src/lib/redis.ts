import { Redis as UpstashRedis } from '@upstash/redis'

export interface Redis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts?: { ex?: number }): Promise<void>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  del(key: string): Promise<void>
}

export function createRedis(url: string, token: string): Redis {
  const client = new UpstashRedis({ url, token })

  return {
    async get(key) {
      return client.get<string>(key)
    },
    async set(key, value, opts) {
      if (opts?.ex) {
        await client.set(key, value, { ex: opts.ex })
      } else {
        await client.set(key, value)
      }
    },
    async incr(key) {
      return client.incr(key)
    },
    async expire(key, seconds) {
      await client.expire(key, seconds)
    },
    async del(key) {
      await client.del(key)
    },
  }
}

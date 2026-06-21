import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'Server/prisma/schema.prisma',
  migrations: {
    path: 'Server/prisma/migrations'
  },
  datasource: {
    url: env('DATABASE_URL')
  }
})
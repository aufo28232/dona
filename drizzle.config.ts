import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` só lê o schema e não conecta em nada, então não dá
// para exigir DATABASE_URL aqui. Os comandos que realmente conectam (push,
// migrate, studio) falham sozinhos com o placeholder.
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL não definida — só `drizzle-kit generate` vai funcionar.')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://sem-database-url/' },
  strict: true,
  verbose: true,
})

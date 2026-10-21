import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import openapiTS, { astToString } from 'openapi-typescript'

// Import the application directly so CI needs neither a running server nor DB.
const python = process.env.API_PYTHON ?? '../backend/.venv/Scripts/python.exe'
const schema = JSON.parse(execFileSync(python, ['-c',
  'import json; from src.main import app; print(json.dumps(app.openapi()))'], {
  cwd: '../backend',
  env: { ...process.env, APP_ENV: 'test', POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test',
    POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DB_NAME: 'test', JWT_SECRET: 'test-secret' },
  encoding: 'utf8',
}))
await writeFile('openapi.json', JSON.stringify(schema, null, 2) + '\n')
await writeFile('src/api/generated.ts', astToString(await openapiTS(schema, { defaultNonNullable: false })))

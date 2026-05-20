import { MigrationRunner } from './migration-runner.js'
import {
  crearClienteLibsql,
  resolverConexionLibsql,
} from '../../../../utils/libsql.js'

const COMMANDS = {
  up: 'Ejecutar migraciones pendientes',
  down: 'Revertir última migración',
  status: 'Mostrar estado de las migraciones',
}

function printUsage() {
  console.log('Uso: node cli.js <comando> [url] [authToken]')
  console.log('')
  console.log('Comandos disponibles:')
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(10)} - ${desc}`)
  }

  console.log('')
  console.log('Ejemplos:')
  console.log('  node cli.js up')
  console.log('  node cli.js status')
  console.log('  node cli.js down')
}

export async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    printUsage()
    process.exit(1)
  }

  const command = args[0]
  const url = args[1]
  const authToken = args[2]

  if (!Object.keys(COMMANDS).includes(command)) {
    console.error(`Comando desconocido: ${command}`)
    printUsage()
    process.exit(1)
  }

  const conexion = resolverConexionLibsql({
    scope: 'criptopesos',
    url,
    authToken,
  })

  const db = crearClienteLibsql({
    scope: 'criptopesos',
    url,
    authToken,
  })

  try {
    console.log(`Conectando a base de datos: ${conexion.url}`)

    const migrationRunner = new MigrationRunner(db)

    switch (command) {
      case 'up':
        console.log('Ejecutando migraciones pendientes...')
        await migrationRunner.runPendingMigrations()
        break

      case 'down':
        console.log('Revirtiendo última migración...')
        await migrationRunner.rollbackLastMigration()
        break

      case 'status':
        const status = await migrationRunner.getMigrationStatus()
        console.log('Estado de las migraciones:')
        console.log(`  Ejecutadas: [${status.executed.join(', ')}]`)
        console.log(`  Pendientes: [${status.pending.join(', ')}]`)
        break
    }

    console.log('Operación completada exitosamente')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    db.close()
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] ? process.argv[1] : []).includes('cli.js')
) {
  main().catch(console.error)
}

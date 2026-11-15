// Backs up a SQLite database using Node's built-in SQLite. Used by backup_database.sh on Pods
// whose Python cannot open SQLite databases.
//
// Usage: node backup_database.mjs SOURCE_DB DESTINATION_DB
//
// Like sqlite_maintenance.py's backup: pending writes are folded in first, the database is
// checked, and the previous backup is only replaced once the new one is complete.
import { renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [sourcePath, destinationPath] = process.argv.slice(2);
if (!sourcePath || !destinationPath) {
  console.error('Usage: node backup_database.mjs SOURCE_DB DESTINATION_DB');
  process.exit(2);
}

const temporaryPath = `${destinationPath}.partial`;
const database = new DatabaseSync(sourcePath);
try {
  database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const findings = database.prepare('PRAGMA integrity_check').all();
  if (findings.length !== 1 || findings[0].integrity_check !== 'ok') {
    throw new Error(`Database integrity check failed: ${JSON.stringify(findings.slice(0, 5))}`);
  }
  rmSync(temporaryPath, { force: true });
  // VACUUM INTO writes a complete, compact copy. Quotes in the path are doubled for SQL.
  database.exec(`VACUUM INTO '${temporaryPath.replaceAll("'", "''")}'`);
} catch (error) {
  rmSync(temporaryPath, { force: true });
  throw error;
} finally {
  database.close();
}
renameSync(temporaryPath, destinationPath);
console.log(`Database backed up to ${destinationPath}`);

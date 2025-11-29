const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  console.log('✓ Migrations table ready');
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

async function executeMigration(filename, sql) {
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    await pool.query('COMMIT');
    console.log(`✓ Executed: ${filename}`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function runMigrations() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║        DATABASE MIGRATION SYSTEM           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Create migrations table if it doesn't exist
    await createMigrationsTable();

    // Get list of executed migrations
    const executed = await getExecutedMigrations();
    console.log(`Already executed: ${executed.length} migrations\n`);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Execute pending migrations
    let executedCount = 0;
    for (const file of sqlFiles) {
      if (!executed.includes(file)) {
        const filepath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filepath, 'utf-8');
        await executeMigration(file, sql);
        executedCount++;
      }
    }

    if (executedCount === 0) {
      console.log('✓ No new migrations to execute');
    } else {
      console.log(`\n✓ Successfully executed ${executedCount} new migration(s)`);
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║           MIGRATION COMPLETE               ║');
    console.log('╚════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

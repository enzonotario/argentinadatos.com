export default {
  id: '001InitialSchema',
  up: [
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        scope TEXT NOT NULL,
        migration_id TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (scope, migration_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS fund_detail_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fund_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        execution_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        error TEXT,
        payload TEXT,
        fetched_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (fund_id, class_id, execution_date)
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_fund_detail_jobs_execution_status
      ON fund_detail_jobs (execution_date, status, next_attempt_at)
    `,
    `
      CREATE TABLE IF NOT EXISTS current_fund_details (
        fund_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        payload TEXT NOT NULL,
        source_date TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (fund_id, class_id)
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_current_fund_details_name
      ON current_fund_details (name)
    `,
  ],
}

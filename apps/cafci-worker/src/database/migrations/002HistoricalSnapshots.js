export default {
  id: '002HistoricalSnapshots',
  up: [
    `
      CREATE TABLE IF NOT EXISTS historical_fund_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        fund_id TEXT,
        class_id TEXT,
        name TEXT NOT NULL,
        source_date TEXT NOT NULL,
        category_key TEXT,
        category_label TEXT,
        horizon TEXT,
        share_value REAL,
        assets_under_management REAL,
        daily_return REAL,
        cumulative_return REAL,
        estimated_net_flow REAL,
        source_kind TEXT NOT NULL,
        raw_source TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (slug, source_date)
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_historical_fund_snapshots_slug_date
      ON historical_fund_snapshots (slug, source_date)
    `,
  ],
}

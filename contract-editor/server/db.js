// D1 資料表。新部署第一次收到請求時建立；之後新增的欄位以 ALTER TABLE 補上（已存在則略過）。

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT, created_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, handoff TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL, label TEXT, name TEXT, last_seen INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS participants_contract ON participants(contract_id)`,
  `CREATE TABLE IF NOT EXISTS clauses (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, ord REAL NOT NULL, title TEXT NOT NULL, html TEXT NOT NULL, removed INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 1, updated_by TEXT, updated_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS clauses_contract ON clauses(contract_id)`,
  `CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, clause_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, by_id TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL, round INTEGER NOT NULL, reviewed_by TEXT, reviewed_at INTEGER, note TEXT)`,
  `CREATE INDEX IF NOT EXISTS revisions_contract ON revisions(contract_id, at)`
];
let ready = false;
export async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // Added after first release: procurement case number (案號).
  for (const sql of ["ALTER TABLE contracts ADD COLUMN case_no TEXT", "ALTER TABLE participants ADD COLUMN side TEXT",
    "ALTER TABLE participants ADD COLUMN title TEXT", "ALTER TABLE participants ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0"]) {
    try { await db.prepare(sql).run(); } catch { /* column already there */ }
  }
  ready = true;
}

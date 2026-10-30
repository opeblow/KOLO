import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "kolo-core",
      sql: `CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  contribution_minor BIGINT NOT NULL CHECK (contribution_minor > 0),
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
  start_date TEXT NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 2 CHECK (grace_days BETWEEN 0 AND 30),
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  public_token TEXT NOT NULL UNIQUE,
  head_seq INTEGER NOT NULL DEFAULT 0,
  head_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS circle_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS circle_members (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  name TEXT NOT NULL,
  phone TEXT,
  aliases TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL,
  member_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  seq INTEGER NOT NULL CHECK (seq >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('circle.opened', 'contribution', 'payout', 'swap', 'reversal', 'circle.closed')),
  payload TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  recorded_via TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  UNIQUE (circle_id, seq)
);
CREATE TABLE IF NOT EXISTS payment_signals (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  raw_text TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  reference TEXT,
  direction TEXT NOT NULL,
  amount_minor BIGINT,
  currency TEXT,
  sender_name TEXT,
  occurred_on TEXT,
  extracted_by TEXT NOT NULL CHECK (extracted_by IN ('parser', 'agent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  proposed_member_id TEXT,
  proposal TEXT NOT NULL DEFAULT '{}',
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ledger_seqs TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  resolved_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  UNIQUE (circle_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS nudges (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  member_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'copy')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS circles_owner_org_updated_idx ON circles (owner_email, org_id, updated_at);
CREATE INDEX IF NOT EXISTS circle_shares_resource_idx ON circle_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS circle_members_circle_idx ON circle_members (circle_id, position);
CREATE INDEX IF NOT EXISTS payment_signals_circle_status_idx ON payment_signals (circle_id, status, created_at);
CREATE INDEX IF NOT EXISTS payment_signals_circle_reference_idx ON payment_signals (circle_id, reference);
CREATE INDEX IF NOT EXISTS nudges_circle_member_idx ON nudges (circle_id, member_id, created_at)`,
    },
    {
      version: 2,
      name: "kolo-ledger-append-only",
      // Function bodies contain semicolons, so they run as single statements
      // here instead of through the migration splitter. Idempotent by design.
      sql: {},
      run: async (exec) => {
        await exec.execute(`CREATE OR REPLACE FUNCTION kolo_ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: record a reversal instead of editing entry %', OLD.seq;
END;
$$ LANGUAGE plpgsql`);
        await exec.execute(
          `DROP TRIGGER IF EXISTS ledger_entries_append_only ON ledger_entries`,
        );
        await exec.execute(`CREATE TRIGGER ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION kolo_ledger_append_only()`);
      },
    },
  ],
  { table: "kolo_migrations" },
);

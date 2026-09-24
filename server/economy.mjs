import { DatabaseSync } from 'node:sqlite';
import {
  newProfile,
  refreshProfile,
  recordMatch,
  purchase,
  equipCosmetic,
  claimChallenge,
} from '../.server-build/progression.js';
/** Server-only adapter. No endpoint accepts client match receipts or balance grants. */
export class EconomyStore {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, earned INTEGER NOT NULL DEFAULT 0 CHECK(earned>=0), paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0), state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(account_id TEXT NOT NULL REFERENCES profiles(id), event_id TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('earned','paid')), reason TEXT NOT NULL, PRIMARY KEY(account_id,event_id));
      CREATE TABLE IF NOT EXISTS payment_receipts(provider TEXT NOT NULL, receipt_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES profiles(id), status TEXT NOT NULL CHECK(status IN ('pending','verified','refunded')), PRIMARY KEY(provider,receipt_id));`);
  }
  create(id, now = Date.now()) {
    const profile = newProfile(now);
    profile.balance = 0;
    profile.ledger = [];
    this.db
      .prepare('INSERT OR IGNORE INTO profiles(id,state) VALUES(?,?)')
      .run(id, JSON.stringify(profile));
    return this.read(id);
  }
  read(id) {
    const row = this.db
      .prepare('SELECT state FROM profiles WHERE id=?')
      .get(id);
    if (!row) throw new Error('Unknown account');
    return JSON.parse(row.state);
  }
  mutate(id, fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const next = fn(refreshProfile(this.read(id)));
      this.db
        .prepare('UPDATE profiles SET earned=?,state=? WHERE id=?')
        .run(next.balance, JSON.stringify(next), id);
      const insert = this.db.prepare(
        "INSERT OR IGNORE INTO ledger(account_id,event_id,amount,currency,reason) VALUES(?,?,?,'earned',?)",
      );
      for (const event of next.ledger)
        insert.run(id, event.id, event.amount, event.reason);
      this.db.exec('COMMIT');
      return next;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  settleAuthoritativeMatch(id, receipt, now = Date.now()) {
    return this.mutate(id, (p) => recordMatch(p, receipt, now));
  }
  buy(id, item) {
    return this.mutate(id, (p) => purchase(p, item));
  }
  equip(id, item) {
    return this.mutate(id, (p) => equipCosmetic(p, item));
  }
  claim(id, challenge, now = Date.now()) {
    return this.mutate(id, (p) => claimChallenge(p, challenge, now));
  }
  grantPaid() {
    throw new Error(
      'Cash purchases are disabled; verified payment integration is not implemented',
    );
  }
  close() {
    this.db.close();
  }
}

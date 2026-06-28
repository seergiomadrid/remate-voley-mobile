/**
 * Persistencia local con expo-sqlite. Tablas alineadas con docs/database-schema.dbml.
 * Las métricas normalizadas (sessions, reps, rep_sensor_metrics) permiten
 * consultas de histórico; `session_blobs` guarda el payload del dashboard.
 */
import * as SQLite from "expo-sqlite";
import type { AnalyzeResult } from "@core";
import { buildSessionPayload, type SessionPayload } from "@/analysis/persist";

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbp) dbp = SQLite.openDatabaseAsync("rematevoley.db").then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS athletes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dominant_hand TEXT,
        height_cm REAL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        athlete_id INTEGER,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        clock_offset_ms REAL,
        sync_confidence REAL,
        rep_count INTEGER DEFAULT 0,
        arm_peak_best_dps REAL,
        arm_peak_mean_dps REAL,
        arm_consistency_cv_pct REAL,
        jump_best_cm REAL,
        sequencing_ok_pct REAL,
        sequencing_mean_lag_ms REAL,
        fatigue_drop_pct REAL,
        session_load REAL,
        quality_index REAL
      );
      CREATE TABLE IF NOT EXISTS reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        rep_index INTEGER NOT NULL,
        time_ms REAL NOT NULL,
        contact_time_ms REAL,
        contact_acc_g REAL,
        peak_to_contact_ms REAL,
        sequencing_lag_ms REAL,
        sequencing_ok INTEGER,
        flight_time_s REAL,
        jump_height_cm REAL,
        takeoff_acc_g REAL,
        landing_acc_g REAL
      );
      CREATE TABLE IF NOT EXISTS rep_sensor_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rep_id INTEGER NOT NULL,
        sensor TEXT NOT NULL,
        peak_gyro_dps REAL,
        peak_gyro_saturated INTEGER,
        peak_acc_g REAL,
        peak_acc_saturated INTEGER,
        time_to_peak_ms REAL,
        peak_width_ms REAL,
        shape TEXT
      );
      CREATE TABLE IF NOT EXISTS session_blobs (
        session_id INTEGER PRIMARY KEY,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    return db;
  });
  return dbp;
}

export interface SessionSummary {
  id: number;
  startedAt: number;
  repCount: number;
  qualityIndex: number;
  armPeakBestDps: number;
  sequencingOkPct: number;
  sessionLoad: number;
}

export async function saveSession(result: AnalyzeResult, startedAtMs: number, endedAtMs: number): Promise<number> {
  const db = await getDb();
  const payload = buildSessionPayload(result, startedAtMs);
  const a = result.aggregates;

  const res = await db.runAsync(
    `INSERT INTO sessions (started_at, ended_at, clock_offset_ms, sync_confidence, rep_count,
       arm_peak_best_dps, arm_peak_mean_dps, arm_consistency_cv_pct, jump_best_cm,
       sequencing_ok_pct, sequencing_mean_lag_ms, fatigue_drop_pct, session_load, quality_index)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      startedAtMs, endedAtMs, payload.clockOffsetMs, payload.syncConfidence, a.repCount,
      a.armPeakBestDps, a.armPeakMeanDps, a.armConsistencyCvPct, a.jumpBestCm,
      a.sequencingOkPct, a.sequencingMeanLagMs, a.fatigueDropPct, a.load, a.qualityIndex,
    ],
  );
  const sessionId = res.lastInsertRowId;

  for (const r of result.reps) {
    const rr = await db.runAsync(
      `INSERT INTO reps (session_id, rep_index, time_ms, contact_time_ms, contact_acc_g,
         peak_to_contact_ms, sequencing_lag_ms, sequencing_ok, flight_time_s, jump_height_cm,
         takeoff_acc_g, landing_acc_g) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sessionId, r.index, r.timeMs, r.contact.contactTimeMs, r.contact.contactAccG,
        r.contact.peakToContactMs, r.sequencingLagMs, r.sequencingOk ? 1 : 0,
        r.jump.flightTimeS, r.jump.jumpHeightCm, r.jump.takeoffAccG, r.jump.landingAccG,
      ],
    );
    const repId = rr.lastInsertRowId;
    const sensors: ("arm" | "torso")[] = r.torso ? ["arm", "torso"] : ["arm"];
    for (const key of sensors) {
      const m = key === "arm" ? r.arm : r.torso!;
      await db.runAsync(
        `INSERT INTO rep_sensor_metrics (rep_id, sensor, peak_gyro_dps, peak_gyro_saturated,
           peak_acc_g, peak_acc_saturated, time_to_peak_ms, peak_width_ms, shape)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [repId, key.toUpperCase(), m.peakGyroDps, m.peakGyroSaturated ? 1 : 0, m.peakAccG, m.peakAccSaturated ? 1 : 0, m.timeToPeakMs, m.peakWidthMs, m.shape],
      );
    }
  }

  await db.runAsync(`INSERT OR REPLACE INTO session_blobs (session_id, json) VALUES (?, ?)`, [
    sessionId,
    JSON.stringify(payload),
  ]);

  return sessionId;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT id, started_at, rep_count, quality_index, arm_peak_best_dps, sequencing_ok_pct, session_load
     FROM sessions ORDER BY started_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    repCount: r.rep_count,
    qualityIndex: r.quality_index ?? 0,
    armPeakBestDps: r.arm_peak_best_dps ?? 0,
    sequencingOkPct: r.sequencing_ok_pct ?? 0,
    sessionLoad: r.session_load ?? 0,
  }));
}

export async function getSessionPayload(id: number): Promise<SessionPayload | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>(`SELECT json FROM session_blobs WHERE session_id = ?`, [id]);
  return row ? (JSON.parse(row.json) as SessionPayload) : null;
}

export async function getSessionLoads(): Promise<{ dateMs: number; load: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(`SELECT started_at, session_load FROM sessions ORDER BY started_at ASC`);
  return rows.map((r) => ({ dateMs: r.started_at, load: r.session_load ?? 0 }));
}

export async function getConfig(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_config WHERE key = ?`, [key]);
  return row ? row.value : null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)`, [key, value]);
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM reps WHERE session_id = ?`, [id]);
  await db.runAsync(`DELETE FROM session_blobs WHERE session_id = ?`, [id]);
  await db.runAsync(`DELETE FROM sessions WHERE id = ?`, [id]);
}

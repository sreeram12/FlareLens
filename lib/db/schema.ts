import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  numeric,
  jsonb,
  date,
  integer,
} from 'drizzle-orm/pg-core'

// ─── Log Entries ───────────────────────────────────────────────────────────────
// Stores all health events: bowel movements, symptoms, meals, meds, sleep, exercise
export const logEntries = pgTable('log_entries', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().default('alex'),
  entryType: text('entry_type').notNull(), // 'bowel_movement' | 'symptom' | 'meal' | 'medication' | 'sleep' | 'exercise'
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  rawTranscript: text('raw_transcript'),
  source: text('source').notNull().default('voice'), // 'voice' | 'manual' | 'oura' | 'apple_health' | 'import'
  data: jsonb('data').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Daily Stability Scores ────────────────────────────────────────────────────
export const dailyStabilityScores = pgTable('daily_stability_scores', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().default('alex'),
  scoreDate: date('score_date').notNull(),
  totalScore: numeric('total_score', { precision: 5, scale: 2 }).notNull().default('0'),
  domainScores: jsonb('domain_scores').notNull().default('{}'),
  scoreReasons: text('score_reasons').array().default([]),
  isFlareDayBoolean: boolean('is_flare_day').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Flare Sessions ────────────────────────────────────────────────────────────
export const flareSessions = pgTable('flare_sessions', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().default('alex'),
  triggeredBy: text('triggered_by').notNull().default('user'), // 'user' | 'score'
  triggerScore: numeric('trigger_score', { precision: 5, scale: 2 }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  questionnaireResponses: jsonb('questionnaire_responses').default('{}'),
  reportGenerated: boolean('report_generated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Patient Baselines ─────────────────────────────────────────────────────────
export const patientBaselines = pgTable('patient_baselines', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().default('alex'),
  baselineKey: text('baseline_key').notNull(),
  baselineValue: numeric('baseline_value', { precision: 8, scale: 2 }).notNull(),
  unit: text('unit'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Medications ───────────────────────────────────────────────────────────────
export const medications = pgTable('medications', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().default('alex'),
  medName: text('med_name').notNull(),
  dose: text('dose').notNull(),
  frequency: text('frequency').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Types ─────────────────────────────────────────────────────────────────────
export type LogEntry = typeof logEntries.$inferSelect
export type NewLogEntry = typeof logEntries.$inferInsert
export type DailyStabilityScore = typeof dailyStabilityScores.$inferSelect
export type FlareSession = typeof flareSessions.$inferSelect
export type PatientBaseline = typeof patientBaselines.$inferSelect
export type Medication = typeof medications.$inferSelect

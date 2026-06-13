/**
 * Fasten Connect FHIR parser.
 *
 * Fasten's EHI export is FHIR NDJSON (one resource per line); some sources wrap
 * resources in a Bundle. This module normalizes the resource types FlareLens
 * cares about into flat records the app can store as log entries / medications:
 *
 *   Observation (with a value)  → labs   (CRP, calprotectin, ferritin, etc.)
 *   MedicationRequest/Statement → medications
 *   Condition / Encounter /
 *   Procedure / Allergy / etc.  → clinical history
 *
 * Framework-free so it runs in the import route or a future webhook handler.
 * FHIR is deeply dynamic, so we narrow `unknown` with small typed accessors
 * rather than reaching for `any`.
 */

export type LabKey =
  | 'crp'
  | 'calprotectin'
  | 'ferritin'
  | 'hemoglobin'
  | 'wbc'
  | 'albumin'
  | 'esr'

export interface FastenLab {
  name: string
  code?: string
  value: number
  unit?: string
  observedAt?: string
  /** Canonical key for IBD-relevant labs the scoring/report understand. */
  canonicalKey?: LabKey
}

export interface FastenMedication {
  name: string
  dose?: string
  status?: string
  authoredOn?: string
}

export type ClinicalKind =
  | 'condition'
  | 'encounter'
  | 'procedure'
  | 'allergy'
  | 'diagnostic_report'
  | 'document'

export interface FastenClinical {
  kind: ClinicalKind
  text: string
  date?: string
}

export interface FastenRecords {
  labs: FastenLab[]
  medications: FastenMedication[]
  clinical: FastenClinical[]
  resourceTypes: Record<string, number>
  counts: {
    labs: number
    medications: number
    conditions: number
    encounters: number
    procedures: number
    other: number
    total: number
  }
}

type Obj = Record<string, unknown>

// ── Narrowing helpers (no `any`) ─────────────────────────────────────────────
const asObj = (v: unknown): Obj | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined
const asArr = (v: unknown): unknown[] | undefined => (Array.isArray(v) ? v : undefined)
const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const asNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

/** Map an IBD-relevant lab name to a canonical key the app understands. */
function canonicalLabKey(name: string): LabKey | undefined {
  const n = name.toLowerCase()
  if (n.includes('c-reactive') || /\bcrp\b/.test(n)) return 'crp'
  if (n.includes('calprotectin')) return 'calprotectin'
  if (n.includes('ferritin')) return 'ferritin'
  if (n.includes('hemoglobin') || n.includes('haemoglobin')) return 'hemoglobin'
  if (n.includes('leukocyte') || n.includes('white blood') || /\bwbc\b/.test(n)) return 'wbc'
  if (n.includes('albumin')) return 'albumin'
  if (n.includes('sedimentation') || /\besr\b/.test(n)) return 'esr'
  return undefined
}

/** Pull human-readable text from a CodeableConcept (text → coding display → code). */
function conceptText(concept: unknown): string | undefined {
  const c = asObj(concept)
  if (!c) return undefined
  const text = asStr(c.text)
  if (text) return text
  const coding = asObj(asArr(c.coding)?.[0])
  return asStr(coding?.display) ?? asStr(coding?.code)
}

/** Normalize any FHIR date/dateTime to YYYY-MM-DD. */
function toDate(val: unknown): string | undefined {
  const s = asStr(val)
  if (!s) return undefined
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : undefined
}

/** Iterate resources from NDJSON lines and/or Bundle entries. */
function* iterResources(text: string): Generator<Obj> {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    const o = asObj(parsed)
    if (!o) continue
    if (o.resourceType === 'Bundle') {
      for (const entry of asArr(o.entry) ?? []) {
        const res = asObj(asObj(entry)?.resource)
        if (res && asStr(res.resourceType)) yield res
      }
    } else if (asStr(o.resourceType)) {
      yield o
    }
  }
}

export function parseFhirNdjson(text: string): FastenRecords {
  const labs: FastenLab[] = []
  const medications: FastenMedication[] = []
  const clinical: FastenClinical[] = []
  const resourceTypes: Record<string, number> = {}
  let conditions = 0
  let encounters = 0
  let procedures = 0
  let other = 0

  for (const r of iterResources(text)) {
    const type = asStr(r.resourceType) ?? 'Unknown'
    resourceTypes[type] = (resourceTypes[type] ?? 0) + 1

    switch (type) {
      case 'Observation': {
        const q = asObj(r.valueQuantity)
        const value = asNum(q?.value)
        if (q && value !== undefined) {
          const name = conceptText(r.code) ?? 'Lab'
          labs.push({
            name,
            code: asStr(asObj(asArr(asObj(r.code)?.coding)?.[0])?.code),
            value,
            unit: asStr(q.unit),
            observedAt: toDate(r.effectiveDateTime) ?? toDate(r.issued),
            canonicalKey: canonicalLabKey(name),
          })
        } else {
          other++
        }
        break
      }

      case 'MedicationRequest':
      case 'MedicationStatement': {
        medications.push({
          name: conceptText(r.medicationCodeableConcept) ?? 'Medication',
          status: asStr(r.status),
          authoredOn:
            toDate(r.authoredOn) ?? toDate(r.effectiveDateTime) ?? toDate(asObj(r.effectivePeriod)?.start),
        })
        break
      }

      case 'Condition':
        conditions++
        clinical.push({
          kind: 'condition',
          text: conceptText(r.code) ?? 'Condition',
          date: toDate(r.recordedDate) ?? toDate(r.onsetDateTime),
        })
        break

      case 'Encounter':
        encounters++
        clinical.push({
          kind: 'encounter',
          text:
            conceptText(asArr(r.reasonCode)?.[0]) ??
            conceptText(asArr(r.type)?.[0]) ??
            asStr(asObj(r.class)?.code) ??
            'Encounter',
          date: toDate(asObj(r.period)?.start),
        })
        break

      case 'Procedure':
        procedures++
        clinical.push({
          kind: 'procedure',
          text: conceptText(r.code) ?? 'Procedure',
          date: toDate(r.performedDateTime) ?? toDate(asObj(r.performedPeriod)?.start),
        })
        break

      case 'AllergyIntolerance':
        clinical.push({ kind: 'allergy', text: conceptText(r.code) ?? 'Allergy', date: toDate(r.recordedDate) })
        other++
        break

      case 'DiagnosticReport':
        clinical.push({
          kind: 'diagnostic_report',
          text: conceptText(r.code) ?? 'Diagnostic report',
          date: toDate(r.effectiveDateTime) ?? toDate(r.issued),
        })
        other++
        break

      case 'DocumentReference':
        clinical.push({ kind: 'document', text: conceptText(r.type) ?? 'Document', date: toDate(r.date) })
        other++
        break

      default:
        other++
    }
  }

  return {
    labs,
    medications,
    clinical,
    resourceTypes,
    counts: {
      labs: labs.length,
      medications: medications.length,
      conditions,
      encounters,
      procedures,
      other,
      total: labs.length + medications.length + clinical.length,
    },
  }
}

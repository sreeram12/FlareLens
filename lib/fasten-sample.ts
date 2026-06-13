/**
 * Bundled sample Fasten FHIR NDJSON for demo / no-credentials mode.
 * Inlined (not a public file) so it works in every runtime. Models "Alex":
 * Crohn's, adalimumab, recent inflammatory labs, a GI follow-up, a colonoscopy.
 */
export const SAMPLE_FASTEN_NDJSON = [
  '{"resourceType":"Condition","id":"cond-crohns","clinicalStatus":{"coding":[{"code":"active"}]},"code":{"text":"Crohn\'s disease of small intestine"},"recordedDate":"2021-05-01"}',
  '{"resourceType":"MedicationRequest","id":"med-ada","status":"active","intent":"order","medicationCodeableConcept":{"text":"Adalimumab 40 mg/0.4 mL subcutaneous injection every 14 days"},"authoredOn":"2025-12-10"}',
  '{"resourceType":"MedicationStatement","id":"med-vitd","status":"active","medicationCodeableConcept":{"text":"Vitamin D3 2000 IU daily"},"effectiveDateTime":"2026-01-15"}',
  '{"resourceType":"Observation","id":"obs-crp-1","status":"final","code":{"text":"C-reactive protein","coding":[{"code":"1988-5"}]},"effectiveDateTime":"2026-06-02T09:30:00-07:00","valueQuantity":{"value":12.4,"unit":"mg/L"}}',
  '{"resourceType":"Observation","id":"obs-calprotectin-1","status":"final","code":{"text":"Fecal calprotectin"},"effectiveDateTime":"2026-05-20T09:30:00-07:00","valueQuantity":{"value":280,"unit":"ug/g"}}',
  '{"resourceType":"Observation","id":"obs-ferritin-1","status":"final","code":{"text":"Ferritin"},"effectiveDateTime":"2026-06-02T09:30:00-07:00","valueQuantity":{"value":18,"unit":"ng/mL"}}',
  '{"resourceType":"Observation","id":"obs-hgb-1","status":"final","code":{"text":"Hemoglobin"},"effectiveDateTime":"2026-06-02T09:30:00-07:00","valueQuantity":{"value":12.9,"unit":"g/dL"}}',
  '{"resourceType":"Observation","id":"obs-wbc-1","status":"final","code":{"text":"Leukocytes (WBC)"},"effectiveDateTime":"2026-06-02T09:30:00-07:00","valueQuantity":{"value":8.1,"unit":"10*3/uL"}}',
  '{"resourceType":"Observation","id":"obs-crp-0","status":"final","code":{"text":"C-reactive protein","coding":[{"code":"1988-5"}]},"effectiveDateTime":"2026-03-04T09:30:00-08:00","valueQuantity":{"value":3.1,"unit":"mg/L"}}',
  '{"resourceType":"Encounter","id":"enc-gi-1","status":"finished","class":{"code":"AMB"},"period":{"start":"2026-05-18T14:00:00-07:00"},"reasonCode":[{"text":"GI follow-up for Crohn\'s disease"}]}',
  '{"resourceType":"Procedure","id":"proc-colonoscopy-1","status":"completed","code":{"text":"Colonoscopy"},"performedDateTime":"2025-11-07T10:00:00-08:00"}',
].join('\n')

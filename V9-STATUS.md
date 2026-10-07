# OLP Homework Hub — Exam System v9 Candidate

This is an isolated v9 engineering candidate. It has **not** been deployed to production.

Implemented in this candidate:
- Teacher question editor uses the real `exam_matching_items` schema.
- MCQ/dropdown option editing, correct-answer keys, add/remove/reorder.
- Matching editor with answer-key mapping.
- Short/long/structured mark-scheme fields using `exam_mark_schemes`.
- Teacher add/delete/duplicate/reorder question controls and structured parent/subquestion assignment.
- Student matching supports drag-and-drop plus dropdown fallback.
- Student text answers use debounced autosave with submit-time flush.
- Attempt start handles unique/double-click races.
- Server-authoritative attempt deadline migration (`deadline_at`).
- Controlled `submit_exam_attempt` RPC.
- Secure `exam-visual` Edge Function: client requests by question ID, never by storage path; authorization is checked before server-side signing.
- Existing imported source-PDF visuals have a compatibility fallback to a short-lived signed source PDF page. New imports should ultimately extract per-question visual assets for least exposure.

Validation completed:
- Focused TypeScript/TSX type/syntax check of `Exams.tsx` passed using temporary module shims because npm dependencies are unavailable in this execution environment.
- Obsolete `exam_matching_pairs` references removed from the v9 source.
- Full `npm run build` is still blocked here because the uploaded ZIP did not include `node_modules`/lockfile and npm dependency installation times out in this environment.

Do not deploy this candidate until the database migration and Edge Function deployment order is approved and a real dependency-backed `npm run build` passes.

## Live backend integration validation
- `exam_v9_security` migration has been applied successfully to the live Supabase project.
- `exam-visual` Edge Function v1 is ACTIVE with JWT verification enabled.
- Existing `exam-import` v8 was left unchanged.
- No active in-progress attempt is missing a server deadline.
- Frontend calls `exam-visual` by question ID and `submit_exam_attempt` by attempt ID.
- Timer reads the server-created `deadline_at`; repeated timeout submission is guarded.

Remaining release gate: a genuine dependency-backed `npm run build` must pass. `npm install` is still timing out in this execution environment, so this candidate is not yet approved for frontend deployment. End-to-end browser testing with teacher/student accounts follows after the build passes.

# OLP Homework Hub v10 — Manual Exam Creator

Built from the green v9.1.1 Exams baseline.

## v10 changes
- Replaces the teacher-facing exam importer with `+ Create Exam`.
- Creates manual draft exams directly in the existing exams/exam_questions schema.
- Keeps the existing six question types:
  short answer, long answer, multiple choice, dropdown, matching, structured.
- Keeps diagram upload/paste and secure student diagram viewing.
- Keeps maths symbol insertion.
- Adds editable question tables (insert 2x2, add rows, add columns, remove).
- Student runner renders teacher-created tables.
- Keeps the bottom Marking Key / Answer Key and labels it as the authority for automatic/AI-assisted marking.
- No exam duration is set for newly created manual exams.
- Existing student submission/read-only behaviour is retained.
- The Supabase exam-import function is not deleted; v10 simply disconnects the importer from the teacher UI.

## Validation
- TSX syntax transpilation check: PASS.
- Full dependency build must still be confirmed by the Cloudflare v9-build-test build before any merge to main.

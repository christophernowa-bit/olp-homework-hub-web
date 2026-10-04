import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  FileText,
  ImagePlus,
  Sigma,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCurrentUserRole, type UserRole } from '../lib/userRole'

type ClassRow = {
  id: string
  name: string
  created_by: string
  is_active: boolean
}

type SubjectRow = {
  id: string
  class_id: string
  name: string
}

type ExamRow = {
  id: string
  class_id: string
  subject_id: string | null
  created_by: string
  title: string
  instructions: string | null
  duration_minutes: number | null
  total_marks: number
  status: 'draft' | 'published' | 'closed'
  published_at: string | null
  source_type: 'manual' | 'imported' | 'generated'
  created_at: string
  updated_at: string
}

type ExamAttemptRow = {
  id: string
  exam_id: string
  student_id: string
  status: string
  started_at: string
  submitted_at: string | null
  final_mark: number | null
  returned_at: string | null
  deadline_at: string | null
}

type QuestionType =
  | 'short_answer'
  | 'long_answer'
  | 'multiple_choice'
  | 'dropdown'
  | 'matching'
  | 'structured'

type QuestionRow = {
  id: string
  exam_id: string
  parent_question_id: string | null
  question_number: string
  sort_order: number
  question_type: QuestionType
  question_text: string | null
  marks: number
  required: boolean
  source_ref: string | null
  settings: Record<string, unknown>
}

type OptionRow = {
  id: string
  question_id: string
  option_order: number
  option_key: string
  option_text: string
}

type MatchingItemRow = {
  id: string
  question_id: string
  side: 'left' | 'right'
  item_order: number
  item_key: string
  item_text: string
}

type StudentVisual = { url: string; kind: 'image' | 'source_pdf'; source_page: number }

type MarkSchemeRow = {
  id: string
  question_id: string
  max_marks: number
  expected_answer: string | null
  acceptable_answers: unknown[]
  answer_key: Record<string, unknown>
  marking_points: unknown[]
  rubric: Record<string, unknown>
  ai_instructions: string | null
  source_text: string | null
  created_by: string
}

type ImportStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'generating'
  | 'ready'
  | 'failed'

type ImportRow = {
  id: string
  exam_id: string | null
  class_id: string
  subject_id: string | null
  file_name: string
  status: ImportStatus
  error_message: string | null
  created_at: string
}

const acceptedTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
]

const examMathSymbols = [
  '×', '÷', '±', '−', '=', '≠', '<', '>', '≤', '≥',
  '°', 'π', '√', '²', '³', '½', '¼', '¾', '%', '∞',
  '(', ')', '[', ']', '∠', '⊥', '∥', '≈', '∑',
]

const questionLabels: Record<QuestionType, string> = {
  short_answer: 'Short answer',
  long_answer: 'Long answer',
  multiple_choice: 'Multiple choice',
  dropdown: 'Dropdown',
  matching: 'Matching',
  structured: 'Structured',
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}


function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
    }

    const parts = [
      typeof candidate.message === 'string' ? candidate.message : '',
      typeof candidate.details === 'string' ? candidate.details : '',
      typeof candidate.hint === 'string' ? candidate.hint : '',
      typeof candidate.code === 'string' ? `Code: ${candidate.code}` : '',
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(' · ')
  }

  return fallback
}

export default function Exams() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [exams, setExams] = useState<ExamRow[]>([])
  const [imports, setImports] = useState<ImportRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [showCreator, setShowCreator] = useState(false)
  const [creatorTitle, setCreatorTitle] = useState('')
  const [creatorInstructions, setCreatorInstructions] = useState('')
  const [creatingExam, setCreatingExam] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [titleOverride, setTitleOverride] = useState('')
  const [durationOverride, setDurationOverride] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [reviewExam, setReviewExam] = useState<ExamRow | null>(null)
  const [teacherEditMode, setTeacherEditMode] = useState(false)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [options, setOptions] = useState<OptionRow[]>([])
  const [matchingItems, setMatchingItems] = useState<MatchingItemRow[]>([])
  const [markSchemes, setMarkSchemes] = useState<MarkSchemeRow[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null)
  const [publishingExam, setPublishingExam] = useState(false)
  const [studentAttempts, setStudentAttempts] = useState<ExamAttemptRow[]>([])
  const [studentExamFilter, setStudentExamFilter] = useState<
    'all' | 'available' | 'in_progress' | 'submitted'
  >('all')
  const [studentRunnerExam, setStudentRunnerExam] = useState<ExamRow | null>(null)
  const [studentAttempt, setStudentAttempt] = useState<ExamAttemptRow | null>(null)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({})
  const [studentRunnerLoading, setStudentRunnerLoading] = useState(false)
  const [studentSavingQuestionId, setStudentSavingQuestionId] = useState<string | null>(null)
  const [studentSubmitting, setStudentSubmitting] = useState(false)
  const [studentSecondsLeft, setStudentSecondsLeft] = useState<number | null>(null)
  const [studentVisuals, setStudentVisuals] = useState<Record<string, StudentVisual>>({})
  const [studentVisualErrors, setStudentVisualErrors] = useState<Record<string, string>>({})
  const submitGuardRef = useRef(false)
  const studentTextTimersRef = useRef<Record<string, number>>({})
  const studentPendingTextRef = useRef<Record<string, { question: QuestionRow; text: string }>>({})
  const [sourcePaperUrl, setSourcePaperUrl] = useState('')
  const [sourcePaperMime, setSourcePaperMime] = useState('')
  const [questionDiagramUrls, setQuestionDiagramUrls] = useState<Record<string, string>>({})
  const [diagramBusyId, setDiagramBusyId] = useState<string | null>(null)
  const questionTextRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isTeacher = role === 'teacher' || role === 'platform_owner'

  const navigationSubjects = useMemo(
    () => subjects.filter((subject) => subject.class_id === selectedClassId),
    [subjects, selectedClassId],
  )

  const visibleExams = useMemo(
    () =>
      exams.filter(
        (exam) =>
          exam.class_id === selectedClassId &&
          exam.subject_id === selectedSubjectId,
      ),
    [exams, selectedClassId, selectedSubjectId],
  )

  useEffect(() => {
    void initialise()
  }, [])


  async function loadStudentWorkspace(uid: string) {
    const [examResult, classResult, subjectResult, attemptResult] =
      await Promise.all([
        supabase
          .from('exams')
          .select('*')
          .in('status', ['published', 'closed'])
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id,name,created_by,is_active')
          .order('name'),
        supabase
          .from('class_subjects')
          .select('id,class_id,name')
          .order('name'),
        supabase
          .from('exam_attempts')
          .select('id,exam_id,student_id,status,started_at,submitted_at,final_mark,returned_at,deadline_at')
          .eq('student_id', uid)
          .order('started_at', { ascending: false }),
      ])

    if (examResult.error) throw examResult.error
    if (classResult.error) throw classResult.error
    if (subjectResult.error) throw subjectResult.error
    if (attemptResult.error) throw attemptResult.error

    setExams((examResult.data ?? []) as ExamRow[])
    setClasses((classResult.data ?? []) as ClassRow[])
    setSubjects((subjectResult.data ?? []) as SubjectRow[])
    setStudentAttempts((attemptResult.data ?? []) as ExamAttemptRow[])
  }

  function studentAttemptFor(examId: string) {
    return studentAttempts.find((attempt) => attempt.exam_id === examId) ?? null
  }

  function studentExamState(exam: ExamRow) {
    const attempt = studentAttemptFor(exam.id)
    if (!attempt) {
      if (exam.status === 'closed') return { label: 'Closed', className: 'closed' }
      return { label: 'Available', className: 'published' }
    }
    if (attempt.status === 'in_progress') {
      return { label: 'In progress', className: 'draft' }
    }
    if (attempt.status === 'returned') {
      return { label: 'Returned', className: 'submitted' }
    }
    return { label: 'Submitted', className: 'submitted' }
  }

  function classNameForStudent(classId: string) {
    return classes.find((item) => item.id === classId)?.name ?? 'Class'
  }

  function subjectNameForStudent(subjectId: string | null) {
    if (!subjectId) return 'Whole class'
    return subjects.find((item) => item.id === subjectId)?.name ?? 'Subject'
  }

  const visibleStudentExams = exams.filter((exam) => {
    const attempt = studentAttemptFor(exam.id)
    if (studentExamFilter === 'available') {
      return exam.status === 'published' && !attempt
    }
    if (studentExamFilter === 'in_progress') {
      return attempt?.status === 'in_progress'
    }
    if (studentExamFilter === 'submitted') {
      return Boolean(attempt && attempt.status !== 'in_progress')
    }
    return true
  })

  const studentExamGroups = visibleStudentExams.reduce<Record<string, ExamRow[]>>((groups, exam) => {
    const subject = subjectNameForStudent(exam.subject_id)
    ;(groups[subject] ??= []).push(exam)
    return groups
  }, {})

  async function openStudentRunner(exam: ExamRow, existingAttempt?: ExamAttemptRow | null) {
    try {
      setStudentRunnerLoading(true)
      setError('')
      let attempt = existingAttempt ?? studentAttemptFor(exam.id)

      if (!attempt) {
        const { data, error: attemptError } = await supabase
          .from('exam_attempts')
          .insert({ exam_id: exam.id, student_id: userId, status: 'in_progress' })
          .select('id,exam_id,student_id,status,started_at,submitted_at,final_mark,returned_at,deadline_at')
          .single()
        if (attemptError) {
          if (attemptError.code === '23505') {
            const { data: existing, error: existingError } = await supabase
              .from('exam_attempts')
              .select('id,exam_id,student_id,status,started_at,submitted_at,final_mark,returned_at,deadline_at')
              .eq('exam_id', exam.id)
              .eq('student_id', userId)
              .single()
            if (existingError) throw existingError
            attempt = existing as ExamAttemptRow
          } else {
            throw attemptError
          }
        } else {
          attempt = data as ExamAttemptRow
          setStudentAttempts((current) => [attempt as ExamAttemptRow, ...current])
        }
      }

      const [questionResult, answerResult] = await Promise.all([
        supabase
          .from('exam_questions')
          .select('*')
          .eq('exam_id', exam.id)
          .order('sort_order'),
        supabase
          .from('exam_answers')
          .select('*')
          .eq('attempt_id', attempt.id),
      ])
      if (questionResult.error) throw questionResult.error
      if (answerResult.error) throw answerResult.error

      const loadedQuestions = (questionResult.data ?? []) as QuestionRow[]
      const questionIds = loadedQuestions.map((question) => question.id)
      let loadedOptions: OptionRow[] = []
      let loadedMatchingItems: MatchingItemRow[] = []

      if (questionIds.length > 0) {
        const [optionResult, pairResult] = await Promise.all([
          supabase
            .from('exam_question_options')
            .select('*')
            .in('question_id', questionIds)
            .order('option_order'),
          supabase
            .from('exam_matching_items')
            .select('*')
            .in('question_id', questionIds)
            .order('item_order'),
        ])
        if (optionResult.error) throw optionResult.error
        if (pairResult.error) throw pairResult.error
        loadedOptions = (optionResult.data ?? []) as OptionRow[]
        loadedMatchingItems = (pairResult.data ?? []) as MatchingItemRow[]
      }

      const visualEntries = await Promise.all(
        loadedQuestions.map(async (question) => {
          const needsVisual = Boolean(question.settings?.diagram_path)
          if (!needsVisual) return [question.id, null, ''] as const
          const { data, error: visualError } = await supabase.functions.invoke('exam-visual', {
            body: { question_id: question.id },
          })
          if (visualError || !data?.available || !data?.url) {
            return [question.id, null, 'This visual could not be loaded securely.'] as const
          }
          return [question.id, { url: String(data.url), kind: data.kind === 'source_pdf' ? 'source_pdf' : 'image', source_page: Number(data.source_page ?? 1) } as StudentVisual, ''] as const
        }),
      )
      setStudentVisuals(Object.fromEntries(visualEntries.filter(([, visual]) => Boolean(visual)).map(([id, visual]) => [id, visual as StudentVisual])))
      setStudentVisualErrors(Object.fromEntries(visualEntries.filter(([, , err]) => Boolean(err)).map(([id, , err]) => [id, err])))

      const answerMap: Record<string, any> = {}
      for (const answer of answerResult.data ?? []) {
        answerMap[answer.question_id] = answer
      }

      setQuestions(loadedQuestions)
      setOptions(loadedOptions)
      setMatchingItems(loadedMatchingItems)
      setStudentAnswers(answerMap)
      setStudentAttempt(attempt)
      setStudentRunnerExam(exam)
    } catch (err) {
      setError(errorMessage(err, 'Could not start this exam.'))
    } finally {
      setStudentRunnerLoading(false)
    }
  }

  async function saveStudentAnswer(question: QuestionRow, patch: Record<string, any>) {
    if (!studentAttempt || studentAttempt.status !== 'in_progress') return
    const current = studentAnswers[question.id] ?? {}
    const next = { ...current, ...patch }
    setStudentAnswers((answers) => ({ ...answers, [question.id]: next }))
    try {
      setStudentSavingQuestionId(question.id)
      const payload = {
        attempt_id: studentAttempt.id,
        question_id: question.id,
        answer_text: next.answer_text ?? null,
        answer_json: next.answer_json ?? {},
        selected_option_key: next.selected_option_key ?? null,
        dropdown_value: next.dropdown_value ?? null,
        matching_response: next.matching_response ?? [],
        updated_at: new Date().toISOString(),
      }
      const { data, error: saveError } = await supabase
        .from('exam_answers')
        .upsert(payload, { onConflict: 'attempt_id,question_id' })
        .select('*')
        .single()
      if (saveError) throw saveError
      setStudentAnswers((answers) => ({ ...answers, [question.id]: data }))
    } catch (err) {
      setError(errorMessage(err, `Could not save question ${question.question_number}.`))
    } finally {
      setStudentSavingQuestionId(null)
    }
  }

  function queueStudentTextSave(question: QuestionRow, text: string) {
    setStudentAnswers((current) => ({
      ...current,
      [question.id]: { ...(current[question.id] ?? {}), answer_text: text },
    }))
    studentPendingTextRef.current[question.id] = { question, text }
    const existingTimer = studentTextTimersRef.current[question.id]
    if (existingTimer) window.clearTimeout(existingTimer)
    studentTextTimersRef.current[question.id] = window.setTimeout(() => {
      const pending = studentPendingTextRef.current[question.id]
      delete studentPendingTextRef.current[question.id]
      delete studentTextTimersRef.current[question.id]
      if (pending) void saveStudentAnswer(pending.question, { answer_text: pending.text })
    }, 800)
  }

  async function flushStudentTextSaves(questionId?: string) {
    const ids = questionId ? [questionId] : Object.keys(studentPendingTextRef.current)
    for (const id of ids) {
      const timer = studentTextTimersRef.current[id]
      if (timer) window.clearTimeout(timer)
      delete studentTextTimersRef.current[id]
      const pending = studentPendingTextRef.current[id]
      delete studentPendingTextRef.current[id]
      if (pending) await saveStudentAnswer(pending.question, { answer_text: pending.text })
    }
  }

  function answerIsComplete(question: QuestionRow) {
    const answer = studentAnswers[question.id]
    if (!answer) return false
    if (question.question_type === 'multiple_choice') return Boolean(answer.selected_option_key)
    if (question.question_type === 'dropdown') return Boolean(answer.dropdown_value)
    if (question.question_type === 'matching') {
      return Array.isArray(answer.matching_response) && answer.matching_response.length > 0
    }
    return Boolean(String(answer.answer_text ?? '').trim())
  }

  async function submitStudentExam() {
    if (!studentAttempt || !studentRunnerExam) return
    if (!window.confirm('Submit exam? You will not be able to change your answers afterwards.')) return
    try {
      setStudentSubmitting(true)
      setError('')
      submitGuardRef.current = true
      await flushStudentTextSaves()
      const { data: submittedAttempt, error: submitError } = await supabase
        .rpc('submit_exam_attempt', { p_attempt_id: studentAttempt.id })
      if (submitError) throw submitError
      const submitted = submittedAttempt as ExamAttemptRow
      setStudentAttempt(submitted)
      await loadStudentWorkspace(userId)
      setStudentRunnerExam(null)
      setStudentAttempt(null)
      setQuestions([])
      setOptions([])
      setMatchingItems([])
      setStudentAnswers({})
      setStudentVisuals({})
      setStudentVisualErrors({})
      setMessage('Exam submitted successfully.')
    } catch (err) {
      setError(errorMessage(err, 'Could not submit this exam.'))
    } finally {
      setStudentSubmitting(false)
      submitGuardRef.current = false
    }
  }

  function updateMatchingAnswer(question: QuestionRow, leftKey: string, rightKey: string) {
    const current = studentAnswers[question.id]?.matching_response
    const response = Array.isArray(current) ? [...current] : []
    const filtered = response.filter((item: any) => item?.left_key !== leftKey)
    if (rightKey) filtered.push({ left_key: leftKey, right_key: rightKey })
    void saveStudentAnswer(question, { matching_response: filtered })
  }

  async function initialise() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) throw new Error('You must be signed in.')

      const currentRole = await getCurrentUserRole()
      setRole(currentRole)
      setUserId(user.id)

      if (currentRole === 'student') {
        await loadStudentWorkspace(user.id)
        return
      }

      if (currentRole !== 'teacher' && currentRole !== 'platform_owner') {
        setLoading(false)
        return
      }

      await loadTeacherWorkspace(user.id)
    } catch (err) {
      setError(errorMessage(err, 'Could not load Exams.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadTeacherWorkspace(uid: string) {
    const [classResult, subjectResult, examResult] =
      await Promise.all([
        supabase
          .from('classes')
          .select('id,name,created_by,is_active')
          .eq('created_by', uid)
          .order('name'),
        supabase
          .from('class_subjects')
          .select('id,class_id,name')
          .eq('created_by', uid)
          .order('name'),
        supabase
          .from('exams')
          .select('*')
          .eq('created_by', uid)
          .order('created_at', { ascending: false }),
      ])

    if (classResult.error) throw classResult.error
    if (subjectResult.error) throw subjectResult.error
    if (examResult.error) throw examResult.error

    const loadedClasses = (classResult.data ?? []) as ClassRow[]
    const loadedSubjects = (subjectResult.data ?? []) as SubjectRow[]

    setClasses(loadedClasses)
    setSubjects(loadedSubjects)
    setExams((examResult.data ?? []) as ExamRow[])
    setImports([])

    if (!selectedClassId && loadedClasses.length > 0) {
      const firstClass =
        loadedClasses.find((item) => item.is_active) ?? loadedClasses[0]
      const firstSubject = loadedSubjects.find(
        (subject) => subject.class_id === firstClass.id,
      )
      setSelectedClassId(firstClass.id)
      setSelectedSubjectId(firstSubject?.id ?? '')
    }
  }

  function chooseClass(classId: string) {
    setSelectedClassId(classId)
    const firstSubject = subjects.find((subject) => subject.class_id === classId)
    setSelectedSubjectId(firstSubject?.id ?? '')
  }

  function resetImporter() {
    if (uploading) return
    setFile(null)
    setTitleOverride('')
    setDurationOverride('')
    setProgress('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function importExam() {
    if (!file) return setError('Choose an exam paper first.')
    if (!selectedClassId) return setError('Choose a class.')
    if (!selectedSubjectId) return setError('Choose a subject.')
    if (!acceptedTypes.includes(file.type)) {
      return setError('Use PDF, DOCX, PNG, JPG/JPEG or WEBP.')
    }
    if (file.size > 50 * 1024 * 1024) {
      return setError('The exam paper must be 50 MB or smaller.')
    }

    try {
      setUploading(true)
      setError('')
      setMessage('')
      setProgress('Uploading the source exam paper…')

      const importId = crypto.randomUUID()
      const storagePath = `${userId}/${importId}/${safeFileName(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from('exam-imports')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { error: importRowError } = await supabase
        .from('exam_imports')
        .insert({
          id: importId,
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          uploaded_by: userId,
          file_name: file.name,
          mime_type: file.type,
          storage_path: storagePath,
          status: 'uploaded',
        })

      if (importRowError) {
        await supabase.storage.from('exam-imports').remove([storagePath])
        throw importRowError
      }

      setProgress(
        'Reading the paper and identifying questions, marks, options and structure…',
      )

      const { data, error: functionError } = await supabase.functions.invoke(
        'exam-import',
        {
          body: {
            importId,
            titleOverride: titleOverride.trim() || null,
            durationOverride: durationOverride
              ? Number(durationOverride)
              : null,
          },
        },
      )

      if (functionError) {
        throw new Error(functionError.message)
      }

      if (!data?.ok || !data?.examId) {
        throw new Error(data?.error || 'The exam importer did not finish.')
      }

      setProgress('')
      setMessage(
        `Exam reproduced as a draft: ${data.questionCount} questions, ${data.totalMarks} marks.`,
      )

      setFile(null)
      setTitleOverride('')
      setDurationOverride('')
      if (inputRef.current) inputRef.current.value = ''

      await loadTeacherWorkspace(userId)
      await openExam(data.examId)
    } catch (err) {
      setProgress('')
      setError(errorMessage(err, 'Exam import failed.'))
      await loadTeacherWorkspace(userId).catch(() => undefined)
    } finally {
      setUploading(false)
    }
  }

  async function createManualExam() {
    if (!userId || !selectedClassId || !selectedSubjectId) {
      setError('Choose a class and subject before creating an exam.')
      return
    }
    if (!creatorTitle.trim()) {
      setError('Enter an exam title.')
      return
    }
    try {
      setCreatingExam(true)
      setError('')
      setMessage('')
      const { data: created, error: examError } = await supabase.from('exams').insert({
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        created_by: userId,
        title: creatorTitle.trim(),
        instructions: creatorInstructions.trim() || null,
        duration_minutes: null,
        total_marks: 1,
        status: 'draft',
        source_type: 'manual',
      }).select('*').single()
      if (examError) throw examError
      const { error: questionError } = await supabase.from('exam_questions').insert({
        exam_id: created.id, parent_question_id: null, question_number: '1', sort_order: 1,
        question_type: 'short_answer', question_text: '', marks: 1, required: true,
        settings: {}, content_json: { type: 'doc', version: 1, blocks: [] },
      })
      if (questionError) throw questionError
      setCreatorTitle('')
      setCreatorInstructions('')
      setShowCreator(false)
      await loadTeacherWorkspace(userId)
      await openExam(created.id)
      setTeacherEditMode(true)
      setMessage('Manual exam created. Build the questions, complete the marking key, preview, then publish.')
    } catch (err) {
      setError(errorMessage(err, 'Could not create the exam.'))
    } finally {
      setCreatingExam(false)
    }
  }

  async function openExam(examId: string) {
    try {
      setReviewLoading(true)
      setError('')
      setMessage('')

      const { data: loadedExam, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()

      if (examError) {
        throw new Error(
          `Exam details could not be loaded: ${errorMessage(
            examError,
            'Unknown exam error.',
          )}`,
        )
      }

      // v7: signed source paper used to preserve diagrams/graphs/tables.
      setSourcePaperUrl('')
      setSourcePaperMime('')
      const { data: sourceImport } = await supabase
        .from('exam_imports')
        .select('storage_path,mime_type')
        .eq('exam_id', examId)
        .maybeSingle()

      if (sourceImport?.storage_path) {
        const { data: signedSource } = await supabase.storage
          .from('exam-imports')
          .createSignedUrl(sourceImport.storage_path, 60 * 60)

        if (signedSource?.signedUrl) {
          setSourcePaperUrl(signedSource.signedUrl)
          setSourcePaperMime(sourceImport.mime_type ?? 'application/pdf')
        }
      }

      const { data: questionData, error: questionError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('sort_order')

      if (questionError) {
        throw new Error(
          `Questions could not be loaded: ${errorMessage(
            questionError,
            'Unknown question error.',
          )}`,
        )
      }

      const loadedQuestions = (questionData ?? []) as QuestionRow[]
      const questionIds = loadedQuestions.map((question) => question.id)

      let loadedOptions: OptionRow[] = []
      let loadedMatchingItems: MatchingItemRow[] = []

      if (questionIds.length > 0) {
        const optionQuestionIds = loadedQuestions
          .filter(
            (question) =>
              question.question_type === 'multiple_choice' ||
              question.question_type === 'dropdown',
          )
          .map((question) => question.id)

        const matchingQuestionIds = loadedQuestions
          .filter((question) => question.question_type === 'matching')
          .map((question) => question.id)

        if (optionQuestionIds.length > 0) {
          const { data: optionData, error: optionError } = await supabase
            .from('exam_question_options')
            .select('id,question_id,option_order,option_key,option_text')
            .in('question_id', optionQuestionIds)
            .order('option_order')

          if (optionError) {
            console.error('Could not load exam options:', optionError)
            setMessage(
              `The exam opened, but some extracted options could not be loaded: ${errorMessage(
                optionError,
                'Unknown options error.',
              )}`,
            )
          } else {
            loadedOptions = (optionData ?? []) as OptionRow[]
          }
        }

        if (matchingQuestionIds.length > 0) {
          const { data: pairData, error: pairError } = await supabase
            .from('exam_matching_items')
            .select('id,question_id,side,item_order,item_key,item_text')
            .in('question_id', matchingQuestionIds)
            .order('item_order')

          if (pairError) {
            console.error('Could not load matching pairs:', pairError)
            setMessage(
              `The exam opened, but some matching items could not be loaded: ${errorMessage(
                pairError,
                'Unknown matching error.',
              )}`,
            )
          } else {
            loadedMatchingItems = (pairData ?? []) as MatchingItemRow[]
          }
        }
      }

      const { data: schemeData, error: schemeError } = questionIds.length
        ? await supabase
            .from('exam_mark_schemes')
            .select('*')
            .in('question_id', questionIds)
        : { data: [], error: null }
      if (schemeError) throw schemeError

      setReviewExam(loadedExam as ExamRow)
      setTeacherEditMode(false)
      setQuestions(loadedQuestions)
      setOptions(loadedOptions)
      setMatchingItems(loadedMatchingItems)
      setMarkSchemes((schemeData ?? []) as MarkSchemeRow[])

      const diagramEntries = await Promise.all(
        loadedQuestions.map(async (question) => {
          const path =
            typeof question.settings?.diagram_path === 'string'
              ? question.settings.diagram_path
              : ''
          if (!path) return null
          const { data } = await supabase.storage
            .from('exam-imports')
            .createSignedUrl(path, 60 * 60)
          return data?.signedUrl ? ([question.id, data.signedUrl] as const) : null
        }),
      )
      setQuestionDiagramUrls(
        Object.fromEntries(
          diagramEntries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry),
          ),
        ),
      )
    } catch (err) {
      console.error('Open exam failed:', err)
      setError(errorMessage(err, 'Could not open the exam.'))
    } finally {
      setReviewLoading(false)
    }
  }

  function updateQuestionLocal(
    id: string,
    patch: Partial<QuestionRow>,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    )
  }

  function updateOptionLocal(id: string, optionText: string) {
    setOptions((current) =>
      current.map((option) =>
        option.id === id
          ? { ...option, option_text: optionText }
          : option,
      ),
    )
  }

  function updateMatchingItemLocal(id: string, patch: Partial<MatchingItemRow>) {
    setMatchingItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function updateMarkSchemeLocal(questionId: string, patch: Partial<MarkSchemeRow>) {
    setMarkSchemes((current) => {
      const existing = current.find((scheme) => scheme.question_id === questionId)
      if (existing) {
        return current.map((scheme) =>
          scheme.question_id === questionId ? { ...scheme, ...patch } : scheme,
        )
      }
      return [
        ...current,
        {
          id: '',
          question_id: questionId,
          max_marks: Number(questions.find((q) => q.id === questionId)?.marks ?? 0),
          expected_answer: null,
          acceptable_answers: [],
          answer_key: {},
          marking_points: [],
          rubric: {},
          ai_instructions: null,
          source_text: null,
          created_by: userId,
          ...patch,
        },
      ]
    })
  }

  async function insertOption(question: QuestionRow) {
    const existing = options.filter((item) => item.question_id === question.id)
    const key = String.fromCharCode(65 + existing.length)
    const { data, error: insertError } = await supabase
      .from('exam_question_options')
      .insert({
        question_id: question.id,
        option_order: existing.length + 1,
        option_key: key,
        option_text: `Option ${key}`,
      })
      .select('id,question_id,option_order,option_key,option_text')
      .single()
    if (insertError) throw insertError
    setOptions((current) => [...current, data as OptionRow])
  }

  async function deleteOption(option: OptionRow) {
    const { error: deleteError } = await supabase
      .from('exam_question_options')
      .delete()
      .eq('id', option.id)
    if (deleteError) throw deleteError
    setOptions((current) => current.filter((item) => item.id !== option.id))
  }

  async function addMatchingRow(question: QuestionRow) {
    const left = matchingItems.filter((i) => i.question_id === question.id && i.side === 'left')
    const right = matchingItems.filter((i) => i.question_id === question.id && i.side === 'right')
    const order = Math.max(left.length, right.length) + 1
    const leftKey = `L${order}`
    const rightKey = `R${order}`
    const { data, error: insertError } = await supabase
      .from('exam_matching_items')
      .insert([
        { question_id: question.id, side: 'left', item_order: order, item_key: leftKey, item_text: `Left item ${order}` },
        { question_id: question.id, side: 'right', item_order: order, item_key: rightKey, item_text: `Right item ${order}` },
      ])
      .select('id,question_id,side,item_order,item_key,item_text')
    if (insertError) throw insertError
    setMatchingItems((current) => [...current, ...((data ?? []) as MatchingItemRow[])])
    const scheme = markSchemes.find((m) => m.question_id === question.id)
    const answerKey = { ...((scheme?.answer_key ?? {}) as Record<string, unknown>), [leftKey]: rightKey }
    updateMarkSchemeLocal(question.id, { answer_key: answerKey })
  }

  async function deleteMatchingItem(item: MatchingItemRow) {
    const { error: deleteError } = await supabase.from('exam_matching_items').delete().eq('id', item.id)
    if (deleteError) throw deleteError
    setMatchingItems((current) => current.filter((x) => x.id !== item.id))
  }

  function insertMathSymbol(question: QuestionRow, symbol: string) {
    const input = questionTextRefs.current[question.id]
    const text = question.question_text ?? ''
    const start = input?.selectionStart ?? text.length
    const end = input?.selectionEnd ?? text.length
    const next = text.slice(0, start) + symbol + text.slice(end)
    updateQuestionLocal(question.id, { question_text: next })

    window.setTimeout(() => {
      const target = questionTextRefs.current[question.id]
      if (!target) return
      const cursor = start + symbol.length
      target.focus()
      target.setSelectionRange(cursor, cursor)
    }, 0)
  }

  async function attachDiagram(question: QuestionRow, file: File) {
    if (!userId) throw new Error('Your session is not ready.')
    if (!file.type.startsWith('image/')) {
      throw new Error('Paste or choose an image file for the diagram.')
    }

    setDiagramBusyId(question.id)
    setError('')
    setMessage('')

    try {
      const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const path = `${userId}/question-assets/${question.exam_id}/${question.id}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('exam-imports')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError

      const nextSettings = {
        ...(question.settings ?? {}),
        diagram_required: true,
        diagram_path: path,
        diagram_mime_type: file.type,
        diagram_source: 'teacher',
      }

      const { error: updateError } = await supabase
        .from('exam_questions')
        .update({ settings: nextSettings })
        .eq('id', question.id)
      if (updateError) throw updateError

      const { data: signed } = await supabase.storage
        .from('exam-imports')
        .createSignedUrl(path, 60 * 60)

      updateQuestionLocal(question.id, { settings: nextSettings })
      if (signed?.signedUrl) {
        setQuestionDiagramUrls((current) => ({ ...current, [question.id]: signed.signedUrl }))
      }
      setMessage(`Diagram attached to question ${question.question_number}.`)
    } finally {
      setDiagramBusyId(null)
    }
  }

  async function handleQuestionPaste(
    question: QuestionRow,
    event: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>,
  ) {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith('image/'),
    )
    if (!image) return
    event.preventDefault()
    try {
      await attachDiagram(question, image)
    } catch (err) {
      setError(errorMessage(err, 'The diagram could not be pasted.'))
    }
  }

  async function removeQuestionDiagram(question: QuestionRow) {
    const path =
      typeof question.settings?.diagram_path === 'string'
        ? question.settings.diagram_path
        : ''

    try {
      setDiagramBusyId(question.id)
      setError('')
      if (path) {
        const { error: removeError } = await supabase.storage
          .from('exam-imports')
          .remove([path])
        if (removeError) throw removeError
      }

      const nextSettings = { ...(question.settings ?? {}) }
      delete nextSettings.diagram_path
      delete nextSettings.diagram_mime_type
      delete nextSettings.diagram_source

      const { error: updateError } = await supabase
        .from('exam_questions')
        .update({ settings: nextSettings })
        .eq('id', question.id)
      if (updateError) throw updateError

      updateQuestionLocal(question.id, { settings: nextSettings })
      setQuestionDiagramUrls((current) => {
        const next = { ...current }
        delete next[question.id]
        return next
      })
      setMessage(`Diagram removed from question ${question.question_number}.`)
    } catch (err) {
      setError(errorMessage(err, 'The diagram could not be removed.'))
    } finally {
      setDiagramBusyId(null)
    }
  }

  function questionTable(question: QuestionRow): string[][] {
    const raw = question.settings?.table_data
    if (!Array.isArray(raw)) return []
    return raw.filter((row): row is unknown[] => Array.isArray(row)).map((row) => row.map((cell) => String(cell ?? '')))
  }
  function setQuestionTable(question: QuestionRow, table: string[][]) {
    updateQuestionLocal(question.id, { settings: { ...(question.settings ?? {}), table_data: table } })
  }
  function addQuestionTable(question: QuestionRow) {
    const current = questionTable(question)
    setQuestionTable(question, current.length ? current : [['', ''], ['', '']])
  }
  function addTableRow(question: QuestionRow) {
    const current = questionTable(question)
    const columns = Math.max(1, current[0]?.length ?? 2)
    setQuestionTable(question, [...current, Array(columns).fill('')])
  }
  function addTableColumn(question: QuestionRow) {
    const current = questionTable(question)
    const rows = current.length ? current : [[''], ['']]
    setQuestionTable(question, rows.map((row) => [...row, '']))
  }
  function updateTableCell(question: QuestionRow, rowIndex: number, columnIndex: number, value: string) {
    const next = questionTable(question).map((row) => [...row])
    if (!next[rowIndex]) return
    next[rowIndex][columnIndex] = value
    setQuestionTable(question, next)
  }
  function removeQuestionTable(question: QuestionRow) {
    const nextSettings = { ...(question.settings ?? {}) }
    delete nextSettings.table_data
    updateQuestionLocal(question.id, { settings: nextSettings })
  }

  async function addQuestion(parentQuestionId: string | null = null) {
    if (!reviewExam) return
    try {
      setError('')
      const nextOrder = questions.reduce((max, q) => Math.max(max, Number(q.sort_order) || 0), 0) + 1
      const parent = parentQuestionId ? questions.find((q) => q.id === parentQuestionId) : null
      const nextNumber = parent ? `${parent.question_number}(${questions.filter((q) => q.parent_question_id === parent.id).length + 1})` : String(questions.filter((q) => !q.parent_question_id).length + 1)
      const { data, error: insertError } = await supabase
        .from('exam_questions')
        .insert({
          exam_id: reviewExam.id,
          parent_question_id: parentQuestionId,
          question_number: nextNumber,
          sort_order: nextOrder,
          question_type: 'short_answer',
          question_text: '',
          marks: 1,
          required: true,
          settings: {},
          content_json: { type: 'doc', version: 1, blocks: [] },
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      setQuestions((current) => [...current, data as QuestionRow].sort((a, b) => a.sort_order - b.sort_order))
      setMessage(parent ? `Subquestion added under ${parent.question_number}.` : 'Question added.')
    } catch (err) {
      setError(errorMessage(err, 'Could not add question.'))
    }
  }

  async function deleteQuestion(question: QuestionRow) {
    if (!window.confirm(`Delete question ${question.question_number}? Its options, matching items and mark scheme will also be removed.`)) return
    try {
      const { error: deleteError } = await supabase.from('exam_questions').delete().eq('id', question.id)
      if (deleteError) throw deleteError
      const removedIds = new Set([question.id, ...questions.filter((q) => q.parent_question_id === question.id).map((q) => q.id)])
      setQuestions((current) => current.filter((q) => !removedIds.has(q.id)))
      setOptions((current) => current.filter((o) => !removedIds.has(o.question_id)))
      setMatchingItems((current) => current.filter((i) => !removedIds.has(i.question_id)))
      setMarkSchemes((current) => current.filter((m) => !removedIds.has(m.question_id)))
      setMessage(`Question ${question.question_number} deleted.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not delete question.'))
    }
  }

  async function moveQuestion(question: QuestionRow, direction: -1 | 1) {
    const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order)
    const index = ordered.findIndex((q) => q.id === question.id)
    const swap = ordered[index + direction]
    if (index < 0 || !swap) return
    try {
      const aOrder = question.sort_order
      const bOrder = swap.sort_order
      const [a, b] = await Promise.all([
        supabase.from('exam_questions').update({ sort_order: bOrder }).eq('id', question.id),
        supabase.from('exam_questions').update({ sort_order: aOrder }).eq('id', swap.id),
      ])
      if (a.error) throw a.error
      if (b.error) throw b.error
      setQuestions((current) => current.map((q) => q.id === question.id ? { ...q, sort_order: bOrder } : q.id === swap.id ? { ...q, sort_order: aOrder } : q).sort((x, y) => x.sort_order - y.sort_order))
    } catch (err) {
      setError(errorMessage(err, 'Could not reorder questions.'))
    }
  }

  async function duplicateQuestion(question: QuestionRow) {
    if (!reviewExam) return
    try {
      const nextOrder = questions.reduce((max, q) => Math.max(max, Number(q.sort_order) || 0), 0) + 1
      const { data: copy, error: copyError } = await supabase.from('exam_questions').insert({
        exam_id: reviewExam.id,
        parent_question_id: question.parent_question_id,
        question_number: `${question.question_number} copy`,
        sort_order: nextOrder,
        question_type: question.question_type,
        question_text: question.question_text,
        marks: question.marks,
        required: question.required,
        source_ref: question.source_ref,
        settings: question.settings,
        content_json: { type: 'doc', version: 1, blocks: question.question_text ? [{ id: crypto.randomUUID(), type: 'paragraph', text: question.question_text }] : [] },
      }).select('*').single()
      if (copyError) throw copyError
      const copied = copy as QuestionRow

      const sourceOptions = options.filter((o) => o.question_id === question.id)
      if (sourceOptions.length) {
        const { data, error } = await supabase.from('exam_question_options').insert(sourceOptions.map((o) => ({ question_id: copied.id, option_order: o.option_order, option_key: o.option_key, option_text: o.option_text }))).select('*')
        if (error) throw error
        setOptions((current) => [...current, ...((data ?? []) as OptionRow[])])
      }
      const sourceItems = matchingItems.filter((i) => i.question_id === question.id)
      if (sourceItems.length) {
        const { data, error } = await supabase.from('exam_matching_items').insert(sourceItems.map((i) => ({ question_id: copied.id, side: i.side, item_order: i.item_order, item_key: i.item_key, item_text: i.item_text }))).select('*')
        if (error) throw error
        setMatchingItems((current) => [...current, ...((data ?? []) as MatchingItemRow[])])
      }
      const scheme = markSchemes.find((m) => m.question_id === question.id)
      if (scheme) {
        const { data, error } = await supabase.from('exam_mark_schemes').insert({ question_id: copied.id, max_marks: scheme.max_marks, expected_answer: scheme.expected_answer, acceptable_answers: scheme.acceptable_answers, answer_key: scheme.answer_key, marking_points: scheme.marking_points, rubric: scheme.rubric, ai_instructions: scheme.ai_instructions, source_text: scheme.source_text, created_by: userId }).select('*').single()
        if (error) throw error
        setMarkSchemes((current) => [...current, data as MarkSchemeRow])
      }
      setQuestions((current) => [...current, copied].sort((a, b) => a.sort_order - b.sort_order))
      setMessage(`Question ${question.question_number} duplicated.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not duplicate question.'))
    }
  }

  function moveOptionLocal(questionId: string, optionId: string, direction: -1 | 1) {
    setOptions((current) => {
      const group = current.filter((o) => o.question_id === questionId).sort((a, b) => a.option_order - b.option_order)
      const index = group.findIndex((o) => o.id === optionId)
      const swap = group[index + direction]
      if (index < 0 || !swap) return current
      const selected = group[index]
      return current.map((o) => o.id === selected.id ? { ...o, option_order: swap.option_order } : o.id === swap.id ? { ...o, option_order: selected.option_order } : o)
    })
  }

  async function saveQuestion(question: QuestionRow) {
    try {
      setSavingQuestionId(question.id)
      setError('')
      setMessage('')

      const { error: questionError } = await supabase
        .from('exam_questions')
        .update({
          question_number: question.question_number.trim(),
          question_type: question.question_type,
          parent_question_id: question.parent_question_id,
          question_text: question.question_text?.trim() || null,
          marks: Number(question.marks) || 0,
          required: question.required,
          source_ref: question.source_ref?.trim() || null,
          settings: question.settings ?? {},
          content_json: {
            type: 'doc',
            version: 1,
            blocks: question.question_text?.trim()
              ? [
                  {
                    id: crypto.randomUUID(),
                    type: 'paragraph',
                    text: question.question_text.trim(),
                  },
                ]
              : [],
          },
        })
        .eq('id', question.id)

      if (questionError) throw questionError

      const questionOptions = options.filter(
        (option) => option.question_id === question.id,
      )

      for (const option of questionOptions) {
        const { error: optionError } = await supabase
          .from('exam_question_options')
          .update({
            option_order: option.option_order,
            option_key: option.option_key,
            option_text: option.option_text.trim(),
          })
          .eq('id', option.id)

        if (optionError) throw optionError
      }

      const questionMatchingItems = matchingItems.filter(
        (item) => item.question_id === question.id,
      )

      for (const item of questionMatchingItems) {
        const { error: itemError } = await supabase
          .from('exam_matching_items')
          .update({
            side: item.side,
            item_order: item.item_order,
            item_key: item.item_key,
            item_text: item.item_text.trim(),
          })
          .eq('id', item.id)
        if (itemError) throw itemError
      }

      const scheme = markSchemes.find((item) => item.question_id === question.id)
      if (scheme) {
        const payload = {
          question_id: question.id,
          max_marks: Number(question.marks) || 0,
          expected_answer: scheme.expected_answer?.trim() || null,
          acceptable_answers: scheme.acceptable_answers ?? [],
          answer_key: scheme.answer_key ?? {},
          marking_points: scheme.marking_points ?? [],
          rubric: scheme.rubric ?? {},
          ai_instructions: scheme.ai_instructions?.trim() || null,
          source_text: scheme.source_text?.trim() || null,
          created_by: userId,
          updated_at: new Date().toISOString(),
        }
        const { error: schemeSaveError } = await supabase
          .from('exam_mark_schemes')
          .upsert(payload, { onConflict: 'question_id' })
        if (schemeSaveError) throw schemeSaveError
      }

      setMessage(`Question ${question.question_number} saved.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save this question.',
      )
    } finally {
      setSavingQuestionId(null)
    }
  }

  async function saveExamDetails() {
    if (!reviewExam) return

    try {
      setError('')
      setMessage('')

      const calculatedMarks = questions.reduce(
        (sum, question) => sum + (Number(question.marks) || 0),
        0,
      )

      const { error: updateError } = await supabase
        .from('exams')
        .update({
          title: reviewExam.title.trim(),
          instructions: reviewExam.instructions?.trim() || null,
          duration_minutes: null,
          total_marks: calculatedMarks,
        })
        .eq('id', reviewExam.id)

      if (updateError) throw updateError

      setReviewExam({
        ...reviewExam,
        total_marks: calculatedMarks,
      })
      setMessage('Draft exam details saved.')
      await loadTeacherWorkspace(userId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save exam details.',
      )
    }
  }

  function validateExamForPublish() {
    if (!reviewExam) return ['No exam is open.']

    const problems: string[] = []
    if (!reviewExam.title.trim()) problems.push('Add an exam title.')
    if (questions.length === 0) problems.push('Add at least one question.')

    const emptyQuestions = questions.filter(
      (question) => !String(question.question_text ?? '').trim(),
    )
    if (emptyQuestions.length > 0) {
      problems.push(
        `${emptyQuestions.length} question${emptyQuestions.length === 1 ? '' : 's'} have no wording.`,
      )
    }

    const invalidMarks = questions.filter(
      (question) => !Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0,
    )
    if (invalidMarks.length > 0) {
      problems.push(
        `${invalidMarks.length} question${invalidMarks.length === 1 ? '' : 's'} need marks greater than 0.`,
      )
    }

    const missingOptions = questions.filter((question) => {
      if (
        question.question_type !== 'multiple_choice' &&
        question.question_type !== 'dropdown'
      ) {
        return false
      }
      return options.filter((option) => option.question_id === question.id).length < 2
    })
    if (missingOptions.length > 0) {
      problems.push(
        `${missingOptions.length} multiple-choice/dropdown question${missingOptions.length === 1 ? '' : 's'} need at least two options.`,
      )
    }

    const missingPairs = questions.filter(
      (question) =>
        question.question_type === 'matching' &&
        matchingItems.filter((item) => item.question_id === question.id).length < 2,
    )
    if (missingPairs.length > 0) {
      problems.push(
        `${missingPairs.length} matching question${missingPairs.length === 1 ? '' : 's'} need matching items.`,
      )
    }

    const missingCorrectAnswers = questions.filter((question) => {
      if (question.question_type !== 'multiple_choice' && question.question_type !== 'dropdown') return false
      const scheme = markSchemes.find((item) => item.question_id === question.id)
      return !String(scheme?.answer_key?.correct_option ?? '').trim()
    })
    if (missingCorrectAnswers.length > 0) {
      problems.push(`${missingCorrectAnswers.length} choice question${missingCorrectAnswers.length === 1 ? '' : 's'} need a correct answer.`)
    }

    const incompleteMatching = questions.filter((question) => {
      if (question.question_type !== 'matching') return false
      const lefts = matchingItems.filter((item) => item.question_id === question.id && item.side === 'left')
      const scheme = markSchemes.find((item) => item.question_id === question.id)
      return lefts.length === 0 || lefts.some((left) => !String(scheme?.answer_key?.[left.item_key] ?? '').trim())
    })
    if (incompleteMatching.length > 0) {
      problems.push(`${incompleteMatching.length} matching question${incompleteMatching.length === 1 ? '' : 's'} need every left item mapped to a correct right item.`)
    }

    return problems
  }

  async function publishExam() {
    if (!reviewExam) return

    const problems = validateExamForPublish()
    if (problems.length > 0) {
      setMessage('')
      setError(`Exam cannot be published yet: ${problems.join(' ')}`)
      return
    }

    try {
      setPublishingExam(true)
      setError('')
      setMessage('')

      const calculatedMarks = questions.reduce(
        (sum, question) => sum + (Number(question.marks) || 0),
        0,
      )
      const publishedAt = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('exams')
        .update({
          title: reviewExam.title.trim(),
          instructions: reviewExam.instructions?.trim() || null,
          duration_minutes: null,
          total_marks: calculatedMarks,
          status: 'published',
          published_at: publishedAt,
        })
        .eq('id', reviewExam.id)

      if (updateError) throw updateError

      setReviewExam({
        ...reviewExam,
        title: reviewExam.title.trim(),
        instructions: reviewExam.instructions?.trim() || null,
        total_marks: calculatedMarks,
        status: 'published',
        published_at: publishedAt,
      })
      setMessage('Exam published successfully.')
      await loadTeacherWorkspace(userId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not publish this exam.',
      )
    } finally {
      setPublishingExam(false)
    }
  }

  async function returnExamToDraft() {
    if (!reviewExam) return

    try {
      setPublishingExam(true)
      setError('')
      setMessage('')

      const { error: updateError } = await supabase
        .from('exams')
        .update({
          status: 'draft',
          published_at: null,
        })
        .eq('id', reviewExam.id)

      if (updateError) throw updateError

      setReviewExam({
        ...reviewExam,
        status: 'draft',
        published_at: null,
      })
      setMessage('Exam returned to draft.')
      await loadTeacherWorkspace(userId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not return this exam to draft.',
      )
    } finally {
      setPublishingExam(false)
    }
  }

  if (loading) {
    return (
      <main className="main">
        <div className="empty-state">
          <FileText size={34} />
          <strong>Loading Exams…</strong>
        </div>
      </main>
    )
  }

  if (!isTeacher) {
    if (role !== 'student') {
      return (
        <main className="main">
          <div className="empty-state">
            <FileText size={34} />
            <strong>Exams are not available for this role yet.</strong>
          </div>
        </main>
      )
    }

    if (studentRunnerExam && studentAttempt) {
      const answeredCount = questions.filter(answerIsComplete).length
      const studentReadOnly = studentAttempt.status !== 'in_progress'

      return (
        <main className="main">
          <header className="topbar">
            <div>
              <p className="eyebrow">STUDENT EXAM</p>
              <h1>{studentRunnerExam.title}</h1>
            </div>
            <button className="profile" type="button">ST</button>
          </header>

          {error && <p className="admin-message admin-message-error">{error}</p>}

          <section className="panel exam-review-header">
            <div className="panel-heading">
              <div>
                <h3>{subjectNameForStudent(studentRunnerExam.subject_id)}</h3>
                <p>{studentRunnerExam.instructions || 'Answer all questions carefully.'}</p>
              </div>
              <span className={`assignment-status ${studentReadOnly ? 'submitted' : 'published'}`}>
                {studentReadOnly ? 'Submitted · read only' : 'In progress'}
              </span>
            </div>
            <div className="exam-review-summary">
              <span>{answeredCount}/{questions.length} answered</span>
              <span>{studentRunnerExam.total_marks} marks</span>
              {!studentReadOnly && (
                <button
                  className="primary compact-action"
                  type="button"
                  disabled={studentSubmitting}
                  onClick={() => void submitStudentExam()}
                >
                  {studentSubmitting ? 'Submitting…' : 'Submit exam'}
                </button>
              )}
            </div>
          </section>

          <section className="exam-question-list">
            {questions.map((question) => {
              const answer = studentAnswers[question.id] ?? {}
              const questionOptions = options.filter((item) => item.question_id === question.id)
              const questionMatchingItems = matchingItems.filter((item) => item.question_id === question.id)
              const matchingResponse = Array.isArray(answer.matching_response)
                ? answer.matching_response
                : []

              return (
                <article className="panel exam-question-review-card" key={question.id} style={question.parent_question_id ? { marginLeft: '28px', borderLeft: '4px solid #dce2ea' } : undefined}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{questionLabels[question.question_type]}</p>
                      <h3>Question {question.question_number}</h3>
                    </div>
                    <span>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span>
                  </div>

                  <p style={{ whiteSpace: 'pre-wrap' }}>{question.question_text}</p>

                  {studentVisuals[question.id]?.kind === 'image' && (
                    <img
                      src={studentVisuals[question.id].url}
                      alt={`Visual for question ${question.question_number}`}
                      style={{ display: 'block', width: '100%', maxWidth: '760px', maxHeight: '520px', objectFit: 'contain', border: '1px solid #dce2ea', borderRadius: '8px', background: '#fff', margin: '12px 0' }}
                    />
                  )}
                  {studentVisuals[question.id]?.kind === 'source_pdf' && (
                    <iframe
                      title={`Source visual for question ${question.question_number}`}
                      src={`${studentVisuals[question.id].url}#page=${studentVisuals[question.id].source_page}&view=FitH`}
                      style={{ width: '100%', height: '520px', border: '1px solid #dce2ea', borderRadius: '8px', margin: '12px 0' }}
                    />
                  )}
                  {studentVisualErrors[question.id] && (
                    <p className="admin-message admin-message-error">{studentVisualErrors[question.id]}</p>
                  )}

                  {questionTable(question).length > 0 && (
                    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                      <table className="exam-manual-table"><tbody>
                        {questionTable(question).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}
                      </tbody></table>
                    </div>
                  )}

                  {(question.question_type === 'short_answer' ||
                    question.question_type === 'long_answer' ||
                    question.question_type === 'structured') &&
                    !questions.some((child) => child.parent_question_id === question.id) && (
                    <textarea
                      rows={question.question_type === 'short_answer' ? 3 : 7}
                      value={answer.answer_text ?? ''}
                      placeholder="Type your answer here"
                      readOnly={studentReadOnly}
                      onChange={(event) => queueStudentTextSave(question, event.target.value)}
                      onBlur={() => void flushStudentTextSaves(question.id)}
                    />
                  )}

                  {question.question_type === 'multiple_choice' && (
                    <div className="exam-options-review">
                      {questionOptions.map((option) => (
                        <label key={option.id}>
                          <input
                            type="radio"
                            disabled={studentReadOnly}
                            name={`question-${question.id}`}
                            checked={answer.selected_option_key === option.option_key}
                            onChange={() =>
                              void saveStudentAnswer(question, {
                                selected_option_key: option.option_key,
                              })
                            }
                          />
                          <span>{option.option_key ?? '•'}</span>
                          <span>{option.option_text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {question.question_type === 'dropdown' && (
                    <select
                      disabled={studentReadOnly}
                      value={answer.dropdown_value ?? ''}
                      onChange={(event) =>
                        void saveStudentAnswer(question, { dropdown_value: event.target.value })
                      }
                    >
                      <option value="">Choose an answer</option>
                      {questionOptions.map((option) => (
                        <option key={option.id} value={option.option_key ?? option.option_text}>
                          {option.option_key ? `${option.option_key}. ` : ''}{option.option_text}
                        </option>
                      ))}
                    </select>
                  )}

                  {question.question_type === 'matching' && (
                    <div className="exam-matching-review">
                      {questionMatchingItems
                        .filter((item) => item.side === 'left')
                        .map((left) => {
                          const leftKey = left.item_key ?? ''
                          const selected =
                            matchingResponse.find(
                              (item: any) => item?.left_key === leftKey,
                            )?.right_key ?? ''
                          const rightItems = questionMatchingItems.filter(
                            (item) => item.side === 'right',
                          )
                          return (
                            <label
                              key={left.id}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault()
                                const rightKey = event.dataTransfer.getData('text/plain')
                                if (rightKey) updateMatchingAnswer(question, leftKey, rightKey)
                              }}
                              style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px' }}
                            >
                              <span>{left.item_text}</span>
                              <select
                                disabled={studentReadOnly}
                                value={selected}
                                onChange={(event) =>
                                  updateMatchingAnswer(
                                    question,
                                    leftKey,
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">Choose match</option>
                                {rightItems.map((right) => (
                                  <option
                                    key={right.id}
                                    value={right.item_key ?? ''}
                                  >
                                    {right.item_text}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )
                        })}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                        {questionMatchingItems.filter((item) => item.side === 'right').map((right) => (
                          <button
                            key={right.id}
                            type="button"
                            disabled={studentReadOnly}
                            draggable={!studentReadOnly}
                            onDragStart={(event) => event.dataTransfer.setData('text/plain', right.item_key)}
                            className="secondary"
                            title="Drag this choice onto a left-hand item, or use the dropdown above."
                          >
                            {right.item_text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="exam-question-review-actions">
                    <span className={`assignment-status ${answerIsComplete(question) ? 'published' : 'draft'}`}>
                      {answerIsComplete(question) ? 'Answered' : 'Not answered'}
                    </span>
                    {studentSavingQuestionId === question.id && <span>Saving…</span>}
                  </div>
                </article>
              )
            })}
          </section>
        </main>
      )
    }

    return (
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">STUDENT WORKSPACE</p>
            <h1>My Exams</h1>
          </div>
          <button className="profile" type="button">ST</button>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">EXAMS & ASSESSMENTS</p>
            <h2>Your exams in one place.</h2>
            <p className="muted">
              Published exams from your enrolled classes appear under their subjects. Open a paper to start, continue, or review a submission.
            </p>
          </div>
        </section>

        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="stats">
          <div className="card">
            <span>Available</span>
            <strong>
              {exams.filter((exam) => exam.status === 'published' && !studentAttemptFor(exam.id)).length}
            </strong>
            <small>Ready to start</small>
          </div>
          <div className="card">
            <span>In progress</span>
            <strong>
              {studentAttempts.filter((attempt) => attempt.status === 'in_progress').length}
            </strong>
            <small>Started exams</small>
          </div>
          <div className="card">
            <span>Submitted</span>
            <strong>
              {studentAttempts.filter((attempt) => attempt.status !== 'in_progress').length}
            </strong>
            <small>Completed attempts</small>
          </div>
        </section>

        <section className="panel exam-browser-panel">
          <div className="panel-heading assignment-list-heading">
            <div>
              <h3>My exams</h3>
              <p>
                {visibleStudentExams.length}{' '}
                {visibleStudentExams.length === 1 ? 'exam' : 'exams'}
              </p>
            </div>
            <div className="assignment-toolbar">
              <select
                value={studentExamFilter}
                onChange={(event) =>
                  setStudentExamFilter(
                    event.target.value as
                      | 'all'
                      | 'available'
                      | 'in_progress'
                      | 'submitted',
                  )
                }
              >
                <option value="all">All exams</option>
                <option value="available">Available</option>
                <option value="in_progress">In progress</option>
                <option value="submitted">Submitted</option>
              </select>
            </div>
          </div>

          {visibleStudentExams.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={34} />
              <strong>No exams found</strong>
              <p>
                Published exams from your actively enrolled classes will appear here.
              </p>
            </div>
          ) : (
            <div className="exam-subject-groups">
              {Object.entries(studentExamGroups).map(([subject, subjectExams]) => (
                <section className="exam-subject-group" key={subject}>
                  <h4>{subject}</h4>
                  <div className="assignment-list">
                    {subjectExams.map((exam) => {
                      const attempt = studentAttemptFor(exam.id)
                      const state = studentExamState(exam)
                      return (
                        <article className="assignment-item" key={exam.id}>
                          <div className="assignment-item-main">
                            <div className="assignment-item-title">
                              <strong>{exam.title}</strong>
                              <span className={`assignment-status ${state.className}`}>{state.label}</span>
                            </div>
                            <p>{classNameForStudent(exam.class_id)} · {subjectNameForStudent(exam.subject_id)}</p>
                            <div className="assignment-meta">
                              <span>{exam.total_marks} marks</span>
                              {attempt?.started_at && <span>Started {new Date(attempt.started_at).toLocaleString()}</span>}
                              {attempt?.submitted_at && <span>Submitted {new Date(attempt.submitted_at).toLocaleString()}</span>}
                            </div>
                          </div>
                          <div className="assignment-actions">
                            {exam.status === 'published' && !attempt && (
                              <button className="primary compact-action" type="button" disabled={studentRunnerLoading} onClick={() => void openStudentRunner(exam, null)}>
                                {studentRunnerLoading ? 'Opening…' : 'Start exam'}
                              </button>
                            )}
                            {attempt?.status === 'in_progress' && (
                              <button className="primary compact-action" type="button" disabled={studentRunnerLoading} onClick={() => void openStudentRunner(exam, attempt)}>
                                {studentRunnerLoading ? 'Opening…' : 'Continue exam'}
                              </button>
                            )}
                            {attempt && attempt.status !== 'in_progress' && (
                              <button className="secondary compact-action" type="button" disabled={studentRunnerLoading} onClick={() => void openStudentRunner(exam, attempt)}>
                                {studentRunnerLoading ? 'Opening…' : 'View submission'}
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="muted" style={{ marginTop: '16px' }}>
            Start creates one secure attempt. Continue reopens that same attempt, and
            answers are saved to your account as you work.
          </p>
        </section>
      </main>
    )
  }

  if (reviewExam && !teacherEditMode) {
    return (
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">EXAM PAPER</p><h1>{reviewExam.title}</h1></div>
          <button className="profile" type="button">{role === 'platform_owner' ? 'PO' : 'TR'}</button>
        </header>
        <div className="exam-view-toolbar">
          <button className="secondary compact-action" type="button" onClick={() => setReviewExam(null)}>← Back to Exams</button>
          <button className="primary compact-action" type="button" onClick={() => setTeacherEditMode(true)}>Edit exam</button>
        </div>
        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}
        <section className="panel exam-paper-header">
          <div className="panel-heading"><div><h3>{reviewExam.title}</h3><p>{reviewExam.instructions || 'Answer all questions.'}</p></div><span className={`assignment-status ${reviewExam.status}`}>{reviewExam.status === 'published' ? 'Published' : 'Draft'}</span></div>
          <div className="exam-review-summary"><span>{questions.length} questions</span><span>{questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)} marks</span></div>
        </section>
        <section className="exam-paper-questions">
          {questions.map((question) => {
            const qOptions = options.filter((o) => o.question_id === question.id)
            const qMatching = matchingItems.filter((i) => i.question_id === question.id)
            return (
              <article className="panel exam-paper-question" key={question.id}>
                <div className="exam-paper-question-heading"><strong>{question.question_number}</strong><span>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span></div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{question.question_text}</p>
                {questionDiagramUrls[question.id] && <img className="exam-paper-diagram" src={questionDiagramUrls[question.id]} alt={`Diagram for question ${question.question_number}`} />}
                {(question.question_type === 'multiple_choice' || question.question_type === 'dropdown') && qOptions.length > 0 && <div className="exam-paper-options">{qOptions.map((o) => <div key={o.id}><strong>{o.option_key}.</strong> {o.option_text}</div>)}</div>}
                {question.question_type === 'matching' && qMatching.length > 0 && <div className="exam-paper-options">{qMatching.filter(i => i.side === 'left').map(i => <div key={i.id}>{i.item_text}</div>)}</div>}
              </article>
            )
          })}
        </section>
        <section className="panel exam-answer-key">
          <div className="panel-heading"><div><h3>Marking Key / Answer Key</h3><p>Teacher and platform-owner view only. This key is the authority for automatic and AI-assisted marking.</p></div></div>
          <div className="answer-key-table">
            <div className="answer-key-row answer-key-head"><strong>Question</strong><strong>Answer / marking guidance</strong><strong>Marks</strong></div>
            {questions.map((question) => {
              const scheme = markSchemes.find((m) => m.question_id === question.id)
              const qOptions = options.filter((o) => o.question_id === question.id)
              const key = scheme?.answer_key as any
              let answer = scheme?.expected_answer || ''
              if (question.question_type === 'multiple_choice' || question.question_type === 'dropdown') {
                const correct = String(key?.correct_option ?? '')
                const opt = qOptions.find(o => o.option_key === correct)
                answer = correct ? `${correct}${opt?.option_text ? `. ${opt.option_text}` : ''}` : answer
              }
              if (!answer && Array.isArray(scheme?.marking_points)) answer = scheme!.marking_points.map((p:any) => typeof p === 'string' ? p : p?.text ?? '').filter(Boolean).join('; ')
              if (!answer && question.question_type === 'matching' && key) answer = Object.entries(key).map(([l,r]) => `${l} → ${String(r)}`).join('; ')
              return <div className="answer-key-row" key={question.id}><strong>{question.question_number}</strong><span>{answer || '—'}</span><span>{question.marks}</span></div>
            })}
          </div>
        </section>
      </main>
    )
  }

  if (reviewExam && teacherEditMode) {
    return (
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">EXAM IMPORT REVIEW</p>
            <h1>{reviewExam.title}</h1>
          </div>
          <button className="profile" type="button">
            {role === 'platform_owner' ? 'PO' : 'TR'}
          </button>
        </header>

        <button
          className="secondary"
          type="button"
          onClick={() => setTeacherEditMode(false)}
        >
          ← View exam
        </button>

        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="panel exam-review-header">
          <div className="panel-heading">
            <div>
              <h3>Exam preview</h3>
              <p>
                Create and review your questions before publishing.
              </p>
            </div>
            <span className={`assignment-status ${reviewExam.status}`}>
              {reviewExam.status === 'published' ? 'Published' : 'Draft'}
            </span>
          </div>

          <div className="exam-review-meta">
            <label>
              <span>Exam title</span>
              <input
                value={reviewExam.title}
                onChange={(event) =>
                  setReviewExam({
                    ...reviewExam,
                    title: event.target.value,
                  })
                }
              />
            </label>

            <label className="exam-review-instructions">
              <span>Instructions</span>
              <textarea
                value={reviewExam.instructions ?? ''}
                onChange={(event) =>
                  setReviewExam({
                    ...reviewExam,
                    instructions: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <div className="exam-review-summary">
            <span>{questions.length} questions</span>
            <span>
              {questions.reduce(
                (sum, question) => sum + (Number(question.marks) || 0),
                0,
              )}{' '}
              marks
            </span>
            <button
              className="primary"
              type="button"
              onClick={() => void saveExamDetails()}
            >
              <Save size={15} /> Save exam details
            </button>
            {reviewExam.status === 'published' ? (
              <button
                className="secondary"
                type="button"
                disabled={publishingExam}
                onClick={() => void returnExamToDraft()}
              >
                {publishingExam ? 'Updating…' : 'Return to draft'}
              </button>
            ) : (
              <button
                className="primary"
                type="button"
                disabled={publishingExam || reviewLoading}
                onClick={() => void publishExam()}
              >
                {publishingExam ? 'Publishing…' : 'Publish exam'}
              </button>
            )}
          </div>
        </section>

        {reviewLoading ? (
          <div className="empty-state">
            <RefreshCw size={32} />
            <strong>Loading reproduced questions…</strong>
          </div>
        ) : (
          <section className="exam-question-review-list">
            {questions.map((question) => {
              const questionOptions = options.filter(
                (option) => option.question_id === question.id,
              )
              const questionMatchingItems = matchingItems.filter(
                (item) => item.question_id === question.id,
              )
              const questionMarkScheme = markSchemes.find(
                (scheme) => scheme.question_id === question.id,
              )

              return (
                <article className="panel exam-question-review" key={question.id}>
                  <div className="exam-question-review-top">
                    <label>
                      <span>Number</span>
                      <input
                        value={question.question_number}
                        onChange={(event) =>
                          updateQuestionLocal(question.id, {
                            question_number: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      <span>Question type</span>
                      <select
                        value={question.question_type}
                        onChange={(event) =>
                          updateQuestionLocal(question.id, {
                            question_type: event.target.value as QuestionType,
                          })
                        }
                      >
                        {Object.entries(questionLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Marks</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={question.marks}
                        onChange={(event) =>
                          updateQuestionLocal(question.id, {
                            marks: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <label style={{ display: 'block', marginTop: '10px' }}>
                    <span>Structured parent</span>
                    <select
                      value={question.parent_question_id ?? ''}
                      onChange={(event) => updateQuestionLocal(question.id, { parent_question_id: event.target.value || null })}
                    >
                      <option value="">None — top-level question</option>
                      {questions
                        .filter((candidate) => candidate.id !== question.id && candidate.question_type === 'structured' && !candidate.parent_question_id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            Question {candidate.question_number}: {(candidate.question_text ?? '').slice(0, 70)}
                          </option>
                        ))}
                    </select>
                    <small>Choose a structured parent to make this a subquestion such as 3(a) or 3(b)(i).</small>
                  </label>

                  <label className="exam-question-text">
                    <span>Question wording</span>
                    <textarea
                      ref={(element) => {
                        questionTextRefs.current[question.id] = element
                      }}
                      value={question.question_text ?? ''}
                      onPaste={(event) => void handleQuestionPaste(question, event)}
                      onChange={(event) =>
                        updateQuestionLocal(question.id, {
                          question_text: event.target.value,
                        })
                      }
                    />
                  </label>

                  <div
                    className="exam-question-insert-tools"
                    style={{ marginTop: '10px', padding: '10px', border: '1px solid #e4e9f0', borderRadius: '9px', background: '#f8fafc' }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <strong style={{ fontSize: '.72rem', marginRight: '4px' }}>Insert</strong>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 9px', border: '1px solid #dce2ea', borderRadius: '7px', background: '#fff', cursor: 'pointer', fontSize: '.72rem', fontWeight: 600 }}>
                        <ImagePlus size={14} />
                        {diagramBusyId === question.id ? 'Saving diagram…' : 'Upload diagram'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={diagramBusyId === question.id}
                          onChange={(event) => {
                            const image = event.target.files?.[0]
                            if (image) {
                              void attachDiagram(question, image).catch((err) =>
                                setError(errorMessage(err, 'The diagram could not be uploaded.')),
                              )
                            }
                            event.currentTarget.value = ''
                          }}
                        />
                      </label>
                      <span style={{ fontSize: '.7rem', color: '#64748b' }}>
                        or copy an image, click in the question box and press Ctrl+V
                      </span>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', color: '#64748b', fontSize: '.68rem', fontWeight: 700 }}>
                        <Sigma size={14} /> MATHS SYMBOLS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {examMathSymbols.map((symbol) => (
                          <button
                            key={symbol}
                            type="button"
                            title={`Insert ${symbol}`}
                            onClick={() => insertMathSymbol(question, symbol)}
                            style={{ minWidth: '32px', minHeight: '30px', padding: '4px 7px', border: '1px solid #dce2ea', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '.82rem' }}
                          >
                            {symbol}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <strong style={{ fontSize: '.72rem', marginRight: '4px' }}>TABLE</strong>
                        {questionTable(question).length === 0 ? <button type="button" className="secondary" onClick={() => addQuestionTable(question)}>+ Insert 2 × 2 table</button> : <>
                          <button type="button" className="secondary" onClick={() => addTableRow(question)}>+ Row</button>
                          <button type="button" className="secondary" onClick={() => addTableColumn(question)}>+ Column</button>
                          <button type="button" className="secondary" onClick={() => removeQuestionTable(question)}>Remove table</button>
                        </>}
                      </div>
                      {questionTable(question).length > 0 && <div style={{ overflowX: 'auto', marginTop: '8px' }}><table className="exam-manual-table exam-manual-table-editor"><tbody>
                        {questionTable(question).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><input value={cell} aria-label={`Table row ${r + 1} column ${c + 1}`} onChange={(e) => updateTableCell(question, r, c, e.target.value)} /></td>)}</tr>)}
                      </tbody></table></div>}
                    </div>

                    {questionDiagramUrls[question.id] && (
                      <div style={{ marginTop: '10px' }}>
                        <strong style={{ display: 'block', marginBottom: '6px', fontSize: '.72rem' }}>Attached diagram</strong>
                        <img
                          src={questionDiagramUrls[question.id]}
                          alt={`Diagram for question ${question.question_number}`}
                          style={{ display: 'block', width: '100%', maxWidth: '760px', maxHeight: '520px', objectFit: 'contain', border: '1px solid #dce2ea', borderRadius: '8px', background: '#fff' }}
                        />
                        <button
                          type="button"
                          disabled={diagramBusyId === question.id}
                          onClick={() => void removeQuestionDiagram(question)}
                          style={{ marginTop: '7px', padding: '6px 9px', border: '1px solid #dce2ea', borderRadius: '7px', background: '#fff', cursor: 'pointer', fontSize: '.7rem', fontWeight: 600 }}
                        >
                          Remove diagram
                        </button>
                      </div>
                    )}
                  </div>

                  {question.source_ref && (
                    <div className="exam-source-ref">
                      <FileSearch size={14} />
                      <span>
                        Source reference: {question.source_ref}
                        {Boolean(question.settings?.diagram_required)
                          ? ' · visual/diagram required'
                          : ''}
                      </span>
                    </div>
                  )}

                  {Boolean(question.settings?.diagram_required) &&
                    sourcePaperUrl && (
                      <div className="exam-source-visual">
                        <strong>
                          Source visual
                          {question.settings?.source_page
                            ? ` · page ${question.settings.source_page}`
                            : ''}
                        </strong>
                        {sourcePaperMime.startsWith('image/') ? (
                          <img
                            src={sourcePaperUrl}
                            alt={`Source visual for question ${question.question_number}`}
                            style={{ width: '100%', maxHeight: '620px', objectFit: 'contain', borderRadius: '10px', marginTop: '10px' }}
                          />
                        ) : (
                          <iframe
                            title={`Source page for question ${question.question_number}`}
                            src={`${sourcePaperUrl}#page=${Number(question.settings?.source_page ?? 1)}&view=FitH`}
                            style={{ width: '100%', height: '620px', border: '1px solid #d9dee8', borderRadius: '10px', marginTop: '10px' }}
                          />
                        )}
                      </div>
                    )}

                  {(question.question_type === 'multiple_choice' ||
                    question.question_type === 'dropdown') && (
                    <div className="exam-options-review">
                      <strong>{question.question_type === 'multiple_choice' ? 'Answer options' : 'Dropdown choices'}</strong>
                      {questionOptions.map((option) => (
                        <div key={option.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                          <input value={option.option_key} onChange={(event) =>
                            setOptions((current) => current.map((item) => item.id === option.id ? { ...item, option_key: event.target.value } : item))
                          } />
                          <input value={option.option_text} onChange={(event) => updateOptionLocal(option.id, event.target.value)} />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button type="button" className="secondary" onClick={() => moveOptionLocal(question.id, option.id, -1)}>↑</button>
                            <button type="button" className="secondary" onClick={() => moveOptionLocal(question.id, option.id, 1)}>↓</button>
                            <button type="button" className="secondary" onClick={() => void deleteOption(option)}>Remove</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="secondary" style={{ marginTop: '10px' }} onClick={() => void insertOption(question)}>
                        + Add option
                      </button>
                      <label style={{ display: 'block', marginTop: '12px' }}>
                        <span>Correct answer</span>
                        <select
                          value={String(questionMarkScheme?.answer_key?.correct_option ?? '')}
                          onChange={(event) =>
                            updateMarkSchemeLocal(question.id, {
                              answer_key: { ...(questionMarkScheme?.answer_key ?? {}), correct_option: event.target.value },
                            })
                          }
                        >
                          <option value="">Choose correct answer</option>
                          {questionOptions.map((option) => (
                            <option key={option.id} value={option.option_key}>{option.option_key}. {option.option_text}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  {question.question_type === 'matching' && (
                    <div className="exam-matching-review">
                      <strong>Matching / drag-and-drop pairs</strong>
                      {questionMatchingItems.filter((i) => i.side === 'left').map((left) => {
                        const rightKey = String(questionMarkScheme?.answer_key?.[left.item_key] ?? '')
                        const rights = questionMatchingItems.filter((i) => i.side === 'right')
                        return (
                          <div key={left.id} style={{ display: 'grid', gridTemplateColumns: '1fr 34px 1fr auto', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                            <input value={left.item_text} onChange={(event) => updateMatchingItemLocal(left.id, { item_text: event.target.value })} />
                            <span>→</span>
                            <select value={rightKey} onChange={(event) =>
                              updateMarkSchemeLocal(question.id, {
                                answer_key: { ...(questionMarkScheme?.answer_key ?? {}), [left.item_key]: event.target.value },
                              })
                            }>
                              <option value="">Correct match</option>
                              {rights.map((right) => <option key={right.id} value={right.item_key}>{right.item_text}</option>)}
                            </select>
                            <button type="button" className="secondary" onClick={() => void deleteMatchingItem(left)}>Remove</button>
                          </div>
                        )
                      })}
                      <div style={{ marginTop: '10px' }}>
                        <strong>Right-side items</strong>
                        {questionMatchingItems.filter((i) => i.side === 'right').map((right) => (
                          <div key={right.id} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <input style={{ flex: 1 }} value={right.item_text} onChange={(event) => updateMatchingItemLocal(right.id, { item_text: event.target.value })} />
                            <button type="button" className="secondary" onClick={() => void deleteMatchingItem(right)}>Remove</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" className="secondary" style={{ marginTop: '10px' }} onClick={() => void addMatchingRow(question)}>
                        + Add matching pair
                      </button>
                    </div>
                  )}



                  <div className="exam-question-review-actions">
                    <button type="button" className="secondary" onClick={() => void moveQuestion(question, -1)}>↑ Move</button>
                    <button type="button" className="secondary" onClick={() => void moveQuestion(question, 1)}>↓ Move</button>
                    <button type="button" className="secondary" onClick={() => void duplicateQuestion(question)}>Duplicate</button>
                    {question.question_type === 'structured' && !question.parent_question_id && (
                      <button type="button" className="secondary" onClick={() => void addQuestion(question.id)}>+ Subquestion</button>
                    )}
                    <button type="button" className="secondary" onClick={() => void deleteQuestion(question)}>Delete</button>
                    <button
                      className="primary"
                      type="button"
                      disabled={savingQuestionId === question.id}
                      onClick={() => void saveQuestion(question)}
                    >
                      <Save size={14} />
                      {savingQuestionId === question.id
                        ? 'Saving…'
                        : 'Save question'}
                    </button>
                  </div>
                  <div className="exam-add-after-question">
                    <button className="secondary" type="button" onClick={() => void addQuestion(null)}>
                      + Add question
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    )
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {role === 'platform_owner'
              ? 'PLATFORM OWNER WORKSPACE'
              : 'TEACHER WORKSPACE'}
          </p>
          <h1>Exams</h1>
        </div>
        <button className="profile" type="button">
          {role === 'platform_owner' ? 'PO' : 'TR'}
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">EXAM CREATOR</p>
          <h2>Create an exam manually.</h2>
          <p className="muted">Build Cambridge-style questions with text, diagrams, tables, maths symbols and a complete marking key for automatic and AI-assisted marking.</p>
        </div>
        <button className="primary" type="button" onClick={() => setShowCreator(true)} disabled={!selectedSubjectId}>+ Create Exam</button>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      <section className="panel exam-browser-panel">
        <div className="assignment-smart-nav">
          <div className="assignment-class-tabs">
            {classes.map((item) => <button key={item.id} type="button" className={selectedClassId === item.id ? 'active' : ''} onClick={() => chooseClass(item.id)}>{item.name}</button>)}
          </div>
          <div className="assignment-subject-tabs">
            {navigationSubjects.map((subject) => <button key={subject.id} type="button" className={selectedSubjectId === subject.id ? 'active' : ''} onClick={() => setSelectedSubjectId(subject.id)}>{subject.name}</button>)}
          </div>
        </div>

        {showCreator && (
          <div className="exam-import-card">
            <div className="panel-heading">
              <div><h3>Create exam</h3><p>Start a clean draft. No timer: students submit when finished while the exam remains open.</p></div>
              <button className="icon-button" type="button" onClick={() => setShowCreator(false)} disabled={creatingExam}>×</button>
            </div>
            <div className="exam-import-grid">
              <label><span>Exam title</span><input value={creatorTitle} onChange={(e) => setCreatorTitle(e.target.value)} placeholder="e.g. Stage 6 Science Revision Paper 1" disabled={creatingExam} /></label>
              <label><span>Class and subject</span><input value={`${classes.find((x) => x.id === selectedClassId)?.name ?? ''} · ${subjects.find((x) => x.id === selectedSubjectId)?.name ?? ''}`} readOnly /></label>
            </div>
            <label style={{ display: 'block', marginTop: '12px' }}><span>Instructions</span><textarea rows={3} value={creatorInstructions} onChange={(e) => setCreatorInstructions(e.target.value)} placeholder="Instructions shown to students before the questions." disabled={creatingExam} /></label>
            <div className="exam-import-actions"><button className="primary" type="button" onClick={() => void createManualExam()} disabled={creatingExam || !creatorTitle.trim()}>{creatingExam ? 'Creating…' : 'Create Draft & Build Questions'}</button></div>
          </div>
        )}

        <div className="panel-heading exam-list-heading">
          <div>
            <h3>
              {subjects.find((item) => item.id === selectedSubjectId)?.name ??
                'Exams'}
            </h3>
            <p>
              {visibleExams.length}{' '}
              {visibleExams.length === 1 ? 'exam' : 'exams'}
            </p>
          </div>

          <button
            className="secondary"
            type="button"
            onClick={() => void loadTeacherWorkspace(userId)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={34} />
            <strong>Create a class first</strong>
            <p>Exams must belong to one of your classes.</p>
          </div>
        ) : navigationSubjects.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={34} />
            <strong>No subjects in this class</strong>
            <p>Add subjects before importing exams.</p>
          </div>
        ) : visibleExams.length === 0 ? (
          <div className="empty-state">
            <FileText size={34} />
            <strong>No exams for this subject</strong>
            <p>Import the first paper and OLP will reproduce it as a draft.</p>
          </div>
        ) : (
          <div className="exam-list">
            {visibleExams.map((exam) => (
              <article className="exam-list-item" key={exam.id}>
                <button type="button" onClick={() => void openExam(exam.id)}>
                  <div>
                    <strong>{exam.title}</strong>
                    <p>
                      {exam.total_marks} marks
                      
                    </p>
                  </div>

                  <span className={`assignment-status ${exam.status}`}>
                    {exam.status}
                  </span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {imports.some((item) => item.status === 'failed') && (
        <section className="panel exam-import-history">
          <div className="panel-heading">
            <div>
              <h3>Recent import issues</h3>
              <p>Failed imports are kept here so the error is visible.</p>
            </div>
          </div>

          {imports
            .filter((item) => item.status === 'failed')
            .slice(0, 3)
            .map((item) => (
              <div className="exam-import-error-row" key={item.id}>
                <FileText size={15} />
                <div>
                  <strong>{item.file_name}</strong>
                  <span>{item.error_message || 'Import failed.'}</span>
                </div>
              </div>
            ))}
        </section>
      )}
    </main>
  )
}

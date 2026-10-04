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
  option_key: string | null
  option_text: string
}

type MatchingPairRow = {
  id: string
  question_id: string
  pair_order?: number
  left_key?: string | null
  left_text?: string
  right_key?: string | null
  right_text?: string
  side?: 'left' | 'right' | string
  item_order?: number
  item_key?: string
  item_text?: string
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
  const [showImporter, setShowImporter] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [titleOverride, setTitleOverride] = useState('')
  const [durationOverride, setDurationOverride] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [reviewExam, setReviewExam] = useState<ExamRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [options, setOptions] = useState<OptionRow[]>([])
  const [pairs, setPairs] = useState<MatchingPairRow[]>([])
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

  useEffect(() => {
    if (!studentRunnerExam || !studentAttempt || studentAttempt.status !== 'in_progress') {
      setStudentSecondsLeft(null)
      return
    }
    if (!studentRunnerExam.duration_minutes) {
      setStudentSecondsLeft(null)
      return
    }

    const finishAt =
      new Date(studentAttempt.started_at).getTime() +
      studentRunnerExam.duration_minutes * 60 * 1000

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((finishAt - Date.now()) / 1000))
      setStudentSecondsLeft(seconds)
      if (seconds <= 0) void submitStudentExam(true)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [studentRunnerExam?.id, studentAttempt?.id, studentAttempt?.status])

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
          .select('id,exam_id,student_id,status,started_at,submitted_at,final_mark,returned_at')
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

  async function openStudentRunner(exam: ExamRow, existingAttempt?: ExamAttemptRow | null) {
    try {
      setStudentRunnerLoading(true)
      setError('')
      let attempt = existingAttempt ?? studentAttemptFor(exam.id)

      if (!attempt) {
        const { data, error: attemptError } = await supabase
          .from('exam_attempts')
          .insert({ exam_id: exam.id, student_id: userId, status: 'in_progress' })
          .select('id,exam_id,student_id,status,started_at,submitted_at,final_mark,returned_at')
          .single()
        if (attemptError) throw attemptError
        attempt = data as ExamAttemptRow
        setStudentAttempts((current) => [attempt as ExamAttemptRow, ...current])
      }

      if (attempt.status !== 'in_progress') {
        throw new Error('This exam has already been submitted.')
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
      let loadedPairs: MatchingPairRow[] = []

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
        loadedPairs = (pairResult.data ?? []) as MatchingPairRow[]
      }

      const answerMap: Record<string, any> = {}
      for (const answer of answerResult.data ?? []) {
        answerMap[answer.question_id] = answer
      }

      setQuestions(loadedQuestions)
      setOptions(loadedOptions)
      setPairs(loadedPairs)
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

  async function submitStudentExam(auto = false) {
    if (!studentAttempt || !studentRunnerExam) return
    if (!auto && !window.confirm('Submit exam? You will not be able to change your answers afterwards.')) return
    try {
      setStudentSubmitting(true)
      setError('')
      const submittedAt = new Date().toISOString()
      const { error: submitError } = await supabase
        .from('exam_attempts')
        .update({ status: 'submitted', submitted_at: submittedAt, updated_at: submittedAt })
        .eq('id', studentAttempt.id)
        .eq('status', 'in_progress')
      if (submitError) throw submitError
      setStudentAttempt({ ...studentAttempt, status: 'submitted', submitted_at: submittedAt })
      await loadStudentWorkspace(userId)
      setStudentRunnerExam(null)
      setStudentAttempt(null)
      setQuestions([])
      setOptions([])
      setPairs([])
      setStudentAnswers({})
      setMessage(auto ? 'Time ended. Your exam was submitted.' : 'Exam submitted successfully.')
    } catch (err) {
      setError(errorMessage(err, 'Could not submit this exam.'))
    } finally {
      setStudentSubmitting(false)
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
    const [classResult, subjectResult, examResult, importResult] =
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
        supabase
          .from('exam_imports')
          .select('id,exam_id,class_id,subject_id,file_name,status,error_message,created_at')
          .eq('uploaded_by', uid)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

    if (classResult.error) throw classResult.error
    if (subjectResult.error) throw subjectResult.error
    if (examResult.error) throw examResult.error
    if (importResult.error) throw importResult.error

    const loadedClasses = (classResult.data ?? []) as ClassRow[]
    const loadedSubjects = (subjectResult.data ?? []) as SubjectRow[]

    setClasses(loadedClasses)
    setSubjects(loadedSubjects)
    setExams((examResult.data ?? []) as ExamRow[])
    setImports((importResult.data ?? []) as ImportRow[])

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
    setShowImporter(false)
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
      let loadedPairs: MatchingPairRow[] = []

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
            .from('exam_matching_pairs')
            .select('*')
            .in('question_id', matchingQuestionIds)
            .order('pair_order')

          if (pairError) {
            console.error('Could not load matching pairs:', pairError)
            setMessage(
              `The exam opened, but some matching items could not be loaded: ${errorMessage(
                pairError,
                'Unknown matching error.',
              )}`,
            )
          } else {
            loadedPairs = (pairData ?? []) as MatchingPairRow[]
          }
        }
      }

      setReviewExam(loadedExam as ExamRow)
      setQuestions(loadedQuestions)
      setOptions(loadedOptions)
      setPairs(loadedPairs)

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

  function updatePairLocal(
    id: string,
    patch: Partial<MatchingPairRow>,
  ) {
    setPairs((current) =>
      current.map((pair) =>
        pair.id === id ? { ...pair, ...patch } : pair,
      ),
    )
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
            option_key: option.option_key,
            option_text: option.option_text.trim(),
          })
          .eq('id', option.id)

        if (optionError) throw optionError
      }

      const questionPairs = pairs.filter(
        (pair) => pair.question_id === question.id,
      )

      for (const pair of questionPairs) {
        const { error: pairError } = await supabase
          .from('exam_matching_pairs')
          .update({
            left_key: pair.left_key,
            left_text: pair.left_text.trim(),
            right_key: pair.right_key,
            right_text: pair.right_text.trim(),
          })
          .eq('id', pair.id)

        if (pairError) throw pairError
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
          duration_minutes: reviewExam.duration_minutes,
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
        pairs.filter((pair) => pair.question_id === question.id).length === 0,
    )
    if (missingPairs.length > 0) {
      problems.push(
        `${missingPairs.length} matching question${missingPairs.length === 1 ? '' : 's'} need matching items.`,
      )
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
          duration_minutes: reviewExam.duration_minutes,
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
      const minutes = studentSecondsLeft === null ? null : Math.floor(studentSecondsLeft / 60)
      const seconds = studentSecondsLeft === null ? null : studentSecondsLeft % 60

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
              <span className="assignment-status published">
                {studentSecondsLeft === null
                  ? 'No time limit'
                  : `${minutes}:${String(seconds).padStart(2, '0')} remaining`}
              </span>
            </div>
            <div className="exam-review-summary">
              <span>{answeredCount}/{questions.length} answered</span>
              <span>{studentRunnerExam.total_marks} marks</span>
              <button
                className="primary"
                type="button"
                disabled={studentSubmitting}
                onClick={() => void submitStudentExam(false)}
              >
                {studentSubmitting ? 'Submitting…' : 'Submit exam'}
              </button>
            </div>
          </section>

          <section className="exam-question-list">
            {questions.map((question) => {
              const answer = studentAnswers[question.id] ?? {}
              const questionOptions = options.filter((item) => item.question_id === question.id)
              const questionPairs = pairs.filter((item) => item.question_id === question.id)
              const matchingResponse = Array.isArray(answer.matching_response)
                ? answer.matching_response
                : []

              return (
                <article className="panel exam-question-review-card" key={question.id}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{questionLabels[question.question_type]}</p>
                      <h3>Question {question.question_number}</h3>
                    </div>
                    <span>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span>
                  </div>

                  <p style={{ whiteSpace: 'pre-wrap' }}>{question.question_text}</p>

                  {(question.question_type === 'short_answer' ||
                    question.question_type === 'long_answer' ||
                    question.question_type === 'structured') && (
                    <textarea
                      rows={question.question_type === 'short_answer' ? 3 : 7}
                      value={answer.answer_text ?? ''}
                      placeholder="Type your answer here"
                      onChange={(event) =>
                        setStudentAnswers((current) => ({
                          ...current,
                          [question.id]: { ...answer, answer_text: event.target.value },
                        }))
                      }
                      onBlur={(event) =>
                        void saveStudentAnswer(question, { answer_text: event.target.value })
                      }
                    />
                  )}

                  {question.question_type === 'multiple_choice' && (
                    <div className="exam-options-review">
                      {questionOptions.map((option) => (
                        <label key={option.id}>
                          <input
                            type="radio"
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
                      {questionPairs
                        .filter((item) => item.side === 'left')
                        .map((left) => {
                          const leftKey = left.item_key ?? ''
                          const selected =
                            matchingResponse.find(
                              (item: any) => item?.left_key === leftKey,
                            )?.right_key ?? ''
                          const rightItems = questionPairs.filter(
                            (item) => item.side === 'right',
                          )
                          return (
                            <label key={left.id}>
                              <span>{left.item_text}</span>
                              <select
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
              Published exams from your enrolled classes appear here. Starting and
              answering the paper will be enabled in the next runner step.
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
            <div className="assignment-list">
              {visibleStudentExams.map((exam) => {
                const attempt = studentAttemptFor(exam.id)
                const state = studentExamState(exam)
                return (
                  <article className="assignment-item" key={exam.id}>
                    <div className="assignment-item-main">
                      <div className="assignment-item-title">
                        <strong>{exam.title}</strong>
                        <span className={`assignment-status ${state.className}`}>
                          {state.label}
                        </span>
                      </div>
                      <p>
                        {classNameForStudent(exam.class_id)} ·{' '}
                        {subjectNameForStudent(exam.subject_id)}
                      </p>
                      <div className="assignment-meta">
                        <span>
                          {exam.duration_minutes
                            ? `${exam.duration_minutes} minutes`
                            : 'No time limit'}
                        </span>
                        <span>{exam.total_marks} marks</span>
                        {attempt?.started_at && (
                          <span>
                            Started {new Date(attempt.started_at).toLocaleString()}
                          </span>
                        )}
                        {attempt?.submitted_at && (
                          <span>
                            Submitted {new Date(attempt.submitted_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="assignment-actions">
                      {exam.status === 'published' && !attempt && (
                        <button
                          className="primary"
                          type="button"
                          disabled={studentRunnerLoading}
                          onClick={() => void openStudentRunner(exam, null)}
                        >
                          {studentRunnerLoading ? 'Opening…' : 'Start exam'}
                        </button>
                      )}
                      {attempt?.status === 'in_progress' && (
                        <button
                          className="primary"
                          type="button"
                          disabled={studentRunnerLoading}
                          onClick={() => void openStudentRunner(exam, attempt)}
                        >
                          {studentRunnerLoading ? 'Opening…' : 'Continue exam'}
                        </button>
                      )}
                      {attempt && attempt.status !== 'in_progress' && (
                        <span className={`assignment-status ${state.className}`}>
                          {state.label}
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
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

  if (reviewExam) {
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
          onClick={() => setReviewExam(null)}
        >
          ← Back to Exams
        </button>

        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="panel exam-review-header">
          <div className="panel-heading">
            <div>
              <h3>Review reproduced exam</h3>
              <p>
                Check every question against the original paper before publishing.
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

            <label>
              <span>Duration (minutes)</span>
              <input
                type="number"
                min="1"
                value={reviewExam.duration_minutes ?? ''}
                onChange={(event) =>
                  setReviewExam({
                    ...reviewExam,
                    duration_minutes: event.target.value
                      ? Number(event.target.value)
                      : null,
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
              const questionPairs = pairs.filter(
                (pair) => pair.question_id === question.id,
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
                    question.question_type === 'dropdown') &&
                    questionOptions.length > 0 && (
                      <div className="exam-options-review">
                        <strong>Extracted options</strong>
                        {questionOptions.map((option) => (
                          <label key={option.id}>
                            <span>{option.option_key ?? '•'}</span>
                            <input
                              value={option.option_text}
                              onChange={(event) =>
                                updateOptionLocal(
                                  option.id,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}

                  {question.question_type === 'matching' &&
                    questionPairs.length > 0 && (
                      <div className="exam-matching-review">
                        <strong>Extracted matching items</strong>
                        {questionPairs.map((pair) => (
                          <div key={pair.id}>
                            <input
                              value={pair.left_text}
                              onChange={(event) =>
                                updatePairLocal(pair.id, {
                                  left_text: event.target.value,
                                })
                              }
                            />
                            <span>↔</span>
                            <input
                              value={pair.right_text}
                              onChange={(event) =>
                                updatePairLocal(pair.id, {
                                  right_text: event.target.value,
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}

                  <div className="exam-question-review-actions">
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
          <p className="eyebrow">EXAM STUDIO</p>
          <h2>Import and reproduce an exam paper.</h2>
          <p className="muted">
            OLP extracts the original paper into an editable draft for you to
            inspect before anything is published.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={() => setShowImporter(true)}
          disabled={!selectedSubjectId}
        >
          <Upload size={17} /> Import exam
        </button>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      <section className="panel exam-browser-panel">
        <div className="assignment-smart-nav">
          <div className="assignment-class-tabs">
            {classes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedClassId === item.id ? 'active' : ''}
                onClick={() => chooseClass(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="assignment-subject-tabs">
            {navigationSubjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                className={selectedSubjectId === subject.id ? 'active' : ''}
                onClick={() => setSelectedSubjectId(subject.id)}
              >
                {subject.name}
              </button>
            ))}
          </div>
        </div>

        {showImporter && (
          <div className="exam-import-card">
            <div className="panel-heading">
              <div>
                <h3>Import exam paper</h3>
                <p>
                  PDF is recommended for the best preservation of layout,
                  tables, graphs and diagrams.
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={resetImporter}
                disabled={uploading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="exam-import-grid">
              <label>
                <span>Optional title override</span>
                <input
                  value={titleOverride}
                  onChange={(event) => setTitleOverride(event.target.value)}
                  placeholder="Leave blank to detect from paper"
                  disabled={uploading}
                />
              </label>

              <label>
                <span>Optional duration override</span>
                <input
                  type="number"
                  min="1"
                  value={durationOverride}
                  onChange={(event) =>
                    setDurationOverride(event.target.value)
                  }
                  placeholder="Minutes"
                  disabled={uploading}
                />
              </label>

              <label className="exam-file-field">
                <span>Exam paper</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>

            <div className="exam-import-selected">
              <BookOpen size={16} />
              <span>
                <strong>
                  {classes.find((item) => item.id === selectedClassId)?.name ??
                    'Class'}
                </strong>
                {' · '}
                {subjects.find((item) => item.id === selectedSubjectId)?.name ??
                  'Subject'}
              </span>
            </div>

            {file && (
              <div className="exam-file-chip">
                <FileText size={15} />
                <span>{file.name}</span>
                <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
              </div>
            )}

            {progress && (
              <div className="exam-import-progress">
                <Sparkles size={17} />
                <span>{progress}</span>
              </div>
            )}

            <div className="exam-import-actions">
              <button
                className="primary"
                type="button"
                onClick={() => void importExam()}
                disabled={uploading || !file}
              >
                <Sparkles size={16} />
                {uploading
                  ? 'Extracting exam…'
                  : 'Extract Questions & Build Draft'}
              </button>
            </div>
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
                      {exam.duration_minutes
                        ? ` · ${exam.duration_minutes} minutes`
                        : ''}
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

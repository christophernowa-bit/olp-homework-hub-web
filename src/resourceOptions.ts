export type CurriculumOption = {
  name: string
  levels: string[]
}

export const curriculumOptions: CurriculumOption[] = [
  {
    name: 'Cambridge Primary',
    levels: [
      'Stage 1',
      'Stage 2',
      'Stage 3',
      'Stage 4',
      'Stage 5',
      'Stage 6',
    ],
  },
  {
    name: 'Cambridge Lower Secondary',
    levels: [
      'Stage 7',
      'Stage 8',
      'Stage 9',
    ],
  },
  {
    name: 'Cambridge IGCSE',
    levels: [
      'Year 10',
      'Year 11',
    ],
  },
  {
    name: 'Cambridge AS & A Level',
    levels: [
      'AS Level',
      'A Level',
    ],
  },
  {
    name: 'IB Primary Years Programme',
    levels: [
      'PYP 1',
      'PYP 2',
      'PYP 3',
      'PYP 4',
      'PYP 5',
      'PYP 6',
    ],
  },
  {
    name: 'IB Middle Years Programme',
    levels: [
      'MYP 1',
      'MYP 2',
      'MYP 3',
      'MYP 4',
      'MYP 5',
    ],
  },
  {
    name: 'IB Diploma Programme',
    levels: [
      'DP 1',
      'DP 2',
    ],
  },
  {
    name: 'Botswana PSLE',
    levels: [
      'Standard 1',
      'Standard 2',
      'Standard 3',
      'Standard 4',
      'Standard 5',
      'Standard 6',
      'Standard 7',
    ],
  },
  {
    name: 'Botswana Junior Certificate',
    levels: [
      'Form 1',
      'Form 2',
      'Form 3',
    ],
  },
  {
    name: 'Botswana Senior Secondary',
    levels: [
      'Form 4',
      'Form 5',
    ],
  },
  {
    name: 'South African CAPS',
    levels: [
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
      'Grade 8',
      'Grade 9',
      'Grade 10',
      'Grade 11',
      'Grade 12',
    ],
  },
  {
    name: 'Zimbabwe Primary',
    levels: [
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
    ],
  },
  {
    name: 'Zimbabwe Secondary',
    levels: [
      'Form 1',
      'Form 2',
      'Form 3',
      'Form 4',
      'Form 5',
      'Form 6',
    ],
  },
  {
    name: 'Other',
    levels: ['Other'],
  },
]

export const subjectOptions = [
  'English',
  'English as a Second Language',
  'Mathematics',
  'Science',
  'Biology',
  'Chemistry',
  'Physics',
  'Agriculture',
  'Geography',
  'History',
  'Social Studies',
  'Religious Education',
  'Setswana',
  'French',
  'German',
  'ICT',
  'Computer Science',
  'Business Studies',
  'Economics',
  'Accounting',
  'Physical Education',
  'Art & Design',
  'Music',
  'Other',
]

export const resourceTypeOptions = [
  { value: 'document', label: 'Document' },
  { value: 'worksheet', label: 'Worksheet' },
  { value: 'past_paper', label: 'Past Paper' },
  { value: 'mark_scheme', label: 'Mark Scheme' },
  { value: 'lesson_note', label: 'Lesson Notes' },
  { value: 'lesson_plan', label: 'Lesson Plan' },
  { value: 'scheme_of_work', label: 'Scheme of Work' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'revision', label: 'Revision Material' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
]

export const resourceYears = Array.from(
  { length: 30 },
  (_, index) => new Date().getFullYear() - index,
)

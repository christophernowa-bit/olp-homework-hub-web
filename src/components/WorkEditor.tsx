import { useMemo, useRef, useState } from 'react'
import { Hash, Plus, Sigma, Trash2, Type } from 'lucide-react'

export type WorkBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'question'; text: string }
  | { id: string; type: 'math'; text: string }
  | { id: string; type: 'answer'; questionId: string; text: string }

export type WorkDocument = {
  type: 'doc'
  version: number
  blocks: WorkBlock[]
}

export const emptyWorkDocument: WorkDocument = {
  type: 'doc',
  version: 1,
  blocks: [],
}

function newId() {
  return crypto.randomUUID()
}

export function workDocumentFromText(text: string | null | undefined): WorkDocument {
  const clean = text?.trim() ?? ''

  if (!clean) {
    return { type: 'doc', version: 1, blocks: [] }
  }

  return {
    type: 'doc',
    version: 1,
    blocks: [{ id: newId(), type: 'paragraph', text: clean }],
  }
}

export function normaliseWorkDocument(value: unknown, fallbackText = ''): WorkDocument {
  if (
    value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'doc' &&
    Array.isArray((value as { blocks?: unknown }).blocks)
  ) {
    const blocks = (value as { blocks: unknown[] }).blocks
      .map((block): WorkBlock | null => {
        if (!block || typeof block !== 'object') return null

        const item = block as {
          id?: unknown
          type?: unknown
          text?: unknown
          questionId?: unknown
        }

        if (
          item.type !== 'paragraph' &&
          item.type !== 'question' &&
          item.type !== 'math' &&
          item.type !== 'answer'
        ) {
          return null
        }

        const id = typeof item.id === 'string' && item.id ? item.id : newId()
        const text = typeof item.text === 'string' ? item.text : ''

        if (item.type === 'answer') {
          return {
            id,
            type: 'answer',
            questionId:
              typeof item.questionId === 'string' ? item.questionId : '',
            text,
          }
        }

        return {
          id,
          type: item.type,
          text,
        } as WorkBlock
      })
      .filter((block): block is WorkBlock => Boolean(block))

    return { type: 'doc', version: 1, blocks }
  }

  return workDocumentFromText(fallbackText)
}

export function workDocumentToPlainText(document: WorkDocument) {
  let questionNumber = 0

  return document.blocks
    .map((block) => {
      const text = block.text.trim()
      if (!text) return ''

      if (block.type === 'question') {
        questionNumber += 1
        return `${questionNumber}. ${text}`
      }

      if (block.type === 'answer') {
        return `Answer: ${text}`
      }

      return text
    })
    .filter(Boolean)
    .join('\n\n')
}

export function buildQuestionResponseDocument(
  source: WorkDocument,
  existing: WorkDocument,
): WorkDocument {
  const existingAnswers = new Map(
    existing.blocks
      .filter(
        (block): block is Extract<WorkBlock, { type: 'answer' }> =>
          block.type === 'answer' && Boolean(block.questionId),
      )
      .map((block) => [block.questionId, block]),
  )

  const questionBlocks = source.blocks.filter(
    (block): block is Extract<WorkBlock, { type: 'question' }> =>
      block.type === 'question',
  )

  if (questionBlocks.length === 0) return existing

  const answers: WorkBlock[] = questionBlocks.map((question) => {
    const old = existingAnswers.get(question.id)

    return old ?? {
      id: newId(),
      type: 'answer',
      questionId: question.id,
      text: '',
    }
  })

  const extras = existing.blocks.filter((block) => block.type !== 'answer')

  return {
    type: 'doc',
    version: 1,
    blocks: [...answers, ...extras],
  }
}

type Props = {
  value: WorkDocument
  onChange: (document: WorkDocument) => void
  readOnly?: boolean
  placeholder?: string
}

const mathSymbols = [
  '×',
  '÷',
  '±',
  '−',
  '=',
  '≠',
  '<',
  '>',
  '≤',
  '≥',
  '≈',
  '√',
  'π',
  '∞',
  '°',
  '%',
  '²',
  '³',
  '½',
  '¼',
  '¾',
  '⅓',
  '⅔',
  '∑',
  'Δ',
  'θ',
  'α',
  'β',
]

function renderMathExpression(text: string) {
  const parts = text.split(/([A-Za-z0-9.()+−-]+\/[A-Za-z0-9.()+−-]+)/g)

  return parts.map((part, index) => {
    const match = part.match(/^([A-Za-z0-9.()+−-]+)\/([A-Za-z0-9.()+−-]+)$/)

    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>
    }

    return (
      <span className="olp-fraction" key={`${part}-${index}`}>
        <span className="olp-fraction-top">{match[1]}</span>
        <span className="olp-fraction-bottom">{match[2]}</span>
      </span>
    )
  })
}

export function FormattedMath({ text }: { text: string }) {
  return <span className="olp-math-render">{renderMathExpression(text)}</span>
}

export default function WorkEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Start typing...',
}: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [previewMathId, setPreviewMathId] = useState<string | null>(null)
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const questionNumbers = useMemo(() => {
    const numbers = new Map<string, number>()
    let number = 0

    value.blocks.forEach((block) => {
      if (block.type === 'question') {
        number += 1
        numbers.set(block.id, number)
      }
    })

    return numbers
  }, [value.blocks])

  function updateBlocks(blocks: WorkBlock[]) {
    onChange({ type: 'doc', version: 1, blocks })
  }

  function addBlock(type: 'paragraph' | 'question' | 'math') {
    if (readOnly) return

    const block: WorkBlock = {
      id: newId(),
      type,
      text: '',
    }

    updateBlocks([...value.blocks, block])
    setPreviewMathId(null)

    window.setTimeout(() => {
      textareaRefs.current[block.id]?.focus()
    }, 0)
  }

  function updateBlock(id: string, nextText: string) {
    updateBlocks(
      value.blocks.map((block) =>
        block.id === id ? { ...block, text: nextText } : block,
      ),
    )
  }

  function removeBlock(id: string) {
    if (readOnly) return

    updateBlocks(value.blocks.filter((block) => block.id !== id))

    if (activeBlockId === id) setActiveBlockId(null)
    if (previewMathId === id) setPreviewMathId(null)
  }

  function insertSymbol(symbol: string) {
    if (readOnly) return

    let targetId = activeBlockId

    if (!targetId || !value.blocks.some((block) => block.id === targetId)) {
      const lastEditable = [...value.blocks]
        .reverse()
        .find((block) => block.type !== 'answer')

      if (lastEditable) {
        targetId = lastEditable.id
      } else {
        const block: WorkBlock = {
          id: newId(),
          type: 'math',
          text: symbol,
        }

        updateBlocks([...value.blocks, block])
        setActiveBlockId(block.id)
        setPreviewMathId(null)

        window.setTimeout(() => {
          textareaRefs.current[block.id]?.focus()
        }, 0)
        return
      }
    }

    const block = value.blocks.find((item) => item.id === targetId)
    if (!block || block.type === 'answer') return

    const input = textareaRefs.current[targetId]
    const start = input?.selectionStart ?? block.text.length
    const end = input?.selectionEnd ?? block.text.length
    const nextText =
      block.text.slice(0, start) + symbol + block.text.slice(end)

    updateBlock(targetId, nextText)

    window.setTimeout(() => {
      const nextInput = textareaRefs.current[targetId!]
      if (!nextInput) return

      const cursor = start + symbol.length
      nextInput.focus()
      nextInput.setSelectionRange(cursor, cursor)
    }, 0)
  }

  return (
    <div className={`work-editor${readOnly ? ' read-only' : ''}`}>
      {!readOnly && (
        <>
          <div className="work-editor-toolbar">
            <button type="button" onClick={() => addBlock('paragraph')}>
              <Type size={15} /> Text
            </button>
            <button type="button" onClick={() => addBlock('question')}>
              <Hash size={15} /> Numbered question
            </button>
            <button type="button" onClick={() => addBlock('math')}>
              <Sigma size={15} /> Maths line
            </button>
          </div>

          <div className="work-editor-symbols">
            <span>Maths symbols</span>
            <div>
              {mathSymbols.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => insertSymbol(symbol)}
                  title={`Insert ${symbol}`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {value.blocks.length === 0 ? (
        readOnly ? (
          <div className="work-editor-empty">No written content.</div>
        ) : (
          <button
            className="work-editor-start"
            type="button"
            onClick={() => addBlock('paragraph')}
          >
            <Plus size={16} /> Start typing
          </button>
        )
      ) : (
        <div className="work-editor-blocks">
          {value.blocks
            .filter((block) => block.type !== 'answer')
            .map((block) => {
              const showMathPreview =
                block.type === 'math' &&
                Boolean(block.text.trim()) &&
                (readOnly || previewMathId === block.id)

              return (
                <div className={`work-editor-block ${block.type}`} key={block.id}>
                  <div className="work-editor-block-label">
                    {block.type === 'paragraph' && 'Text'}
                    {block.type === 'question' &&
                      `Question ${questionNumbers.get(block.id) ?? ''}`}
                    {block.type === 'math' && 'Maths'}
                  </div>

                  {readOnly ? (
                    <div className="work-editor-read-value">
                      {block.type === 'question' && (
                        <strong>{questionNumbers.get(block.id)}.</strong>
                      )}
                      <span>
                        {block.type === 'math' ? (
                          <FormattedMath text={block.text || '—'} />
                        ) : (
                          block.text || '—'
                        )}
                      </span>
                    </div>
                  ) : showMathPreview ? (
                    <button
                      className="work-editor-math-preview"
                      type="button"
                      onClick={() => {
                        setPreviewMathId(null)
                        setActiveBlockId(block.id)
                        window.setTimeout(
                          () => textareaRefs.current[block.id]?.focus(),
                          0,
                        )
                      }}
                      title="Click to edit"
                    >
                      <FormattedMath text={block.text} />
                      <small>Click to edit</small>
                    </button>
                  ) : (
                    <>
                      <textarea
                        ref={(element) => {
                          textareaRefs.current[block.id] = element
                        }}
                        value={block.text}
                        onFocus={() => {
                          setActiveBlockId(block.id)
                          if (block.type === 'math') setPreviewMathId(null)
                        }}
                        onChange={(event) =>
                          updateBlock(block.id, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            block.type === 'math' &&
                            event.key === 'Enter' &&
                            !event.shiftKey
                          ) {
                            event.preventDefault()
                            setPreviewMathId(block.id)
                            event.currentTarget.blur()
                          }
                        }}
                        placeholder={
                          block.type === 'question'
                            ? 'Type the question...'
                            : block.type === 'math'
                              ? 'Example: 3/8 + 1/4, then press Enter'
                              : placeholder
                        }
                      />

                      <button
                        className="work-editor-delete"
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        title="Delete block"
                        aria-label="Delete block"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {!readOnly && (
        <p className="work-editor-hint">
          In a Maths line, type a fraction such as 3/8 and press Enter. It will
          display as a stacked fraction. Click the fraction again to edit it.
        </p>
      )}
    </div>
  )
}

type QuestionAnswerEditorProps = {
  assignment: WorkDocument
  response: WorkDocument
  onChange: (document: WorkDocument) => void
  readOnly?: boolean
}

export function QuestionAnswerEditor({
  assignment,
  response,
  onChange,
  readOnly = false,
}: QuestionAnswerEditorProps) {
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null)
  const answerRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const questionNumbers = useMemo(() => {
    const map = new Map<string, number>()
    let number = 0

    assignment.blocks.forEach((block) => {
      if (block.type === 'question') {
        number += 1
        map.set(block.id, number)
      }
    })

    return map
  }, [assignment.blocks])

  const answers = useMemo(
    () =>
      new Map(
        response.blocks
          .filter(
            (block): block is Extract<WorkBlock, { type: 'answer' }> =>
              block.type === 'answer',
          )
          .map((block) => [block.questionId, block]),
      ),
    [response.blocks],
  )

  function setAnswer(questionId: string, text: string) {
    const current = answers.get(questionId)

    if (current) {
      onChange({
        type: 'doc',
        version: 1,
        blocks: response.blocks.map((block) =>
          block.id === current.id ? { ...block, text } : block,
        ),
      })
      return
    }

    onChange({
      type: 'doc',
      version: 1,
      blocks: [
        ...response.blocks,
        {
          id: newId(),
          type: 'answer',
          questionId,
          text,
        },
      ],
    })
  }

  function insertAnswerSymbol(symbol: string) {
    if (readOnly || !activeAnswerId) return

    const answer = response.blocks.find(
      (block): block is Extract<WorkBlock, { type: 'answer' }> =>
        block.type === 'answer' && block.id === activeAnswerId,
    )

    if (!answer) return

    const input = answerRefs.current[answer.id]
    const start = input?.selectionStart ?? answer.text.length
    const end = input?.selectionEnd ?? answer.text.length
    const next =
      answer.text.slice(0, start) + symbol + answer.text.slice(end)

    setAnswer(answer.questionId, next)

    window.setTimeout(() => {
      const nextInput = answerRefs.current[answer.id]
      if (!nextInput) return
      const cursor = start + symbol.length
      nextInput.focus()
      nextInput.setSelectionRange(cursor, cursor)
    }, 0)
  }

  return (
    <div className={`question-answer-editor${readOnly ? ' read-only' : ''}`}>
      {!readOnly && (
        <div className="answer-math-toolbar">
          <span>Maths symbols for answers</span>
          <div>
            {mathSymbols.map((symbol) => (
              <button
                type="button"
                key={symbol}
                onClick={() => insertAnswerSymbol(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {assignment.blocks.map((block) => {
        if (block.type === 'paragraph') {
          return (
            <div className="qa-instruction" key={block.id}>
              {block.text}
            </div>
          )
        }

        if (block.type === 'math') {
          return (
            <div className="qa-math" key={block.id}>
              <FormattedMath text={block.text} />
            </div>
          )
        }

        if (block.type !== 'question') return null

        const answer = answers.get(block.id)
        const answerText = answer?.text ?? ''

        return (
          <section className="qa-question" key={block.id}>
            <div className="qa-question-prompt">
              <strong>{questionNumbers.get(block.id)}.</strong>
              <span>{block.text}</span>
            </div>

            <div className="qa-answer">
              <span className="qa-answer-label">Answer</span>

              {readOnly ? (
                <div className="qa-answer-read">
                  {answerText ? renderMathExpression(answerText) : 'No answer provided.'}
                </div>
              ) : (
                <>
                  <textarea
                    ref={(element) => {
                      if (answer) answerRefs.current[answer.id] = element
                    }}
                    value={answerText}
                    onFocus={() => {
                      if (answer) setActiveAnswerId(answer.id)
                    }}
                    onChange={(event) =>
                      setAnswer(block.id, event.target.value)
                    }
                    placeholder={`Write your answer to Question ${questionNumbers.get(block.id)} here...`}
                  />
                  {answerText.includes('/') && (
                    <div className="qa-math-preview">
                      <span>Maths preview:</span>
                      <FormattedMath text={answerText} />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

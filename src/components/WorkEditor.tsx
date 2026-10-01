import { useMemo, useRef, useState } from 'react'
import {
  Hash,
  ImagePlus,
  Plus,
  Sigma,
  Table2,
  Trash2,
  Type,
} from 'lucide-react'

export type WorkBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'question'; text: string }
  | { id: string; type: 'math'; text: string }
  | { id: string; type: 'table'; rows: string[][] }
  | { id: string; type: 'image'; src: string; caption: string }
  | { id: string; type: 'answer'; questionId: string; text: string }
  | { id: string; type: 'answerTable'; questionId: string; rows: string[][] }
  | { id: string; type: 'answerImage'; questionId: string; src: string; caption: string }

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

function blankTable(rows = 3, columns = 3) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ''),
  )
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
          rows?: unknown
          src?: unknown
          caption?: unknown
        }

        const id = typeof item.id === 'string' && item.id ? item.id : newId()
        const text = typeof item.text === 'string' ? item.text : ''
        const questionId =
          typeof item.questionId === 'string' ? item.questionId : ''
        const caption =
          typeof item.caption === 'string' ? item.caption : ''
        const src = typeof item.src === 'string' ? item.src : ''
        const rows =
          Array.isArray(item.rows) &&
          item.rows.every(
            (row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'),
          )
            ? (item.rows as string[][])
            : blankTable()

        if (
          item.type === 'paragraph' ||
          item.type === 'question' ||
          item.type === 'math'
        ) {
          return { id, type: item.type, text } as WorkBlock
        }

        if (item.type === 'table') {
          return { id, type: 'table', rows }
        }

        if (item.type === 'image') {
          return { id, type: 'image', src, caption }
        }

        if (item.type === 'answer') {
          return { id, type: 'answer', questionId, text }
        }

        if (item.type === 'answerTable') {
          return { id, type: 'answerTable', questionId, rows }
        }

        if (item.type === 'answerImage') {
          return { id, type: 'answerImage', questionId, src, caption }
        }

        return null
      })
      .filter((block): block is WorkBlock => Boolean(block))

    return { type: 'doc', version: 1, blocks }
  }

  return workDocumentFromText(fallbackText)
}

function tableToPlainText(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => cell.trim()).join(' | '))
    .join('\n')
    .trim()
}

export function workDocumentToPlainText(document: WorkDocument) {
  let questionNumber = 0

  return document.blocks
    .map((block) => {
      if (
        block.type === 'paragraph' ||
        block.type === 'math'
      ) {
        return block.text.trim()
      }

      if (block.type === 'question') {
        questionNumber += 1
        return block.text.trim()
          ? `${questionNumber}. ${block.text.trim()}`
          : ''
      }

      if (block.type === 'table' || block.type === 'answerTable') {
        return tableToPlainText(block.rows)
      }

      if (block.type === 'image' || block.type === 'answerImage') {
        return block.caption.trim() ? `[Diagram: ${block.caption.trim()}]` : '[Diagram]'
      }

      if (block.type === 'answer') {
        return block.text.trim() ? `Answer: ${block.text.trim()}` : ''
      }

      return ''
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

    return (
      old ?? {
        id: newId(),
        type: 'answer',
        questionId: question.id,
        text: '',
      }
    )
  })

  const extras = existing.blocks.filter(
    (block) =>
      block.type !== 'answer' ||
      !questionBlocks.some((question) => question.id === block.questionId),
  )

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

async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be pasted as diagrams.')
  }

  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the pasted diagram.'))
    }
    img.src = url
  })

  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the pasted diagram.')

  context.drawImage(source, 0, 0, width, height)

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const dataUrl =
    type === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.86)

  if (dataUrl.length > 2_800_000) {
    throw new Error('This diagram is too large. Please paste a smaller image.')
  }

  return dataUrl
}

function firstClipboardImage(event: React.ClipboardEvent) {
  return Array.from(event.clipboardData.items).find((item) =>
    item.type.startsWith('image/'),
  )
}

function EditableTable({
  rows,
  onChange,
  readOnly = false,
}: {
  rows: string[][]
  onChange: (rows: string[][]) => void
  readOnly?: boolean
}) {
  const safeRows = rows.length > 0 ? rows : blankTable()
  const columnCount = Math.max(1, ...safeRows.map((row) => row.length))

  function changeCell(rowIndex: number, columnIndex: number, value: string) {
    const next = safeRows.map((row) => {
      const padded = [...row]
      while (padded.length < columnCount) padded.push('')
      return padded
    })
    next[rowIndex][columnIndex] = value
    onChange(next)
  }

  function addRow() {
    onChange([
      ...safeRows.map((row) => [...row]),
      Array.from({ length: columnCount }, () => ''),
    ])
  }

  function addColumn() {
    onChange(safeRows.map((row) => [...row, '']))
  }

  function removeRow() {
    if (safeRows.length <= 1) return
    onChange(safeRows.slice(0, -1))
  }

  function removeColumn() {
    if (columnCount <= 1) return
    onChange(safeRows.map((row) => row.slice(0, columnCount - 1)))
  }

  return (
    <div className="olp-table-wrap">
      <div className="olp-table-scroll">
        <table className="olp-editor-table">
          <tbody>
            {safeRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <td key={columnIndex}>
                    {readOnly ? (
                      <span>{row[columnIndex] ?? ''}</span>
                    ) : (
                      <input
                        value={row[columnIndex] ?? ''}
                        onChange={(event) =>
                          changeCell(rowIndex, columnIndex, event.target.value)
                        }
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="olp-table-controls">
          <button type="button" onClick={addRow}>+ Row</button>
          <button type="button" onClick={addColumn}>+ Column</button>
          <button type="button" onClick={removeRow} disabled={safeRows.length <= 1}>− Row</button>
          <button type="button" onClick={removeColumn} disabled={columnCount <= 1}>− Column</button>
        </div>
      )}
    </div>
  )
}

export default function WorkEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Start typing...',
}: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [previewMathId, setPreviewMathId] = useState<string | null>(null)
  const [pasteError, setPasteError] = useState('')
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

  function addBlock(type: 'paragraph' | 'question' | 'math' | 'table') {
    if (readOnly) return

    const block: WorkBlock =
      type === 'table'
        ? { id: newId(), type: 'table', rows: blankTable() }
        : { id: newId(), type, text: '' }

    updateBlocks([...value.blocks, block])
    setPreviewMathId(null)

    if (type !== 'table') {
      window.setTimeout(() => {
        textareaRefs.current[block.id]?.focus()
      }, 0)
    }
  }

  async function addPastedImage(file: File) {
    try {
      setPasteError('')
      const src = await imageFileToDataUrl(file)
      updateBlocks([
        ...value.blocks,
        {
          id: newId(),
          type: 'image',
          src,
          caption: '',
        },
      ])
    } catch (error) {
      setPasteError(error instanceof Error ? error.message : 'Could not paste diagram.')
    }
  }

  async function handlePaste(event: React.ClipboardEvent) {
    if (readOnly) return

    const imageItem = firstClipboardImage(event)
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    event.preventDefault()
    await addPastedImage(file)
  }

  function updateBlock(id: string, nextText: string) {
    updateBlocks(
      value.blocks.map((block) =>
        block.id === id &&
        (block.type === 'paragraph' ||
          block.type === 'question' ||
          block.type === 'math')
          ? { ...block, text: nextText }
          : block,
      ),
    )
  }

  function updateTable(id: string, rows: string[][]) {
    updateBlocks(
      value.blocks.map((block) =>
        block.id === id && block.type === 'table'
          ? { ...block, rows }
          : block,
      ),
    )
  }

  function updateImageCaption(id: string, caption: string) {
    updateBlocks(
      value.blocks.map((block) =>
        block.id === id && block.type === 'image'
          ? { ...block, caption }
          : block,
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
        .find(
          (block) =>
            block.type === 'paragraph' ||
            block.type === 'question' ||
            block.type === 'math',
        )

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
        window.setTimeout(() => textareaRefs.current[block.id]?.focus(), 0)
        return
      }
    }

    const block = value.blocks.find((item) => item.id === targetId)
    if (
      !block ||
      (block.type !== 'paragraph' &&
        block.type !== 'question' &&
        block.type !== 'math')
    ) {
      return
    }

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
    <div
      className={`work-editor${readOnly ? ' read-only' : ''}`}
      onPaste={handlePaste}
    >
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
            <button type="button" onClick={() => addBlock('table')}>
              <Table2 size={15} /> Table
            </button>
          </div>

          <div
            className="work-editor-paste-zone"
            tabIndex={0}
            onPaste={handlePaste}
          >
            <ImagePlus size={17} />
            <span>
              <strong>Paste diagram</strong>
              <small>Copy an image, click here and press Ctrl+V.</small>
            </span>
          </div>

          {pasteError && <p className="work-editor-error">{pasteError}</p>}

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
            .filter(
              (block) =>
                block.type !== 'answer' &&
                block.type !== 'answerTable' &&
                block.type !== 'answerImage',
            )
            .map((block) => {
              if (block.type === 'table') {
                return (
                  <div className="work-editor-block table" key={block.id}>
                    <div className="work-editor-block-label">Table</div>
                    <EditableTable
                      rows={block.rows}
                      onChange={(rows) => updateTable(block.id, rows)}
                      readOnly={readOnly}
                    />
                    {!readOnly && (
                      <button
                        className="work-editor-delete"
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        title="Delete table"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              }

              if (block.type === 'image') {
                return (
                  <div className="work-editor-block image" key={block.id}>
                    <div className="work-editor-block-label">Diagram</div>
                    <img className="work-editor-image" src={block.src} alt={block.caption || 'Pasted diagram'} />
                    {readOnly ? (
                      block.caption && <p className="work-editor-image-caption">{block.caption}</p>
                    ) : (
                      <>
                        <input
                          className="work-editor-caption-input"
                          value={block.caption}
                          onChange={(event) =>
                            updateImageCaption(block.id, event.target.value)
                          }
                          placeholder="Optional diagram caption"
                        />
                        <button
                          className="work-editor-delete"
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          title="Delete diagram"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )
              }

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
                        onPaste={handlePaste}
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
          Use Table for editable rows and columns. To add a diagram, copy the
          image and press Ctrl+V anywhere inside this editor.
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
  const [answerError, setAnswerError] = useState('')
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
        { id: newId(), type: 'answer', questionId, text },
      ],
    })
  }

  function answerTables(questionId: string) {
    return response.blocks.filter(
      (block): block is Extract<WorkBlock, { type: 'answerTable' }> =>
        block.type === 'answerTable' && block.questionId === questionId,
    )
  }

  function answerImages(questionId: string) {
    return response.blocks.filter(
      (block): block is Extract<WorkBlock, { type: 'answerImage' }> =>
        block.type === 'answerImage' && block.questionId === questionId,
    )
  }

  function addAnswerTable(questionId: string) {
    if (readOnly) return
    onChange({
      type: 'doc',
      version: 1,
      blocks: [
        ...response.blocks,
        {
          id: newId(),
          type: 'answerTable',
          questionId,
          rows: blankTable(),
        },
      ],
    })
  }

  function updateAnswerTable(id: string, rows: string[][]) {
    onChange({
      type: 'doc',
      version: 1,
      blocks: response.blocks.map((block) =>
        block.id === id && block.type === 'answerTable'
          ? { ...block, rows }
          : block,
      ),
    })
  }

  function removeAnswerBlock(id: string) {
    if (readOnly) return
    onChange({
      type: 'doc',
      version: 1,
      blocks: response.blocks.filter((block) => block.id !== id),
    })
  }

  async function addAnswerImage(questionId: string, file: File) {
    try {
      setAnswerError('')
      const src = await imageFileToDataUrl(file)
      onChange({
        type: 'doc',
        version: 1,
        blocks: [
          ...response.blocks,
          {
            id: newId(),
            type: 'answerImage',
            questionId,
            src,
            caption: '',
          },
        ],
      })
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : 'Could not paste diagram.')
    }
  }

  function updateAnswerImageCaption(id: string, caption: string) {
    onChange({
      type: 'doc',
      version: 1,
      blocks: response.blocks.map((block) =>
        block.id === id && block.type === 'answerImage'
          ? { ...block, caption }
          : block,
      ),
    })
  }

  async function handleAnswerPaste(
    event: React.ClipboardEvent,
    questionId: string,
  ) {
    const imageItem = firstClipboardImage(event)
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    event.preventDefault()
    await addAnswerImage(questionId, file)
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

      {answerError && <p className="work-editor-error">{answerError}</p>}

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

        if (block.type === 'table') {
          return (
            <div className="qa-source-table" key={block.id}>
              <EditableTable rows={block.rows} onChange={() => {}} readOnly />
            </div>
          )
        }

        if (block.type === 'image') {
          return (
            <figure className="qa-source-image" key={block.id}>
              <img src={block.src} alt={block.caption || 'Assignment diagram'} />
              {block.caption && <figcaption>{block.caption}</figcaption>}
            </figure>
          )
        }

        if (block.type !== 'question') return null

        const answer = answers.get(block.id)
        const answerText = answer?.text ?? ''
        const tables = answerTables(block.id)
        const images = answerImages(block.id)

        return (
          <section className="qa-question" key={block.id}>
            <div className="qa-question-prompt">
              <strong>{questionNumbers.get(block.id)}.</strong>
              <span>{block.text}</span>
            </div>

            <div className="qa-answer">
              <span className="qa-answer-label">Answer</span>

              {readOnly ? (
                <>
                  <div className="qa-answer-read">
                    {answerText
                      ? renderMathExpression(answerText)
                      : 'No written answer provided.'}
                  </div>

                  {tables.map((table) => (
                    <EditableTable
                      key={table.id}
                      rows={table.rows}
                      onChange={() => {}}
                      readOnly
                    />
                  ))}

                  {images.map((image) => (
                    <figure className="qa-answer-image" key={image.id}>
                      <img src={image.src} alt={image.caption || 'Student diagram'} />
                      {image.caption && <figcaption>{image.caption}</figcaption>}
                    </figure>
                  ))}
                </>
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
                    onPaste={(event) => handleAnswerPaste(event, block.id)}
                    placeholder={`Write your answer to Question ${questionNumbers.get(block.id)} here...`}
                  />

                  <div className="qa-answer-tools">
                    <button
                      type="button"
                      onClick={() => addAnswerTable(block.id)}
                    >
                      <Table2 size={14} /> Insert table
                    </button>
                    <span>
                      <ImagePlus size={14} /> Paste a diagram with Ctrl+V in the answer box
                    </span>
                  </div>

                  {answerText.includes('/') && (
                    <div className="qa-math-preview">
                      <span>Maths preview:</span>
                      <FormattedMath text={answerText} />
                    </div>
                  )}

                  {tables.map((table) => (
                    <div className="qa-answer-attachment" key={table.id}>
                      <EditableTable
                        rows={table.rows}
                        onChange={(rows) => updateAnswerTable(table.id, rows)}
                      />
                      <button
                        className="qa-remove-attachment"
                        type="button"
                        onClick={() => removeAnswerBlock(table.id)}
                      >
                        <Trash2 size={13} /> Remove table
                      </button>
                    </div>
                  ))}

                  {images.map((image) => (
                    <div className="qa-answer-attachment" key={image.id}>
                      <img className="qa-answer-image-preview" src={image.src} alt={image.caption || 'Pasted student diagram'} />
                      <input
                        className="work-editor-caption-input"
                        value={image.caption}
                        onChange={(event) =>
                          updateAnswerImageCaption(image.id, event.target.value)
                        }
                        placeholder="Optional diagram caption"
                      />
                      <button
                        className="qa-remove-attachment"
                        type="button"
                        onClick={() => removeAnswerBlock(image.id)}
                      >
                        <Trash2 size={13} /> Remove diagram
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

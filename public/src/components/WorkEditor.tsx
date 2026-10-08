import { useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Hash,
  ImagePlus,
  Plus,
  Sigma,
  Table2,
  Trash2,
  Type,
} from 'lucide-react'

export type GraphPoint = {
  x: string
  y: string
}

export type GraphSpec = {
  graphType: 'coordinate' | 'line' | 'bar'
  title: string
  xLabel: string
  yLabel: string
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  gridStep: number
  connectPoints: boolean
  points: GraphPoint[]
}

export const blankGraphSpec = (): GraphSpec => ({
  graphType: 'coordinate',
  title: '',
  xLabel: 'x',
  yLabel: 'y',
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  gridStep: 1,
  connectPoints: false,
  points: [
    { x: '', y: '' },
    { x: '', y: '' },
    { x: '', y: '' },
  ],
})

export type WorkBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'question'; text: string }
  | { id: string; type: 'math'; text: string }
  | { id: string; type: 'table'; rows: string[][] }
  | { id: string; type: 'image'; src: string; caption: string }
  | { id: string; type: 'graph'; graph: GraphSpec }
  | { id: string; type: 'answer'; questionId: string; text: string }
  | { id: string; type: 'answerTable'; questionId: string; rows: string[][] }
  | { id: string; type: 'answerImage'; questionId: string; src: string; caption: string }
  | { id: string; type: 'answerGraph'; questionId: string; graph: GraphSpec }

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

function normaliseGraphSpec(value: unknown): GraphSpec {
  const fallback = blankGraphSpec()
  if (!value || typeof value !== 'object') return fallback

  const item = value as Partial<GraphSpec>
  const points = Array.isArray(item.points)
    ? item.points.map((point) => ({
        x:
          point && typeof point === 'object' && typeof (point as GraphPoint).x === 'string'
            ? (point as GraphPoint).x
            : '',
        y:
          point && typeof point === 'object' && typeof (point as GraphPoint).y === 'string'
            ? (point as GraphPoint).y
            : '',
      }))
    : fallback.points

  const safeNumber = (value: unknown, fallbackValue: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallbackValue

  const graphType =
    item.graphType === 'line' || item.graphType === 'bar'
      ? item.graphType
      : 'coordinate'

  const xMin = safeNumber(item.xMin, fallback.xMin)
  const xMaxRaw = safeNumber(item.xMax, fallback.xMax)
  const yMin = safeNumber(item.yMin, fallback.yMin)
  const yMaxRaw = safeNumber(item.yMax, fallback.yMax)

  return {
    graphType,
    title: typeof item.title === 'string' ? item.title : '',
    xLabel: typeof item.xLabel === 'string' ? item.xLabel : 'x',
    yLabel: typeof item.yLabel === 'string' ? item.yLabel : 'y',
    xMin,
    xMax: xMaxRaw > xMin ? xMaxRaw : xMin + 10,
    yMin,
    yMax: yMaxRaw > yMin ? yMaxRaw : yMin + 10,
    gridStep: Math.max(0.1, safeNumber(item.gridStep, 1)),
    connectPoints: Boolean(item.connectPoints),
    points: points.length > 0 ? points : fallback.points,
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
          graph?: unknown
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

        if (item.type === 'graph') {
          return { id, type: 'graph', graph: normaliseGraphSpec(item.graph) }
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

        if (item.type === 'answerGraph') {
          return {
            id,
            type: 'answerGraph',
            questionId,
            graph: normaliseGraphSpec(item.graph),
          }
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

      if (block.type === 'graph' || block.type === 'answerGraph') {
        return block.graph.title.trim()
          ? `[Graph: ${block.graph.title.trim()}]`
          : '[Graph]'
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


function GraphEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: GraphSpec
  onChange: (graph: GraphSpec) => void
  readOnly?: boolean
}) {
  const width = 620
  const height = 360
  const padLeft = 58
  const padRight = 24
  const padTop = 30
  const padBottom = 52
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const numericPoints = value.points
    .map((point, index) => ({
      index,
      x: Number(point.x),
      y: Number(point.y),
      label: point.x,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))

  const xRange = Math.max(0.0001, value.xMax - value.xMin)
  const yRange = Math.max(0.0001, value.yMax - value.yMin)

  const xPixel = (x: number) =>
    padLeft + ((x - value.xMin) / xRange) * plotWidth
  const yPixel = (y: number) =>
    padTop + (1 - (y - value.yMin) / yRange) * plotHeight

  const xTicks: number[] = []
  const yTicks: number[] = []
  const step = Math.max(0.1, value.gridStep || 1)

  for (
    let tick = Math.ceil(value.xMin / step) * step, guard = 0;
    tick <= value.xMax + step * 0.001 && guard < 60;
    tick += step, guard += 1
  ) {
    xTicks.push(Number(tick.toFixed(8)))
  }

  for (
    let tick = Math.ceil(value.yMin / step) * step, guard = 0;
    tick <= value.yMax + step * 0.001 && guard < 60;
    tick += step, guard += 1
  ) {
    yTicks.push(Number(tick.toFixed(8)))
  }

  const linePoints = numericPoints
    .map((point) => `${xPixel(point.x)},${yPixel(point.y)}`)
    .join(' ')

  const bars =
    value.graphType === 'bar'
      ? numericPoints.map((point, position) => {
          const count = Math.max(1, numericPoints.length)
          const slot = plotWidth / count
          const barWidth = Math.min(54, slot * 0.62)
          const baseline = yPixel(Math.max(value.yMin, Math.min(0, value.yMax)))
          const top = yPixel(point.y)
          const x = padLeft + position * slot + (slot - barWidth) / 2
          return {
            ...point,
            xPos: x,
            width: barWidth,
            yPos: Math.min(top, baseline),
            height: Math.abs(baseline - top),
            labelX: x + barWidth / 2,
          }
        })
      : []

  function update<K extends keyof GraphSpec>(key: K, next: GraphSpec[K]) {
    onChange({ ...value, [key]: next })
  }

  function updatePoint(index: number, key: keyof GraphPoint, next: string) {
    const points = value.points.map((point, pointIndex) =>
      pointIndex === index ? { ...point, [key]: next } : point,
    )
    update('points', points)
  }

  function addPoint() {
    update('points', [...value.points, { x: '', y: '' }])
  }

  function removePoint(index: number) {
    if (value.points.length <= 1) return
    update(
      'points',
      value.points.filter((_, pointIndex) => pointIndex !== index),
    )
  }

  return (
    <div className="olp-graph-editor">
      {!readOnly && (
        <div className="olp-graph-settings">
          <label>
            <span>Graph type</span>
            <select
              value={value.graphType}
              onChange={(event) =>
                update(
                  'graphType',
                  event.target.value as GraphSpec['graphType'],
                )
              }
            >
              <option value="coordinate">Coordinate plot</option>
              <option value="line">Line graph</option>
              <option value="bar">Bar graph</option>
            </select>
          </label>

          <label className="olp-graph-title-field">
            <span>Title</span>
            <input
              value={value.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="e.g. Temperature over time"
            />
          </label>

          <label>
            <span>X-axis label</span>
            <input
              value={value.xLabel}
              onChange={(event) => update('xLabel', event.target.value)}
            />
          </label>

          <label>
            <span>Y-axis label</span>
            <input
              value={value.yLabel}
              onChange={(event) => update('yLabel', event.target.value)}
            />
          </label>

          <label>
            <span>X min</span>
            <input
              type="number"
              value={value.xMin}
              onChange={(event) => update('xMin', Number(event.target.value))}
            />
          </label>

          <label>
            <span>X max</span>
            <input
              type="number"
              value={value.xMax}
              onChange={(event) => update('xMax', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Y min</span>
            <input
              type="number"
              value={value.yMin}
              onChange={(event) => update('yMin', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Y max</span>
            <input
              type="number"
              value={value.yMax}
              onChange={(event) => update('yMax', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Grid step</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={value.gridStep}
              onChange={(event) =>
                update('gridStep', Math.max(0.1, Number(event.target.value)))
              }
            />
          </label>

          {value.graphType !== 'bar' && (
            <label className="olp-graph-connect">
              <input
                type="checkbox"
                checked={value.connectPoints || value.graphType === 'line'}
                onChange={(event) =>
                  update('connectPoints', event.target.checked)
                }
              />
              <span>Connect plotted points</span>
            </label>
          )}
        </div>
      )}

      {value.title && <h4 className="olp-graph-title">{value.title}</h4>}

      <div className="olp-graph-canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={value.title || 'Generated graph'}
        >
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            className="olp-graph-background"
          />

          {xTicks.map((tick) => {
            const x = xPixel(tick)
            return (
              <g key={`x-${tick}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={padTop}
                  y2={padTop + plotHeight}
                  className="olp-graph-grid"
                />
                <text
                  x={x}
                  y={padTop + plotHeight + 18}
                  textAnchor="middle"
                  className="olp-graph-tick"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {yTicks.map((tick) => {
            const y = yPixel(tick)
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={padLeft}
                  x2={padLeft + plotWidth}
                  y1={y}
                  y2={y}
                  className="olp-graph-grid"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="olp-graph-tick"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {value.xMin <= 0 && value.xMax >= 0 && (
            <line
              x1={xPixel(0)}
              x2={xPixel(0)}
              y1={padTop}
              y2={padTop + plotHeight}
              className="olp-graph-axis"
            />
          )}

          {value.yMin <= 0 && value.yMax >= 0 && (
            <line
              x1={padLeft}
              x2={padLeft + plotWidth}
              y1={yPixel(0)}
              y2={yPixel(0)}
              className="olp-graph-axis"
            />
          )}

          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            className="olp-graph-border"
          />

          {value.graphType === 'bar' ? (
            bars.map((bar) => (
              <g key={`bar-${bar.index}`}>
                <rect
                  x={bar.xPos}
                  y={bar.yPos}
                  width={bar.width}
                  height={bar.height}
                  className="olp-graph-bar"
                />
                <text
                  x={bar.labelX}
                  y={padTop + plotHeight + 34}
                  textAnchor="middle"
                  className="olp-graph-category"
                >
                  {bar.label}
                </text>
              </g>
            ))
          ) : (
            <>
              {(value.connectPoints || value.graphType === 'line') &&
                numericPoints.length > 1 && (
                  <polyline
                    points={linePoints}
                    className="olp-graph-line"
                  />
                )}

              {numericPoints.map((point) => (
                <circle
                  key={`point-${point.index}`}
                  cx={xPixel(point.x)}
                  cy={yPixel(point.y)}
                  r="4.5"
                  className="olp-graph-point"
                />
              ))}
            </>
          )}

          <text
            x={padLeft + plotWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="olp-graph-axis-label"
          >
            {value.xLabel}
          </text>

          <text
            transform={`translate(16 ${padTop + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            className="olp-graph-axis-label"
          >
            {value.yLabel}
          </text>
        </svg>
      </div>

      {!readOnly && (
        <div className="olp-graph-data">
          <div className="olp-graph-data-heading">
            <strong>
              {value.graphType === 'bar'
                ? 'Bar data'
                : 'Coordinates'}
            </strong>
            <button type="button" onClick={addPoint}>
              + {value.graphType === 'bar' ? 'Bar' : 'Point'}
            </button>
          </div>

          <div className="olp-graph-data-table">
            <div className="olp-graph-data-row header">
              <span>
                {value.graphType === 'bar' ? 'Category / x value' : 'x'}
              </span>
              <span>y</span>
              <span />
            </div>

            {value.points.map((point, index) => (
              <div className="olp-graph-data-row" key={index}>
                <input
                  value={point.x}
                  onChange={(event) =>
                    updatePoint(index, 'x', event.target.value)
                  }
                  placeholder={
                    value.graphType === 'bar'
                      ? `${index + 1}`
                      : 'x'
                  }
                />
                <input
                  value={point.y}
                  onChange={(event) =>
                    updatePoint(index, 'y', event.target.value)
                  }
                  placeholder="y"
                />
                <button
                  type="button"
                  onClick={() => removePoint(index)}
                  disabled={value.points.length <= 1}
                  aria-label="Remove data row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <p className="olp-graph-note">
            Coordinate and line graphs use the axis limits and grid scale above.
            For bar graphs, enter numeric x positions such as 1, 2, 3 and use
            the title or surrounding question to name the categories.
          </p>
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

  function addBlock(type: 'paragraph' | 'question' | 'math' | 'table' | 'graph') {
    if (readOnly) return

    const block: WorkBlock =
      type === 'table'
        ? { id: newId(), type: 'table', rows: blankTable() }
        : type === 'graph'
          ? { id: newId(), type: 'graph', graph: blankGraphSpec() }
          : { id: newId(), type, text: '' }

    updateBlocks([...value.blocks, block])
    setPreviewMathId(null)

    if (type !== 'table' && type !== 'graph') {
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

  function updateGraph(id: string, graph: GraphSpec) {
    updateBlocks(
      value.blocks.map((block) =>
        block.id === id && block.type === 'graph'
          ? { ...block, graph }
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
            <button type="button" onClick={() => addBlock('graph')}>
              <BarChart3 size={15} /> Graph
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
                block.type !== 'answerImage' &&
                block.type !== 'answerGraph',
            )
            .map((block) => {
              if (block.type === 'graph') {
                return (
                  <div className="work-editor-block graph" key={block.id}>
                    <div className="work-editor-block-label">Graph</div>
                    <GraphEditor
                      value={block.graph}
                      onChange={(graph) => updateGraph(block.id, graph)}
                      readOnly={readOnly}
                    />
                    {!readOnly && (
                      <button
                        className="work-editor-delete"
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        title="Delete graph"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              }

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

  function answerGraphs(questionId: string) {
    return response.blocks.filter(
      (block): block is Extract<WorkBlock, { type: 'answerGraph' }> =>
        block.type === 'answerGraph' && block.questionId === questionId,
    )
  }

  function addAnswerGraph(questionId: string) {
    if (readOnly) return
    onChange({
      type: 'doc',
      version: 1,
      blocks: [
        ...response.blocks,
        {
          id: newId(),
          type: 'answerGraph',
          questionId,
          graph: blankGraphSpec(),
        },
      ],
    })
  }

  function updateAnswerGraph(id: string, graph: GraphSpec) {
    onChange({
      type: 'doc',
      version: 1,
      blocks: response.blocks.map((block) =>
        block.id === id && block.type === 'answerGraph'
          ? { ...block, graph }
          : block,
      ),
    })
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

        if (block.type === 'graph') {
          return (
            <div className="qa-source-graph" key={block.id}>
              <GraphEditor
                value={block.graph}
                onChange={() => {}}
                readOnly
              />
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
        const graphs = answerGraphs(block.id)

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

                  {graphs.map((graph) => (
                    <div className="qa-answer-graph" key={graph.id}>
                      <GraphEditor
                        value={graph.graph}
                        onChange={() => {}}
                        readOnly
                      />
                    </div>
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
                    <button
                      type="button"
                      onClick={() => addAnswerGraph(block.id)}
                    >
                      <BarChart3 size={14} /> Insert graph
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

                  {graphs.map((graph) => (
                    <div className="qa-answer-attachment" key={graph.id}>
                      <GraphEditor
                        value={graph.graph}
                        onChange={(nextGraph) =>
                          updateAnswerGraph(graph.id, nextGraph)
                        }
                      />
                      <button
                        className="qa-remove-attachment"
                        type="button"
                        onClick={() => removeAnswerBlock(graph.id)}
                      >
                        <Trash2 size={13} /> Remove graph
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

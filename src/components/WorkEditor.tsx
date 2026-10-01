import { useMemo, useRef, useState } from 'react'
import { Hash, Plus, Sigma, Trash2, Type } from 'lucide-react'

export type WorkBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'question'; text: string }
  | { id: string; type: 'math'; text: string }

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
  if (!clean) return { type: 'doc', version: 1, blocks: [] }
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
        const item = block as { id?: unknown; type?: unknown; text?: unknown }
        if (item.type !== 'paragraph' && item.type !== 'question' && item.type !== 'math') return null
        return {
          id: typeof item.id === 'string' && item.id ? item.id : newId(),
          type: item.type,
          text: typeof item.text === 'string' ? item.text : '',
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
      return text
    })
    .filter(Boolean)
    .join('\n\n')
}

type Props = {
  value: WorkDocument
  onChange: (document: WorkDocument) => void
  readOnly?: boolean
  placeholder?: string
}

const mathSymbols = ['×','÷','±','−','=','≠','<','>','≤','≥','≈','√','π','∞','°','%','²','³','½','¼','¾','⅓','⅔','∑','Δ','θ','α','β']

export default function WorkEditor({ value, onChange, readOnly = false, placeholder = 'Start typing...' }: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
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

  function addBlock(type: WorkBlock['type']) {
    if (readOnly) return
    const block: WorkBlock = { id: newId(), type, text: '' }
    updateBlocks([...value.blocks, block])
    window.setTimeout(() => textareaRefs.current[block.id]?.focus(), 0)
  }

  function updateBlock(id: string, nextText: string) {
    updateBlocks(value.blocks.map((block) => block.id === id ? { ...block, text: nextText } : block))
  }

  function removeBlock(id: string) {
    if (readOnly) return
    updateBlocks(value.blocks.filter((block) => block.id !== id))
    if (activeBlockId === id) setActiveBlockId(null)
  }

  function insertSymbol(symbol: string) {
    if (readOnly) return
    let targetId = activeBlockId

    if (!targetId || !value.blocks.some((block) => block.id === targetId)) {
      const last = value.blocks[value.blocks.length - 1]
      if (last) targetId = last.id
      else {
        const block: WorkBlock = { id: newId(), type: 'math', text: symbol }
        updateBlocks([block])
        setActiveBlockId(block.id)
        window.setTimeout(() => textareaRefs.current[block.id]?.focus(), 0)
        return
      }
    }

    const block = value.blocks.find((item) => item.id === targetId)
    if (!block || !targetId) return
    const input = textareaRefs.current[targetId]
    const start = input?.selectionStart ?? block.text.length
    const end = input?.selectionEnd ?? block.text.length
    const nextText = block.text.slice(0, start) + symbol + block.text.slice(end)
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
            <button type="button" onClick={() => addBlock('paragraph')}><Type size={15} /> Text</button>
            <button type="button" onClick={() => addBlock('question')}><Hash size={15} /> Numbered question</button>
            <button type="button" onClick={() => addBlock('math')}><Sigma size={15} /> Maths line</button>
          </div>

          <div className="work-editor-symbols">
            <span>Maths symbols</span>
            <div>
              {mathSymbols.map((symbol) => (
                <button key={symbol} type="button" onClick={() => insertSymbol(symbol)} title={`Insert ${symbol}`}>{symbol}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {value.blocks.length === 0 ? (
        readOnly ? <div className="work-editor-empty">No written content.</div> : (
          <button className="work-editor-start" type="button" onClick={() => addBlock('paragraph')}><Plus size={16} /> Start typing</button>
        )
      ) : (
        <div className="work-editor-blocks">
          {value.blocks.map((block) => (
            <div className={`work-editor-block ${block.type}`} key={block.id}>
              <div className="work-editor-block-label">
                {block.type === 'paragraph' && 'Text'}
                {block.type === 'question' && `Question ${questionNumbers.get(block.id) ?? ''}`}
                {block.type === 'math' && 'Maths'}
              </div>

              {readOnly ? (
                <div className="work-editor-read-value">
                  {block.type === 'question' && <strong>{questionNumbers.get(block.id)}.</strong>}
                  <span>{block.text || '—'}</span>
                </div>
              ) : (
                <>
                  <textarea
                    ref={(element) => { textareaRefs.current[block.id] = element }}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChange={(event) => updateBlock(block.id, event.target.value)}
                    placeholder={block.type === 'question' ? 'Type the question...' : block.type === 'math' ? 'Type an expression or use the maths symbols above...' : placeholder}
                  />
                  <button className="work-editor-delete" type="button" onClick={() => removeBlock(block.id)} title="Delete block" aria-label="Delete block"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && <p className="work-editor-hint">Copy and paste works normally inside every text box. Numbered questions are renumbered automatically.</p>}
    </div>
  )
}

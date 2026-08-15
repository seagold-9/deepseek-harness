// AssistantMarkdown: renders assistant blocks in order — markdown text body,
// reasoning as the figma Think summary row (expand = indented gray text),
// other-block JSON fallback. Tool-call heads are NOT rendered here: the chat
// view groups them into tool rows through its keyed toolview slot (figma
// step-summary flow). Shared by finalized nodes and the streaming partial;
// the turn-level loading dots live in the chat view's tail, not here.
// Finalized content (text) nodes append IconActions once their turn ends
// (`time` is omitted for mid-turn narration and while the turn still runs);
// their branch action is enabled only when the node is also the completed
// turn's transcript tail. Think / tool-head-only nodes stay chrome-free.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { AssistantBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { IconCheckOutline16, JsonBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownFileMentions } from '@deepseek-ai/dsh-client-ui-primitives'
import { ImageGallery, type ImageLoader } from '@deepseek-ai/dsh-client-ui-attachment'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { messageImageLabels } from '../image-labels.ts'
import { ReasoningRow } from './ReasoningRow.tsx'
import css from './AssistantMarkdown.module.css'

interface FixedRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface ResponseSelection {
  readonly text: string
  readonly anchor: FixedRect
  readonly left: number
  readonly top: number
  readonly mode: 'menu' | 'editor'
}

function fixedRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): FixedRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function popoverPosition(bounds: FixedRect, width: number, height: number): Pick<FixedRect, 'left' | 'top'> {
  const availableWidth = Math.min(width, window.innerWidth - 24)
  const left = Math.min(
    Math.max(12, bounds.left + bounds.width / 2 - availableWidth / 2),
    window.innerWidth - availableWidth - 12,
  )
  const top = bounds.top + bounds.height + height + 12 <= window.innerHeight
    ? bounds.top + bounds.height + 8
    : Math.max(12, bounds.top - height - 8)
  return { left, top }
}

export interface AssistantMarkdownProps {
  blocks: readonly AssistantBlock[]
  streaming: boolean
  /** Frozen partial of an aborted turn: rendered with a stopped marker. */
  interrupted?: boolean | undefined
  /** Session-authorized durable image loader. */
  loadImage?: ImageLoader
  /** Resolved prose file mentions for this Assistant's closing turn. */
  mentions?: MarkdownFileMentions | undefined
  /** Append a quoted response selection and its comment to the composer. */
  appendAnnotation?: ((text: string) => void) | undefined
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/** Reasoning block as the Think variant summary row (figma 39:28304). */
export const AssistantMarkdown = memo(function AssistantMarkdown({
  blocks, streaming, interrupted, loadImage, mentions, appendAnnotation, t,
}: AssistantMarkdownProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const selectingRef = useRef(false)
  const [responseSelection, setResponseSelection] = useState<ResponseSelection | null>(null)
  const [comment, setComment] = useState('')
  const imageLoader = loadImage ?? (() => Promise.reject(new Error(t('image.serviceUnavailable'))))
  // Stable per locale revision (t identity changes on switch): a fresh object
  // per render would rebuild MarkdownText's component table every chunk.
  const codeLabels = useMemo(() => ({ copyLabel: t('copy'), copiedLabel: t('copied') }), [t])
  const last = blocks.length - 1
  // Tool-call heads render as tool rows in the chat view's grouping pass, so
  // a node that is only those heads (or empty) would paint an empty root
  // between tool groups — skip the shell unless something visible remains.
  const hasVisible = streaming
    || interrupted === true
    || blocks.some(block => block.kind !== 'tool-call')

  const captureSelection = useCallback((pointer?: Pick<MouseEvent, 'clientX' | 'clientY'>): void => {
    const body = bodyRef.current
    const selection = window.getSelection()
    if (appendAnnotation === undefined || body === null || selection === null || selection.rangeCount === 0) return
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    const text = selection.toString().trim()
    if (anchor === null || focus === null || text === '' || !body.contains(anchor) || !body.contains(focus)) return
    const bounds = fixedRect(selection.getRangeAt(0).getBoundingClientRect())
    const selectionAnchor = pointer === undefined
      ? bounds
      : { left: pointer.clientX, top: pointer.clientY, width: 0, height: 0 }
    const position = popoverPosition(selectionAnchor, 180, 36)
    setComment('')
    setResponseSelection({
      text,
      anchor: selectionAnchor,
      ...position,
      mode: 'menu',
    })
  }, [appendAnnotation])

  useEffect(() => {
    const finishSelection = (event: MouseEvent): void => {
      if (!selectingRef.current) return
      selectingRef.current = false
      captureSelection(event)
    }
    document.addEventListener('mouseup', finishSelection)
    return () => { document.removeEventListener('mouseup', finishSelection) }
  }, [captureSelection])

  useEffect(() => {
    if (responseSelection === null) return
    const dismiss = (event: MouseEvent): void => {
      if (!popoverRef.current?.contains(event.target as Node)) setResponseSelection(null)
    }
    const dismissOnViewportChange = (): void => { setResponseSelection(null) }
    const dismissOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setResponseSelection(null)
    }
    document.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', dismissOnEscape)
    window.addEventListener('scroll', dismissOnViewportChange, true)
    window.addEventListener('resize', dismissOnViewportChange)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', dismissOnEscape)
      window.removeEventListener('scroll', dismissOnViewportChange, true)
      window.removeEventListener('resize', dismissOnViewportChange)
    }
  }, [responseSelection])

  const openAnnotationEditor = useCallback((): void => {
    setResponseSelection((selection) => {
      if (selection === null) return null
      return { ...selection, ...popoverPosition(selection.anchor, 320, 104), mode: 'editor' }
    })
    window.getSelection()?.removeAllRanges()
  }, [])

  const confirmAnnotation = useCallback((): void => {
    if (responseSelection?.mode !== 'editor' || appendAnnotation === undefined) return
    const quote = responseSelection.text.split(/\r?\n/).map(line => `> ${line}`).join('\n')
    const note = comment.trim()
    const annotationText = note === '' ? quote : `${quote}\n\n${t('annotation.comment')}: ${note}`
    appendAnnotation(annotationText)
    window.getSelection()?.removeAllRanges()
    setResponseSelection(null)
    setComment('')
  }, [responseSelection, appendAnnotation, comment, t])

  const onAnnotationKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setResponseSelection(null)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      confirmAnnotation()
    }
  }

  if (!hasVisible) return null
  const rendered: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue
    switch (block.kind) {
      case 'text':
        rendered.push(
          <MarkdownText
            key={i}
            text={block.text}
            streaming={streaming}
            codeLabels={codeLabels}
            fileMentions={mentions}
          />,
        )
        break
      case 'reasoning':
        rendered.push(<ReasoningRow key={i} text={block.text} running={streaming && i === last} t={t} />)
        break
      case 'image': {
        // Consecutive image blocks share one gallery so several images tile
        // into rows instead of each opening a one-image group of its own.
        // Keyed by the group's FIRST block index: a streaming append that
        // extends the group then only grows `images` instead of remounting
        // the gallery under a shifted key.
        const start = i
        const group = [block]
        while (i + 1 < blocks.length) {
          const next = blocks[i + 1]
          if (next === undefined || next.kind !== 'image') break
          group.push(next)
          i += 1
        }
        rendered.push(<ImageGallery key={start} images={group} load={imageLoader} align="start" labels={messageImageLabels(t)} />)
        break
      }
      // Grouped into tool rows by ChatView; hasVisible above skips an empty shell.
      case 'tool-call':
        break
      default:
        rendered.push(
          <JsonBlock
            key={i}
            label={t('message.unknownBlock')}
            payload={block.block}
            truncatedLabel={total => t('json.truncated', { total })}
          />,
        )
    }
  }
  return (
    <div
      className={css.root}
      data-streaming={streaming || undefined}
    >
      <div
        ref={bodyRef}
        className={css.body}
        onMouseDownCapture={() => { selectingRef.current = true }}
        onKeyUp={() => { captureSelection() }}
      >
        {rendered}
        {interrupted && <span className={css.stopped}>{t('message.stopped')}</span>}
      </div>
      {responseSelection?.mode === 'menu' && (
        <div
          ref={popoverRef}
          className={css.selectionMenu}
          data-selection-menu=""
          role="menu"
          style={{ left: responseSelection.left, top: responseSelection.top }}
        >
          <button
            type="button"
            role="menuitem"
            onMouseDown={(event) => { event.preventDefault() }}
            onClick={openAnnotationEditor}
          >
            {t('annotation.addToConversation')}
          </button>
        </div>
      )}
      {responseSelection?.mode === 'editor' && (
        <div
          ref={popoverRef}
          className={css.annotationEditor}
          data-annotation-editor=""
          style={{ left: responseSelection.left, top: responseSelection.top }}
        >
          <textarea
            autoFocus
            value={comment}
            rows={2}
            placeholder={t('annotation.placeholder')}
            aria-label={t('annotation.placeholder')}
            onChange={(event) => { setComment(event.target.value) }}
            onKeyDown={onAnnotationKeyDown}
          />
          <button
            type="button"
            aria-label={t('annotation.confirm')}
            title={t('annotation.confirm')}
            onClick={confirmAnnotation}
          >
            <IconCheckOutline16 />
          </button>
        </div>
      )}
    </div>
  )
})

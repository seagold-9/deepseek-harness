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
  const rootRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [annotation, setAnnotation] = useState<{ text: string; left: number; top: number } | null>(null)
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

  const captureSelection = useCallback((): void => {
    const root = rootRef.current
    const selection = window.getSelection()
    if (appendAnnotation === undefined || root === null || selection === null || selection.rangeCount === 0) return
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    const text = selection.toString().trim()
    if (anchor === null || focus === null || text === '' || !root.contains(anchor) || !root.contains(focus)) return
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12)
    const editorHeight = 104
    const top = rect.bottom + editorHeight + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - editorHeight - 8)
    setComment('')
    setAnnotation({ text, left, top })
  }, [appendAnnotation])

  useEffect(() => {
    if (annotation === null) return
    const dismiss = (event: MouseEvent): void => {
      if (!editorRef.current?.contains(event.target as Node)) setAnnotation(null)
    }
    const dismissOnScroll = (): void => { setAnnotation(null) }
    document.addEventListener('mousedown', dismiss)
    window.addEventListener('scroll', dismissOnScroll, true)
    window.addEventListener('resize', dismissOnScroll)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      window.removeEventListener('scroll', dismissOnScroll, true)
      window.removeEventListener('resize', dismissOnScroll)
    }
  }, [annotation])

  const confirmAnnotation = useCallback((): void => {
    if (annotation === null || appendAnnotation === undefined || comment.trim() === '') return
    const quote = annotation.text.split(/\r?\n/).map(line => `> ${line}`).join('\n')
    appendAnnotation(`${quote}\n\n${t('annotation.comment')}: ${comment.trim()}`)
    window.getSelection()?.removeAllRanges()
    setAnnotation(null)
    setComment('')
  }, [annotation, appendAnnotation, comment, t])

  const onAnnotationKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setAnnotation(null)
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
      ref={rootRef}
      className={css.root}
      data-streaming={streaming || undefined}
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
    >
      <div className={css.body}>
        {rendered}
        {interrupted && <span className={css.stopped}>{t('message.stopped')}</span>}
      </div>
      {annotation !== null && (
        <div
          ref={editorRef}
          className={css.annotationEditor}
          data-annotation-editor=""
          style={{ left: annotation.left, top: annotation.top }}
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
            disabled={comment.trim() === ''}
            onClick={confirmAnnotation}
          >
            <IconCheckOutline16 />
          </button>
        </div>
      )}
    </div>
  )
})

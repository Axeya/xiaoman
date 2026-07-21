import { useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { TagChip } from './TagChip'

/** 触屏设备：Enter 换行，只能点「记下」保存；桌面端：Enter 保存、Shift+Enter 换行 */
const IS_TOUCH =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

/** 输入框最大高度：约 6 行 */
const MAX_TEXTAREA_H = 150

interface ComposerProps {
  /** 写到哪一天（在哪天页面写，就记到哪一天） */
  date: string
  onSaved?: () => void
}

/** 「记一笔…」输入区：自动长高 textarea + 记录/待办切换 + 标签多选（可编辑删除） */
export function Composer({ date, onSaved }: ComposerProps) {
  const addItem = useStore((s) => s.addItem)
  const savedTags = useStore((s) => s.savedTags)
  const addTag = useStore((s) => s.addTag)
  const removeTag = useStore((s) => s.removeTag)

  const [text, setText] = useState('')
  const [kind, setKind] = useState<'note' | 'todo'>('note')
  const [selected, setSelected] = useState<string[]>([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_H)}px`
  }, [text])

  const toggleTag = (t: string) => {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const submit = () => {
    if (!text.trim()) return
    addItem({ text, tags: selected, kind, date })
    setText('')
    setSelected([])
    setKind('note')
    onSaved?.()
  }

  const confirmNewTag = () => {
    const t = newTag.trim()
    if (t) {
      addTag(t)
      setSelected((prev) => (prev.includes(t) ? prev : [...prev, t]))
    }
    setNewTag('')
    setAddingTag(false)
  }

  return (
    <div>
      {/* 记录/待办 切换（靠左） */}
      <div className="mb-1.5 inline-flex rounded-full bg-mist p-0.5 text-[11px]">
        {(['note', 'todo'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-0.5 ${
              kind === k ? 'bg-white font-medium text-ink shadow-sm' : 'text-softgray'
            }`}
          >
            {k === 'note' ? '记录' : '待办'}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 border-b border-mist pb-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            if (!IS_TOUCH && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={IS_TOUCH ? '记一笔…（可换行）' : '记一笔…'}
          rows={2}
          className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-softgray"
        />
        <div className="flex shrink-0 flex-col items-end gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="rounded-full bg-blue px-3.5 py-1 text-[13px] font-medium text-white disabled:bg-mist disabled:text-softgray"
          >
            {kind === 'note' ? '记下' : '存待办'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {savedTags.map((t) => (
          <TagChip
            key={t}
            label={t}
            selected={selected.includes(t)}
            onClick={() => toggleTag(t)}
            editing={editingTags}
            onRemove={() => {
              removeTag(t)
              setSelected((prev) => prev.filter((x) => x !== t))
            }}
          />
        ))}
        {addingTag ? (
          <input
            autoFocus
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={confirmNewTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmNewTag()
              if (e.key === 'Escape') {
                setAddingTag(false)
                setNewTag('')
              }
            }}
            placeholder="新标签"
            className="w-20 rounded-full bg-mist px-3 py-1 text-[13px] outline-none placeholder:text-softgray"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTag(true)}
            className="rounded-full border border-dashed border-mist px-3 py-1 text-[13px] text-softgray"
          >
            + 标签
          </button>
        )}
        {savedTags.length > 0 && (
          <button
            type="button"
            onClick={() => setEditingTags((v) => !v)}
            className={`ml-1 text-[12px] ${editingTags ? 'font-medium text-blue' : 'text-softgray'}`}
          >
            {editingTags ? '完成' : '编辑'}
          </button>
        )}
      </div>
    </div>
  )
}

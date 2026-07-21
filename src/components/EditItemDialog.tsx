import { useEffect, useState } from 'react'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'

interface EditItemDialogProps {
  item: Item | null
  onClose: () => void
}

/**
 * 编辑弹层：课程条目（虚拟/落库）与手动条目通用。
 * 可改标题、时间、备注/反思；虚拟课程条目保存时以 courseId+date 落库为 override。
 */
export function EditItemDialog({ item, onClose }: EditItemDialogProps) {
  const updateItem = useStore((s) => s.updateItem)
  const upsertCourseItem = useStore((s) => s.upsertCourseItem)

  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (item) {
      setText(item.text)
      setTime(item.time)
      setNote(item.note ?? '')
    }
  }, [item])

  if (!item) return null

  const isVirtual = item.id.startsWith('vc-')

  const save = () => {
    if (!text.trim()) return
    if (isVirtual && item.courseId) {
      // 虚拟课程条目 → 落库 override（保持原状态）
      upsertCourseItem({
        courseId: item.courseId,
        date: item.date,
        time,
        text,
        note,
        status: item.status,
        periodLabel: item.periodLabel,
        className: item.className,
        tags: item.tags,
      })
    } else {
      updateItem(item.id, { text, time, note })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-medium text-ink">编辑</h3>
        {item.source === 'course' && item.periodLabel && (
          <p className="mt-0.5 text-[12px] text-softgray">课程 · {item.periodLabel}</p>
        )}

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="标题"
          className="mt-4 w-full rounded-lg bg-mist px-3 py-2 text-[15px] text-ink outline-none placeholder:text-softgray"
        />

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-softgray">时间</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg bg-mist px-2.5 py-1.5 text-[14px] text-ink outline-none"
          />
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="今天讲了什么？有什么反思？"
          rows={4}
          className="mt-3 w-full resize-none rounded-lg bg-mist px-3 py-2 text-[14px] leading-relaxed text-ink outline-none placeholder:text-softgray"
        />

        <div className="mt-5 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="text-[14px] text-softgray">
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!text.trim()}
            className="rounded-full bg-blue px-4 py-1.5 text-[14px] font-medium text-white disabled:bg-mist disabled:text-softgray"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

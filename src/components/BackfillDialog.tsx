import { useEffect, useState } from 'react'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'

interface BackfillDialogProps {
  item: Item | null
  onClose: () => void
}

/** 补记弹层：修改条目属于哪一天、哪个时间 */
export function BackfillDialog({ item, onClose }: BackfillDialogProps) {
  const updateItemDateTime = useStore((s) => s.updateItemDateTime)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    if (item) {
      setDate(item.date)
      setTime(item.time)
    }
  }, [item])

  if (!item) return null

  const save = () => {
    if (date && time) updateItemDateTime(item.id, date, time)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-medium text-ink">补记</h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-softgray">{item.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-lg bg-mist px-2.5 py-2 text-[14px] text-ink outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg bg-mist px-2.5 py-2 text-[14px] text-ink outline-none"
          />
        </div>
        <div className="mt-5 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="text-[14px] text-softgray">
            取消
          </button>
          <button type="button" onClick={save} className="text-[14px] font-medium text-blue">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

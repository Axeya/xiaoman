import { useState } from 'react'
import type { Item } from '@/types'
import { TagBadge } from './TagChip'

interface DayListProps {
  items: Item[]
  onToggle: (item: Item) => void
  onEdit: (item: Item) => void
  onBackfill?: (item: Item) => void
  onDelete: (item: Item) => void
  emptyText?: string
}

/** 备注：灰色小字，多行截断，点击展开/收起 */
function NoteText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={`mt-1 block w-full whitespace-pre-wrap text-left text-[13px] leading-relaxed text-softgray ${
        expanded ? '' : 'line-clamp-2'
      }`}
    >
      {text}
    </button>
  )
}

/**
 * 当天融合列表：课程 + 待办 + 记录按时间排列。
 * 视觉规则：空心圆圈 = 待办（还没做）；蓝色实心圆点 = 已发生（纯记录/已完成待办/过去的课）。
 */
export function DayList({ items, onToggle, onEdit, onBackfill, onDelete, emptyText = '这一天还空着，随手记一笔吧' }: DayListProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-[13px] text-softgray">{emptyText}</p>
  }
  return (
    <ol>
      {items.map((e) => {
        const isVirtual = e.id.startsWith('vc-')
        const isTodo = e.kind === 'todo' && e.status === 'todo'
        const isDoneTodo = e.kind === 'todo' && e.status === 'done'
        // 已完成的待办（含课程 override）可撤销；纯记录与过去的虚拟课程仅展示
        const toggleable = e.kind === 'todo' && !(isVirtual && e.status === 'done')
        return (
          <li key={e.id} className="flex gap-3 border-b border-mist py-3 last:border-b-0">
            {/* 状态标记列 */}
            <span className="flex w-[18px] shrink-0 justify-center pt-1">
              {isTodo ? (
                <button
                  type="button"
                  onClick={() => toggleable && onToggle(e)}
                  aria-label="完成"
                  className="h-[17px] w-[17px] rounded-full border-[1.5px] border-softgray/60 transition-colors hover:border-blue"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleable && onToggle(e)}
                  aria-label={isDoneTodo && toggleable ? '撤销完成' : undefined}
                  className={`h-[9px] w-[9px] rounded-full bg-blue ${toggleable ? '' : 'cursor-default'}`}
                />
              )}
            </span>

            <span className="w-[38px] shrink-0 pt-0.5 text-[12px] tabular-nums text-softgray">{e.time}</span>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-relaxed text-ink">{e.text}</p>
              {e.note && <NoteText text={e.note} />}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {e.source === 'course' && (
                  <span className="text-[11px] text-softgray">
                    课程{e.periodLabel ? ` · ${e.periodLabel}` : ''}
                  </span>
                )}
                {isDoneTodo && e.source === 'manual' && <span className="text-[11px] text-blue">已完成待办</span>}
                {e.tags.map((t) => (
                  <TagBadge key={t} label={t} />
                ))}
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  className="text-[11px] text-softgray underline decoration-mist underline-offset-2"
                >
                  编辑
                </button>
                {!isVirtual && e.source === 'manual' && onBackfill && (
                  <button
                    type="button"
                    onClick={() => onBackfill(e)}
                    className="text-[11px] text-softgray underline decoration-mist underline-offset-2"
                  >
                    补记
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(e)}
                  className="text-[11px] text-softgray underline decoration-mist underline-offset-2"
                >
                  删除
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

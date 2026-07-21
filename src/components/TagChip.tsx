interface TagChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  /** 编辑态：右上角显示 × 删除 */
  editing?: boolean
  onRemove?: () => void
}

/** 标签 chip：浅灰底 + 深灰字；选中蓝底白字 */
export function TagChip({ label, selected = false, onClick, editing = false, onRemove }: TagChipProps) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={editing ? undefined : onClick}
        className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] transition-colors ${
          selected ? 'bg-blue font-medium text-white' : 'bg-mist text-ink/70'
        } ${editing ? 'pr-5' : ''}`}
      >
        {label}
      </button>
      {editing && (
        <button
          type="button"
          aria-label={`删除标签 ${label}`}
          onClick={onRemove}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-softgray text-[10px] leading-none text-white"
        >
          ×
        </button>
      )}
    </span>
  )
}

/** 时间线条目上的只读小标签 */
export function TagBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink/60">
      {label}
    </span>
  )
}

import { useRef, useState } from 'react'

const STORE_KEY = 'xiaoman-store'

interface BackupDialogProps {
  open: boolean
  onClose: () => void
}

/** 备份与恢复：导出 JSON 备份文件；从备份文件恢复（覆盖当前数据后刷新页面） */
export function BackupDialog({ open, onClose }: BackupDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  if (!open) return null

  const exportBackup = async () => {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) {
      setMessage('现在还没有内容可备份，先去记一笔吧')
      return
    }
    const backup = {
      app: 'xiaoman-backup',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      store: JSON.parse(raw),
    }
    const text = JSON.stringify(backup, null, 2)
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `小满备份-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 4000)

    // 双保险：顺手复制到剪贴板，可粘贴到备忘录 / 文件传输助手
    let copied = false
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch {
      copied = false
    }
    setMessage(
      copied
        ? '备份文件已开始下载，同时也复制到了剪贴板——可以粘贴到备忘录或微信「文件传输助手」再存一份'
        : '备份文件已开始下载，去「文件」App 的下载文件夹里找它，建议存到 iCloud 里',
    )
  }

  const importBackup = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const store = parsed?.app === 'xiaoman-backup' ? parsed.store : parsed
        if (!store || typeof store !== 'object' || !store.state || !Array.isArray(store.state.items)) {
          setMessage('这个文件不是小满的备份，没有动你的数据')
          return
        }
        if (!window.confirm('恢复会覆盖小满里当前的所有内容，确定继续吗？')) return
        localStorage.setItem(STORE_KEY, JSON.stringify(store))
        window.location.reload()
      } catch {
        setMessage('文件读取失败，请确认是小满导出的备份文件（.json）')
      }
    }
    reader.onerror = () => setMessage('文件读取失败，请重试')
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-medium text-ink">备份与恢复</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-softgray">
          记录只存在这台手机上。定期导出一份备份，换手机或误删也能找回来。
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-xl bg-blue py-2.5 text-[15px] font-medium text-white"
          >
            导出备份
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-mist py-2.5 text-[15px] text-ink"
          >
            导入恢复
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importBackup(f)
              e.target.value = ''
            }}
          />
        </div>

        {message && <p className="mt-3 text-[13px] leading-relaxed text-blue">{message}</p>}

        <p className="mt-3 text-[12px] leading-relaxed text-softgray">
          小建议：每月导出一次，存到 iCloud 或发给微信「文件传输助手」。导入恢复会覆盖当前全部内容，先想清楚哦。
        </p>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-[14px] text-softgray">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

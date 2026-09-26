import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-3xl', '3xl': 'max-w-5xl' }

export default function Modal({ title, children, footer, onClose, size = 'md' }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed top-16 lg:top-[107px] right-0 bottom-0 z-50 flex items-start justify-center px-4 pt-6 pb-6"
      style={{ left: 'var(--sidebar-w, 0px)' }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden max-h-full', widths[size])}>

        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-[#C0392B] to-[#A93226] px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white text-lg tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 transition-colors rounded-lg p-1.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — only this part scrolls */}
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

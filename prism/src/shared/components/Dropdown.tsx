import { useEffect, useRef, useState } from 'react'

// Adapted from apeture's Dropdown component pattern.
// Controlled, click-outside aware, keyboard-accessible.
// Uses prism's Tailwind v4 classes (no external icon lib).

export interface DropdownOption<T extends string = string> {
  value: T
  label: string
}

interface DropdownProps<T extends string = string> {
  options:   DropdownOption<T>[]
  value:     T
  onChange:  (value: T) => void
  ariaLabel?: string
}

export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Select',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click (same as apeture pattern)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 hover:border-neutral-400 transition-colors outline-none focus:border-neutral-500"
      >
        <span>{selected?.label ?? value}</span>
        {/* Inline SVG chevron — no lucide dep needed */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={['shrink-0 transition-transform duration-150 text-neutral-400', isOpen ? 'rotate-180' : ''].join(' ')}
          aria-hidden="true"
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-1 min-w-full bg-white border border-neutral-200 shadow-md overflow-hidden"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setIsOpen(false) }}
              className={[
                'px-3 py-1.5 text-[11px] cursor-pointer transition-colors whitespace-nowrap',
                opt.value === value
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100',
              ].join(' ')}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

interface DropdownProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  label?: string       // optional prefix label shown before value
  widthClassName?: string
}

/**
 * Aperture-style dropdown: bottom-border only, flat design, no rounded corners.
 * Copied from ~/Projects/asro.cc/aperture/src/components/Input/Dropdown.tsx
 */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  ariaLabel = 'Dropdown',
  label,
  widthClassName = 'w-auto',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const display = value || placeholder
  const isPlaceholder = !value

  return (
    <div ref={containerRef} className={`relative ${widthClassName}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="ap-dropdown-trigger w-full"
      >
        <span className={`truncate flex items-center gap-1 ${isPlaceholder ? 'text-ink-5b' : 'text-ink-2b'}`}>
          {label && <span className="text-[10px] text-ink-5b">{label}</span>}
          <span className="text-[12px]">{display}</span>
        </span>
        <svg
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5b shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <ul role="listbox" className="ap-dropdown-menu">
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onClick={() => { onChange(opt); setIsOpen(false) }}
              className={`ap-dropdown-option ${opt === value ? 'ap-dropdown-option-selected' : ''}`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

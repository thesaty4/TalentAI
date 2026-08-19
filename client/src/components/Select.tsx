import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils/cn';

export interface SelectOption { value: string; label: string }

interface Props {
  value:       string;
  onChange:    (value: string) => void;
  options:     SelectOption[];
  placeholder?: string;
  disabled?:   boolean;
  className?:  string;
}

export function Select({ value, onChange, options, placeholder = 'Select…', disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-sm shadow-xs transition-colors',
          'focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
          open
            ? 'border-power-orange ring-1 ring-power-orange/20'
            : 'border-[var(--border-default)] hover:border-secure-gray',
          selected ? 'text-network-blue' : 'text-[var(--fg-3)]',
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-secure-gray transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-[60] mt-1 w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-md">
          {/* Placeholder / clear option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={cn(
              'flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-culture-gray',
              !value ? 'font-medium text-network-blue' : 'text-[var(--fg-3)]',
            )}
          >
            {placeholder}
          </button>

          {options.length > 0 && <div className="border-t border-[var(--border-subtle)]" />}

          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-culture-gray',
                opt.value === value
                  ? 'bg-power-orange/10 font-medium text-power-orange'
                  : 'text-network-blue',
              )}
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              {opt.value === value && <Check size={13} className="shrink-0 text-power-orange" />}
            </button>
          ))}

          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--fg-3)]">No options available</p>
          )}
        </div>
      )}
    </div>
  );
}

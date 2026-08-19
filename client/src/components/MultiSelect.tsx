import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils/cn';

interface Props {
  options:       string[];
  selected:      string[];
  onChange:      (v: string[]) => void;
  placeholder?:  string;
  countLabel?:   string;  // e.g. 'Stage' → shows 'Stage +3' when selected
  className?:    string;
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Select…', countLabel, className }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const searchRef           = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  }

  function handleOpen() {
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label =
    selected.length === 0   ? placeholder :
    countLabel              ? `${countLabel} +${selected.length}` :
    selected.length === 1   ? selected[0] :
    `${selected.length} selected`;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={cn(
          'flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm transition-colors',
          open ? 'border-power-orange' : 'hover:border-[var(--fg-3)]',
        )}
      >
        <span className={cn('truncate', selected.length === 0 ? 'text-[var(--fg-3)]' : 'font-medium text-[var(--fg-1)]')}>
          {label}
        </span>
        {selected.length > 0 ? (
          <X
            size={13}
            className="shrink-0 text-[var(--fg-3)] hover:text-power-orange"
            onClick={e => { e.stopPropagation(); onChange([]); }}
          />
        ) : (
          <ChevronDown size={13} className={cn('shrink-0 text-[var(--fg-3)] transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-white shadow-md">
          {/* Searchbox inside the dropdown */}
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--fg-3)]"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--fg-3)]">No matches</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-culture-gray"
                >
                  <span className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    selected.includes(opt)
                      ? 'border-power-orange bg-power-orange'
                      : 'border-[var(--border-default)]',
                  )}>
                    {selected.includes(opt) && <Check size={10} className="text-white" />}
                  </span>
                  <span className={cn(selected.includes(opt) && 'font-medium text-power-orange')}>
                    {opt}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

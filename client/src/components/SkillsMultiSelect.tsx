import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils/cn';
import { SKILL_LIST } from '../lib/constants/skills.constants';

interface Props {
  selected:  string[];
  onChange:  (skills: string[]) => void;
  placeholder?: string;
}

export function SkillsMultiSelect({ selected, onChange, placeholder = 'Search skills…' }: Props) {
  const [search,  setSearch]  = useState('');
  const [open,    setOpen]    = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  const filtered = SKILL_LIST.filter(
    s => s.toLowerCase().includes(search.toLowerCase()) && !selected.includes(s)
  );
  const allSelected = filtered.length === 0 && search === '';

  function toggle(skill: string) {
    onChange(selected.includes(skill) ? selected.filter(s => s !== skill) : [...selected, skill]);
  }

  function selectAll() {
    const toAdd = SKILL_LIST.filter(s => !selected.includes(s));
    onChange([...selected, ...toAdd]);
  }

  function deselectAll() { onChange([]); }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / selected chip row */}
      <div
        className="flex min-h-[36px] w-full cursor-text flex-wrap gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 focus-within:border-celestial-blue"
        onClick={() => setOpen(true)}
      >
        {selected.map(s => (
          <span key={s} className="flex items-center gap-0.5 rounded-full bg-celestial-blue/10 px-2 py-0.5 text-[10px] font-medium text-celestial-blue">
            {s}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(s); }} className="hover:text-power-orange">
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-3)]"
          placeholder={selected.length === 0 ? placeholder : ''}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-white shadow-md">
          {/* Select all / Deselect all */}
          <div className="flex gap-2 border-b border-[var(--border-subtle)] px-3 py-1.5">
            <button type="button" onClick={selectAll}
              className="text-[10px] font-medium text-celestial-blue hover:underline">Select all</button>
            <span className="text-[var(--fg-3)]">·</span>
            <button type="button" onClick={deselectAll}
              className="text-[10px] font-medium text-power-orange hover:underline">Deselect all</button>
          </div>

          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--fg-3)]">{search ? 'No matches' : 'All skills selected'}</p>
          )}
          {filtered.map(s => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-culture-gray">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

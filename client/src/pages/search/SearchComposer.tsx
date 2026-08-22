import { useRef, useState } from 'react';
import { ArrowRight, Paperclip, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { cn } from '../../lib/utils/cn';
import type { Project } from '../../lib/api/projects.api';

interface Props {
  projects:         Project[];
  selectedProject:  number | null;
  selectedIrc:      number | null;
  query:            string;
  scope:            'all' | 'applied';
  jdFilenames:      string[];
  isPending:        boolean;
  onProjectChange:  (id: number | null) => void;
  onIrcChange:      (id: number | null) => void;
  onQueryChange:    (q: string) => void;
  onScopeChange:    (s: 'all' | 'applied') => void;
  onSubmit:         () => void;
  onJdUpload:       (file: File) => void;
  onJdRemove:       (filename: string) => void;
}

export function SearchComposer(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  const project  = p.projects.find(pr => pr.id === p.selectedProject);
  const openIrcs = project?.ircs.filter(i => i.status === 'Open') ?? [];

  const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const ALLOWED_EXT   = ['.pdf', '.docx'];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      setUploadError('Only PDF and DOCX files are supported. Please select a valid file.');
      return;
    }
    setUploadError('');
    p.onJdUpload(file);
  }

  return (
    <div className="sticky -top-6 z-10 border-b border-[var(--border-subtle)] bg-white px-8 py-4 shadow-sm" style={{ isolation: 'isolate' }}>
      {/* Row 1: all filters on a single non-wrapping line */}
      <div className="flex items-center gap-3">
        <Select
          className="min-w-0 flex-1"
          placeholder="Select project…"
          value={String(p.selectedProject ?? '')}
          onChange={v => { p.onProjectChange(v ? +v : null); p.onIrcChange(null); }}
          options={p.projects.map(pr => ({ value: String(pr.id), label: pr.name }))}
        />

        <Select
          className="min-w-0 flex-[1.3]"
          placeholder="Select IRC…"
          value={String(p.selectedIrc ?? '')}
          onChange={v => p.onIrcChange(v ? +v : null)}
          disabled={!p.selectedProject}
          options={openIrcs.map(i => ({ value: String(i.id), label: `${i.ircCode} — ${i.roleTitle}` }))}
        />

        {/* Scope toggle */}
        <div className="flex rounded-lg border border-[var(--border-default)] bg-white">
          {(['all', 'applied'] as const).map(s => (
            <button key={s} onClick={() => p.onScopeChange(s)}
              className={cn('px-3 py-1.5 text-xs font-medium capitalize transition-colors first:rounded-l-md last:rounded-r-md',
                p.scope === s ? 'bg-network-blue text-white' : 'text-secure-gray hover:bg-culture-gray')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Textarea + actions */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={p.query}
          onChange={e => p.onQueryChange(e.target.value)}
          placeholder="Describe the talent requirement… e.g. Find engineers who've actually worked on similar payments integration projects."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
        />
        <div className="flex flex-col gap-1.5">
          <input ref={fileRef} type="file" accept=".pdf,.docx" multiple className="hidden" onChange={handleFile} />
          {/* Icon-only attachment button — tooltip shows purpose on hover */}
          <button
            type="button"
            title="Add attachments"
            aria-label="Add attachments"
            onClick={() => fileRef.current?.click()}
            disabled={!p.selectedIrc || p.isPending}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
              !p.selectedIrc || p.isPending
                ? 'cursor-not-allowed border-[var(--border-subtle)] bg-white opacity-40'
                : 'border-[var(--border-default)] bg-white text-secure-gray hover:border-power-orange hover:text-power-orange',
            )}
          >
            <Paperclip size={14} />
          </button>
          <Button size="sm" disabled={!p.selectedIrc || p.isPending || (!p.query.trim() && p.jdFilenames.length === 0)} onClick={p.onSubmit}>
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>

      {/* JD chips — one per attached file with individual remove */}
      {p.jdFilenames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.jdFilenames.map(name => (
            <div key={name} className="inline-flex items-center gap-1.5 rounded-full bg-power-orange/10 px-2.5 py-1 text-xs text-power-orange">
              <Paperclip size={10} /> {name}
              <button onClick={() => p.onJdRemove(name)} className="ml-0.5 hover:text-power-orange"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      {/* Upload validation error */}
      {uploadError && (
        <p className="mt-2 text-xs text-power-orange">{uploadError}</p>
      )}
    </div>
  );
}

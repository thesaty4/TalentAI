import { useRef, useState } from 'react';
import { ArrowRight, Paperclip, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { cn } from '../../lib/utils/cn';
import type { Project } from '../../lib/api/projects.api';

interface Props {
  projects:         Project[];
  selectedProject:  number | null;
  selectedIrc:      number | null;
  query:            string;
  scope:            'all' | 'applied';
  jdFilename:       string | null;
  isPending:        boolean;
  onProjectChange:  (id: number | null) => void;
  onIrcChange:      (id: number | null) => void;
  onQueryChange:    (q: string) => void;
  onScopeChange:    (s: 'all' | 'applied') => void;
  onSubmit:         () => void;
  onJdUpload:       (file: File) => void;
  onJdRemove:       () => void;
}

// appearance-none + inline SVG arrow + consistent height for polished native selects
const SELECT_CLS = [
  'h-9 cursor-pointer appearance-none rounded-lg border border-[var(--border-default)]',
  'bg-white pl-3 pr-8 text-sm text-network-blue shadow-xs',
  'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23484F6B\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")]',
  'bg-no-repeat bg-[right_10px_center]',
  'focus:border-celestial-blue focus:outline-none focus:ring-1 focus:ring-celestial-blue/30',
  'disabled:cursor-not-allowed disabled:opacity-40',
].join(' ');

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
        <select
          value={p.selectedProject ?? ''}
          onChange={e => { p.onProjectChange(e.target.value ? +e.target.value : null); p.onIrcChange(null); }}
          className={cn(SELECT_CLS, 'min-w-0 flex-1')}>
          <option value="">Select project…</option>
          {p.projects.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
        </select>

        <select
          value={p.selectedIrc ?? ''}
          onChange={e => p.onIrcChange(e.target.value ? +e.target.value : null)}
          disabled={!p.selectedProject}
          className={cn(SELECT_CLS, 'min-w-0 flex-[1.3]')}>
          <option value="">Select IRC…</option>
          {openIrcs.map(i => <option key={i.id} value={i.id}>{i.ircCode} — {i.roleTitle}</option>)}
        </select>

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
          className="flex-1 resize-none rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none"
        />
        <div className="flex flex-col gap-1.5">
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFile} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!p.selectedIrc || p.isPending}
            className="flex items-center gap-1.5">
            <Paperclip size={13} /> JD
          </Button>
          <Button size="sm" disabled={!p.selectedIrc || p.isPending || (!p.query.trim() && !p.jdFilename)} onClick={p.onSubmit}>
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>

      {/* JD chip */}
      {p.jdFilename && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-celestial-blue/10 px-2.5 py-1 text-xs text-celestial-blue">
          <Paperclip size={10} /> {p.jdFilename}
          <button onClick={p.onJdRemove} className="ml-0.5 hover:text-power-orange"><X size={10} /></button>
        </div>
      )}
      {/* Upload validation error */}
      {uploadError && (
        <p className="mt-2 text-xs text-power-orange">{uploadError}</p>
      )}
    </div>
  );
}

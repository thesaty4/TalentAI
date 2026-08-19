import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Feedback';
import { pipelineApi } from '../../lib/api/pipeline.api';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';

interface Props {
  entryId:   number | null;
  entryName: string;
  ircCode:   string;
  onClose:   () => void;
}

export function FeedbackHistoryModal({ entryId, entryName, ircCode, onClose }: Props) {
  const { data, isPending } = useQuery({
    queryKey: ['pipeline-feedback', entryId],
    queryFn:  () => pipelineApi.getFeedback(entryId!),
    enabled:  entryId !== null,
  });

  // Sort by stage order so history reads top-to-bottom through the funnel
  const sorted = [...(data ?? [])].sort(
    (a, b) =>
      PIPELINE_STAGES.indexOf(a.roundName as typeof PIPELINE_STAGES[number]) -
      PIPELINE_STAGES.indexOf(b.roundName as typeof PIPELINE_STAGES[number]),
  );

  return (
    <Modal open={entryId !== null} onClose={onClose} title="Feedback history">
      <p className="mb-4 text-sm text-secure-gray">
        <strong>{entryName}</strong> · {ircCode}
      </p>

      {isPending && <Spinner className="py-4" />}

      {!isPending && sorted.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--fg-3)]">No feedback recorded yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map(fb => (
          <div key={fb.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--fg-1)]">{fb.roundName}</span>
              {fb.rating && (
                <span className="rounded-full border border-power-orange/30 bg-power-orange/10 px-2 py-0.5 text-[10px] font-medium text-power-orange">
                  {fb.rating}
                </span>
              )}
            </div>
            {fb.comments && (
              <p className="mb-2 text-sm text-[var(--fg-1)]">{fb.comments}</p>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--fg-3)]">
              {fb.interviewer && <span>{fb.interviewer}</span>}
              {fb.interviewer && fb.roundDate && <span>·</span>}
              {fb.roundDate && (
                <span>{new Date(fb.roundDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

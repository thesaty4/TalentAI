import { apiClient } from './client';

export interface PipelineEntry {
  id:             number;
  stage:          string;
  matchPct:       number | null;
  appliedDate:    string | null;
  employee:       { id: number; fullName: string; roleTitle: string; location: string; email?: string | null };
  irc:            { id: number; ircCode: string; roleTitle: string };
  feedbackRounds?: FeedbackRound[];
}

export interface PipelineMeta { total: number; page: number; limit: number; pages: number; }

export interface PipelinePage { data: PipelineEntry[]; meta: PipelineMeta; }

export interface StageHistoryEntry {
  id:          number;
  fromStage:   string;
  toStage:     string;
  changedAt:   string;
  reason:      string | null;
  changedBy:   { name: string; role: string };
}

export interface UpdateStageDto {
  stage:     string;
  direction: 'forward' | 'backward';
  note?:     string;
}

export interface FeedbackRound {
  id:          number;
  roundName:   string;
  interviewer: string | null;
  roundDate:   string | null;
  rating:      string | null;
  comments:    string | null;
}

export interface StageFeedbackDto {
  roundName:    string;
  comments:     string;
  rating?:      string;
  interviewer?: string;
}

export const pipelineApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PipelinePage>('/pipeline', { params }).then(r => r.data),

  shortlist: (employeeId: number, ircId: number) =>
    apiClient.post<{ data: PipelineEntry }>('/pipeline', { employeeId, ircId }).then(r => r.data.data),

  updateStage: (id: number, dto: UpdateStageDto) =>
    apiClient.patch<{ data: PipelineEntry }>(`/pipeline/${id}`, dto).then(r => r.data.data),

  notFit: (id: number, reason: string) =>
    apiClient.post(`/pipeline/${id}/not-fit`, { reason }).then(r => r.data),

  addFeedback: (id: number, dto: StageFeedbackDto) =>
    apiClient.post<{ data: FeedbackRound }>(`/pipeline/${id}/feedback`, dto).then(r => r.data.data),

  getFeedback: (id: number) =>
    apiClient.get<{ data: FeedbackRound[] }>(`/pipeline/${id}/feedback`).then(r => r.data.data),

  getHistory: (id: number) =>
    apiClient.get<{ data: StageHistoryEntry[] }>(`/pipeline/${id}/history`).then(r => r.data.data),
};

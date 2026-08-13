import { apiClient } from './client';

export interface OpenIrc {
  id:              number;
  ircCode:         string;
  roleTitle:       string;
  mandatorySkills: string;
  preferredSkills: string | null;
  experienceRange: string;
  location:        string;
  remotePolicy:    string;
  status:          string;
  hasApplied:      boolean;
  project:         { id: number; name: string; customer: string };
}

export interface MyPipelineEntry {
  id:           number;
  stage:        string;
  matchPct:     number | null;
  appliedDate:  string | null;
  updatedAt:    string;
  irc:          { ircCode: string; roleTitle: string; location: string; project: { name: string } };
  feedbackRounds: FeedbackRound[];
}

export interface FeedbackRound {
  id:           number;
  roundName:    string;
  interviewer:  string | null;
  roundDate:    string | null;
  rating:       string | null;
  comments:     string | null;
  pipelineCandidate?: {
    irc: { ircCode: string; roleTitle?: string; project: { name: string } };
  };
}

export const candidateApi = {
  openIrcs:   () => apiClient.get<{ data: OpenIrc[] }>('/candidate/open-ircs').then(r => r.data.data),
  apply:      (ircId: number) => apiClient.post(`/candidate/apply/${ircId}`).then(r => r.data),
  myPipeline: () => apiClient.get<{ data: MyPipelineEntry[] }>('/candidate/my-pipeline').then(r => r.data.data),
  feedback:   () => apiClient.get<{ data: FeedbackRound[] }>('/candidate/feedback').then(r => r.data.data),
  upcoming:   () => apiClient.get<{ data: FeedbackRound[] }>('/candidate/upcoming').then(r => r.data.data),
};

import { apiClient } from './client';

export interface SearchResult {
  employeeId:          number;
  fullName:            string;
  roleTitle:           string;
  location:            string;
  businessUnit:        string;
  skills:              string[];
  currentAllocation:   string | null;
  availableDate:       string | null;
  matchPct:            number;
  whyRecommend:        string;
  whyNot:              string[];
  conflict:            boolean;
  conflictNote:        string | null;
  isDuplicate:         boolean;
  duplicateNote:       string | null;
  alreadyInPipeline:   boolean;
  pipelineCandidateId: number | null;
}

export interface SearchDto {
  ircId: number;
  query?: string;
  scope: 'all' | 'applied';
  jdText?: string;
}

export const searchApi = {
  rank: (dto: SearchDto) =>
    apiClient.post<{ data: SearchResult[] }>('/search', dto).then(r => r.data.data),

  uploadJd: (ircId: number, scope: string, file: File, query?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('ircId', String(ircId));
    form.append('scope', scope);
    if (query) form.append('query', query);
    return apiClient
      .post<{ data: SearchResult[] }>('/search/upload-jd', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data);
  },
};

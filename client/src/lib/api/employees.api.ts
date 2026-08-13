import { apiClient } from './client';

export interface EmployeeProfile {
  id:                number;
  employeeCode:      string;
  fullName:          string;
  roleTitle:         string;
  businessUnit:      string;
  location:          string;
  experienceYears:   number;
  benchStatus:       string;
  currentAllocation: string | null;
  availableDate:     string | null;
  joiningNotice:     string | null;
  skills:            string[];
  projectHistory:    { id: number; projectName: string; clientName: string | null; duration: string | null; description: string; domainTags: string[] }[];
  ratings:           { id: number; reviewCycle: string; rating: string }[];
}

export const employeesApi = {
  get: (id: string | number) =>
    apiClient.get<{ data: EmployeeProfile }>(`/employees/${id}`).then(r => r.data.data),
};

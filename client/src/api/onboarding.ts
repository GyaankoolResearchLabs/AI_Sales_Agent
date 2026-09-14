import { useMutation } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { Organization } from '../types';

export function useOnboardingStep1() {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await http.post<ApiEnvelope<Organization>>('/organizations/onboarding/step-1', payload)).data.data,
  });
}

export function useOnboardingStep2() {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await http.post<ApiEnvelope<Organization>>('/organizations/onboarding/step-2', payload)).data.data,
  });
}

export function useGenerateWorkflow() {
  return useMutation({
    mutationFn: async () => (await http.post<ApiEnvelope<Organization>>('/organizations/onboarding/generate-workflow')).data.data,
  });
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async () => (await http.post<ApiEnvelope<Organization>>('/organizations/onboarding/complete')).data.data,
  });
}

export interface ImportPreview {
  headers: string[];
  mapping: Record<string, string | null>;
  sampleRows: Record<string, string>[];
  totalRows: number;
  rows: Record<string, string>[];
}

export function useImportPreview() {
  return useMutation({
    mutationFn: async ({ file, entity }: { file: File; entity: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity', entity);
      return (await http.post<ApiEnvelope<ImportPreview>>('/import/csv/preview', formData)).data.data;
    },
  });
}

export function useImportCommit() {
  return useMutation({
    mutationFn: async (payload: { entity: string; rows: Record<string, string>[]; mapping: Record<string, string> }) =>
      (await http.post<ApiEnvelope<{ successCount: number; failedCount: number; results: { row: number; success: boolean; error?: string }[] }>>(
        '/import/csv/commit',
        payload
      )).data.data,
  });
}

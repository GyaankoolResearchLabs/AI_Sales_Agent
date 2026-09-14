import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { AIRecommendation } from '../types';

export function useRecommendations(status?: string) {
  return useQuery({
    queryKey: ['recommendations', status],
    queryFn: async () => (await http.get<ApiEnvelope<AIRecommendation[]>>('/recommendations', { params: status ? { status } : {} })).data.data,
  });
}

export function useGenerateRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => (await http.post<ApiEnvelope<AIRecommendation>>('/recommendations/generate', { dealId })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useCreateQuickRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { dealId: string; channel: string; title: string; reason: string; subject?: string; body: string }) =>
      (await http.post<ApiEnvelope<AIRecommendation>>('/recommendations/quick', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function usePrepareRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await http.post<ApiEnvelope<AIRecommendation>>(`/recommendations/${id}/prepare`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useEditRecommendationContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject?: string; body: string }) =>
      (await http.patch<ApiEnvelope<AIRecommendation>>(`/recommendations/${id}/content`, { subject, body })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useApproveRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await http.post<ApiEnvelope<AIRecommendation>>(`/recommendations/${id}/approve`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useRejectRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await http.post<ApiEnvelope<AIRecommendation>>(`/recommendations/${id}/reject`, { reason })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}

export function useExecuteRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await http.post<ApiEnvelope<{ recommendation: AIRecommendation; outcome: { success: boolean; error?: string } }>>(`/recommendations/${id}/execute`))
        .data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

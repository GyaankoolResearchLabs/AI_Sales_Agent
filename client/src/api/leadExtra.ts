import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { Activity } from '../types';

export function useLeadTimeline(leadId: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'timeline', leadId],
    queryFn: async () => (await http.get<ApiEnvelope<Activity[]>>(`/leads/${leadId}/timeline`)).data.data,
    enabled: Boolean(leadId),
  });
}

export function useRescoreLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => (await http.post<ApiEnvelope<{ score: number; breakdown: Record<string, number> }>>(`/leads/${leadId}/rescore`)).data.data,
    onSuccess: (_d, leadId) => qc.invalidateQueries({ queryKey: ['leads', 'detail', leadId] }),
  });
}

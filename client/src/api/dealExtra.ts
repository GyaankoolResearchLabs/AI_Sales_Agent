import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { Deal, Activity, Conversation, DealScore, Task, Contact } from '../types';

/** GET /api/deals/:id/detail (Phase 3) — the deal plus activities, conversations, tasks, and contacts in one real call. */
export function useDealDetail(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deals', 'detail', dealId],
    queryFn: async () =>
      (
        await http.get<ApiEnvelope<{ deal: Deal; activities: Activity[]; conversations: Conversation[]; tasks: Task[]; contacts: Contact[] }>>(
          `/deals/${dealId}/detail`
        )
      ).data.data,
    enabled: Boolean(dealId),
  });
}

export function useChangeDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stageKey }: { dealId: string; stageKey: string }) =>
      (await http.patch<ApiEnvelope<Deal>>(`/deals/${dealId}/stage`, { stageKey })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deals', 'detail', vars.dealId] });
      qc.invalidateQueries({ queryKey: ['forecast'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAnalyzeDealFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => (await http.post<ApiEnvelope<DealScore>>(`/ai/deals/${dealId}/analyze`)).data.data,
    onSuccess: (_d, dealId) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deals', 'detail', dealId] });
    },
  });
}

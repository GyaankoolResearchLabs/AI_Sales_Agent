import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { DailyBriefing, DealScore, AIInsight, AIRecommendation, AutonomySettings } from '../types';

export interface ChatResult {
  message: string;
  suggestedActions: { label: string; type: string; payload?: Record<string, unknown> }[];
  toolResults: { name: string; result: unknown }[];
}

export function useDailyBriefing() {
  return useQuery({
    queryKey: ['dashboard', 'briefing'],
    queryFn: async () => (await http.get<ApiEnvelope<DailyBriefing>>('/dashboard/briefing')).data.data,
  });
}

export function useChat() {
  return useMutation({
    mutationFn: async (payload: { message: string; history?: { role: string; content: string }[] }) =>
      (await http.post<ApiEnvelope<ChatResult>>('/ai/chat', payload)).data.data,
  });
}

export function useAnalyzeDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => (await http.post<ApiEnvelope<DealScore>>(`/ai/deals/${dealId}/analyze`)).data.data,
    onSuccess: (_data, dealId) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deals', 'detail', dealId] });
    },
  });
}

export function useRecommendNextAction() {
  return useMutation({
    mutationFn: async (dealId: string) => (await http.post<ApiEnvelope<AIRecommendation>>(`/ai/deals/${dealId}/recommend`)).data.data,
  });
}

export function useGenerateEmail() {
  return useMutation({
    mutationFn: async (payload: { dealId?: string; contactId?: string; leadId?: string; purpose?: string; tone?: string; reason?: string }) =>
      (await http.post<ApiEnvelope<{ subject: string; body: string }>>('/ai/generate/email', payload)).data.data,
  });
}

export function useGenerateWhatsApp() {
  return useMutation({
    mutationFn: async (payload: { dealId?: string; contactId?: string; leadId?: string; reason?: string }) =>
      (await http.post<ApiEnvelope<{ body: string }>>('/ai/generate/whatsapp', payload)).data.data,
  });
}

export interface CallScript {
  opening: string;
  context: string;
  discoveryQuestions: string[];
  objectionHandling: { objection: string; response: string }[];
  closing: string;
}

export function useGenerateCallScript() {
  return useMutation({
    mutationFn: async (payload: { dealId?: string; contactId?: string; reason?: string }) =>
      (await http.post<ApiEnvelope<CallScript>>('/ai/generate/call-script', payload)).data.data,
  });
}

export function useForecast(groupBy: 'rep' | 'stage' | 'month' = 'stage') {
  return useQuery({
    queryKey: ['forecast', groupBy],
    queryFn: async () => (await http.get<ApiEnvelope<Record<string, unknown>>>('/forecast', { params: { groupBy } })).data.data,
  });
}

export function useInsights(unreadOnly = false) {
  return useQuery({
    queryKey: ['insights', unreadOnly],
    queryFn: async () => (await http.get<ApiEnvelope<AIInsight[]>>('/insights', { params: { unreadOnly } })).data.data,
  });
}

export function useRunAnomalyDetection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await http.post('/ai/anomalies/run')).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  });
}

// Canonical path per Phase 6 spec: GET/PATCH /api/settings/autonomy (the older /api/autonomy
// GET/PUT routes still exist server-side, pointed at the same controller, kept for compatibility).
export function useAutonomySettings() {
  return useQuery({
    queryKey: ['autonomy'],
    queryFn: async () => (await http.get<ApiEnvelope<AutonomySettings>>('/settings/autonomy')).data.data,
  });
}

export function useUpdateAutonomySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutonomySettings>) => (await http.patch<ApiEnvelope<AutonomySettings>>('/settings/autonomy', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autonomy'] }),
  });
}

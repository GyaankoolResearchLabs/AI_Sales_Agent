import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';

export interface ContentDraft {
  _id: string;
  organization: string;
  type: 'email' | 'whatsapp' | 'call_script' | 'proposal';
  deal?: string;
  contact?: string;
  purpose?: string;
  tone?: string;
  section?: string;
  content: Record<string, unknown>;
  status: 'draft' | 'approved' | 'sent';
  regeneratedFrom?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContentRequest {
  dealId?: string;
  contactId?: string;
  purpose?: string;
  tone?: string;
  reason?: string;
}

/** Real content-generation endpoints (Phase 5) — each call persists a ContentDraft document. */
export function useGenerateEmailDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContentRequest) => (await http.post<ApiEnvelope<ContentDraft>>('/content/email', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useGenerateWhatsAppDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContentRequest) => (await http.post<ApiEnvelope<ContentDraft>>('/content/whatsapp', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useGenerateCallScriptDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContentRequest) => (await http.post<ApiEnvelope<ContentDraft>>('/content/call-script', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useGenerateProposalDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { dealId: string; section?: string }) => (await http.post<ApiEnvelope<ContentDraft>>('/content/proposal', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useRegenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => (await http.post<ApiEnvelope<ContentDraft>>(`/content/${draftId}/regenerate`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useContentDrafts(dealId?: string) {
  return useQuery({
    queryKey: ['content', 'list', dealId],
    queryFn: async () => (await http.get<ApiEnvelope<ContentDraft[]>>('/content', { params: dealId ? { dealId } : {} })).data.data,
    enabled: Boolean(dealId),
  });
}

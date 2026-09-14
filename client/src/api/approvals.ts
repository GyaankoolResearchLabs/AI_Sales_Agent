import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { ContentDraft } from './content';

export type PermissionCategory = 'emailSending' | 'whatsappSending' | 'crmUpdates' | 'meetingScheduling' | 'proposalCreation' | 'taskCreation';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  _id: string;
  organization: string;
  title: string;
  reason: string;
  deal?: { _id: string; name: string; value?: number };
  lead?: { _id: string; name: string };
  contact?: { _id: string; name: string };
  contentDraft?: ContentDraft;
  confidence: number;
  permissionCategory: PermissionCategory;
  status: ApprovalStatus;
  decidedBy?: { _id: string; name: string };
  decidedAt?: string;
  rejectedReason?: string;
  autoExecuted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/approvals — the real Phase 6 Approval Center data source (distinct from the older /api/recommendations flow). */
export function useApprovals(status?: ApprovalStatus | '') {
  return useQuery({
    queryKey: ['approvals', status],
    queryFn: async () => (await http.get<ApiEnvelope<Approval[]>>('/approvals', { params: status ? { status } : {} })).data.data,
  });
}

function invalidateApprovalDependents(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['approvals'] });
  qc.invalidateQueries({ queryKey: ['audit'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['content'] });
  qc.invalidateQueries({ queryKey: ['deals'] });
}

export interface SendResult {
  attempted: boolean;
  success?: boolean;
  provider?: string;
  environment?: 'production' | 'development';
  providerMessageId?: string;
  error?: string;
}

interface ApproveResponse {
  data: Approval;
  sendResult?: SendResult;
}

/** Approve real-executes an email/whatsapp send when applicable — the response carries the actual outcome, not just the status flip. */
export function useApproveApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await http.post<ApiEnvelope<Approval> & { sendResult?: SendResult }>(`/approvals/${id}/approve`);
      return { data: res.data.data, sendResult: res.data.sendResult } as ApproveResponse;
    },
    onSuccess: () => invalidateApprovalDependents(qc),
  });
}

export function useRejectApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (await http.post<ApiEnvelope<Approval>>(`/approvals/${id}/reject`, { reason })).data.data,
    onSuccess: () => invalidateApprovalDependents(qc),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';
import { Notification, AuditLogEntry, Organization, Integration, User } from '../types';

// --- Notifications ---
export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const res = await http.get<ApiEnvelope<Notification[]>>('/notifications', { params: { unreadOnly } });
      return { items: res.data.data, unreadCount: res.data.unreadCount ?? 0 };
    },
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await http.post(`/notifications/${id}/read`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await http.post('/notifications/read-all')).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// --- Audit ---
export function useAuditLogs(page = 1) {
  return useQuery({
    queryKey: ['audit', page],
    queryFn: async () => {
      const res = await http.get<ApiEnvelope<AuditLogEntry[]>>('/audit', { params: { page } });
      return { items: res.data.data, pagination: res.data.pagination };
    },
  });
}

// --- Organization / Settings ---
export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => (await http.get<ApiEnvelope<Organization>>('/organizations')).data.data,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Organization>) => (await http.patch<ApiEnvelope<Organization>>('/organizations', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}

export function useUpdateDealStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: Organization['dealStages']) => (await http.put<ApiEnvelope<Organization['dealStages']>>('/organizations/deal-stages', { stages })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}

// --- Users / Team ---
export function useTeam() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await http.get<ApiEnvelope<User[]>>('/users')).data.data,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; email: string; role: string; title?: string }) =>
      (await http.post<ApiEnvelope<{ id: string; temporaryPassword: string }>>('/users', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<User> & { isActive?: boolean } }) =>
      (await http.patch(`/users/${id}`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// --- Integrations ---
export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => (await http.get<ApiEnvelope<Integration[]>>('/integrations')).data.data,
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => (await http.post<ApiEnvelope<Integration>>(`/integrations/${provider}/connect`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => (await http.post<ApiEnvelope<Integration>>(`/integrations/${provider}/disconnect`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

// --- Manager dashboard ---
export interface ManagerDashboardData {
  range: { start: string; end: string };
  teamSize: number;
  pipeline: { totalValue: number; totalCount: number; byStage: { key: string; label: string; value: number; count: number }[] };
  byRep: { name: string; pipelineValue: number; dealCount: number; won: number; lost: number }[];
  winRate: number;
  revenueForecast: number;
  avgVelocityDays: number | null;
  atRiskDeals: number;
  stalledDeals: number;
}

export function useManagerDashboard(range: string) {
  return useQuery({
    queryKey: ['manager-dashboard', range],
    queryFn: async () => (await http.get<ApiEnvelope<ManagerDashboardData>>('/dashboard/manager', { params: { range } })).data.data,
  });
}

// --- Global search ---
export interface SearchResults {
  leads: { id: string; type: string; label: string; sublabel?: string }[];
  contacts: { id: string; type: string; label: string; sublabel?: string }[];
  companies: { id: string; type: string; label: string; sublabel?: string }[];
  deals: { id: string; type: string; label: string; sublabel?: string }[];
  activities: { id: string; type: string; label: string; sublabel?: string }[];
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: async () => (await http.get<ApiEnvelope<SearchResults>>('/search', { params: { q } })).data.data,
    enabled: q.trim().length > 1,
  });
}

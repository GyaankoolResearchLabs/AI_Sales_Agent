import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: string | number;
}

export interface ReportDefinition {
  _id?: string;
  name: string;
  dataset: 'deals' | 'leads' | 'activities' | 'contacts';
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  metric?: 'count' | 'sum' | 'avg';
  metricField?: string;
  chartType: 'table' | 'bar' | 'line' | 'pie';
}

export interface ReportRunResult {
  dataset: string;
  chartType: string;
  rows: Record<string, unknown>[];
  groups?: { key: string; value: number }[];
}

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await http.get<ApiEnvelope<ReportDefinition[]>>('/reports')).data.data,
  });
}

export function usePreviewReport() {
  return useMutation({
    mutationFn: async (def: ReportDefinition) => (await http.post<ApiEnvelope<ReportRunResult>>('/reports/preview', def)).data.data,
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (def: ReportDefinition) => (await http.post<ApiEnvelope<ReportDefinition>>('/reports', def)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await http.delete(`/reports/${id}`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

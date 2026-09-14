import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { http, ApiEnvelope } from './http';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ListResult<T> {
  items: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Builds a consistent set of TanStack Query hooks (list/get/create/update/remove)
 * for one REST resource, mirroring the server's CRUD factory so every CRM
 * module (leads, contacts, companies, deals, activities, tasks, products)
 * gets pagination/search/mutation/cache-invalidation behavior without
 * reimplementing it per page.
 */
export function createResourceHooks<T, TCreate = Partial<T>, TUpdate = Partial<T>>(resourceKey: string, basePath: string) {
  function useList(params: ListParams = {}, options?: Partial<UseQueryOptions<ListResult<T>>>) {
    return useQuery({
      queryKey: [resourceKey, 'list', params],
      queryFn: async () => {
        const res = await http.get<ApiEnvelope<T[]>>(basePath, { params });
        return { items: res.data.data, pagination: res.data.pagination };
      },
      ...options,
    });
  }

  function useGet(id: string | undefined, options?: Partial<UseQueryOptions<T>>) {
    return useQuery({
      queryKey: [resourceKey, 'detail', id],
      queryFn: async () => {
        const res = await http.get<ApiEnvelope<T>>(`${basePath}/${id}`);
        return res.data.data;
      },
      enabled: Boolean(id),
      ...options,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (payload: TCreate) => {
        const res = await http.post<ApiEnvelope<T>>(basePath, payload);
        return res.data.data;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [resourceKey] });
      },
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, payload }: { id: string; payload: TUpdate }) => {
        const res = await http.patch<ApiEnvelope<T>>(`${basePath}/${id}`, payload);
        return res.data.data;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [resourceKey] });
      },
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await http.delete(`${basePath}/${id}`);
        return id;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [resourceKey] });
      },
    });
  }

  return { useList, useGet, useCreate, useUpdate, useRemove };
}

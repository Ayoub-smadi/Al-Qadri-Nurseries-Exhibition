import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const QUOTATIONS_KEY = ["/api/quotations"];

export function useQuotations() {
  return useQuery({
    queryKey: QUOTATIONS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/quotations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quotations");
      return res.json();
    },
  });
}

export function useQuotation(id: number) {
  return useQuery({
    queryKey: ["/api/quotations", id],
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${id}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch quotation");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `خطأ: ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTATIONS_KEY });
    },
  });
}

export function useUpdateQuotation(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `خطأ: ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", id] });
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete quotation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTATIONS_KEY });
    },
  });
}

export function useParseText() {
  return useMutation({
    mutationFn: async (data: { text: string }) => {
      const res = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to parse text");
      return res.json();
    },
  });
}

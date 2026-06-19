import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

declare const __REPLIT_DEV_DOMAIN__: string;

function getApiBase(): string {
  // Use relative URL — the Vite proxy forwards /api → localhost:8080
  // This avoids the double-proxy issue (browser → Replit edge → Vite → API)
  // that causes POST bodies to be rejected.
  return "/api";
}

const QUOTATIONS_KEY = ["/api/quotations"];

export function useQuotations() {
  return useQuery({
    queryKey: QUOTATIONS_KEY,
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/quotations`);
      if (!res.ok) throw new Error("Failed to fetch quotations");
      return res.json();
    },
  });
}

export function useQuotation(id: number) {
  return useQuery({
    queryKey: ["/api/quotations", id],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/quotations/${id}`);
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
      const res = await fetch(`${getApiBase()}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      const res = await fetch(`${getApiBase()}/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      const res = await fetch(`${getApiBase()}/quotations/${id}`, {
        method: "DELETE",
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
      const res = await fetch(`${getApiBase()}/parse-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to parse text");
      return res.json();
    },
  });
}

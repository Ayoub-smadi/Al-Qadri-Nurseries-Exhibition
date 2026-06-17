import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PRODUCTS_KEY = ["/api/products"];

export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

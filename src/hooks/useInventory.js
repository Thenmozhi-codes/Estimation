import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stockRepo,
  stockMovementRepo,
  variantRepo,
  productRepo,
} from "@/lib/api/repos";
import { recordMovement } from "@/lib/services/stockService";
import { qk } from "./queryKeys";

export const useStockList = () =>
  useQuery({
    queryKey: qk.stock,
    queryFn: () => stockRepo.list(),
  });

export const useStockMovements = (variantId) =>
  useQuery({
    queryKey: ["stockMovements", variantId || "all"],
    queryFn: () =>
      variantId
        ? stockMovementRepo.list({ variantId })
        : stockMovementRepo.list(),
    enabled: true,
  });

export const useAdjustStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity, notes }) =>
      recordMovement({
        variantId,
        type: "adjustment",
        quantity,
        referenceType: "manual",
        notes: notes || "Manual adjustment",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.stock });
      qc.invalidateQueries({ queryKey: ["stockMovements"] });
    },
  });
};

/** Enrich stock rows with product + variant info */
export const useStockEnriched = () => {
  const stock = useStockList();
  const variants = useQuery({
    queryKey: ["allVariants"],
    queryFn: () => variantRepo.list(),
  });
  const products = useQuery({
    queryKey: ["allProducts"],
    queryFn: () => productRepo.list(),
  });

  const isLoading =
    stock.isLoading || variants.isLoading || products.isLoading;

  const rows = (stock.data || []).map((s) => {
    const v = variants.data?.find((x) => x.id === s.variantId);
    const p = v ? products.data?.find((x) => x.id === v.productId) : null;
    return {
      ...s,
      variantSku: v?.sku || "—",
      productName: p?.name || "—",
      productSku: p?.sku || "",
      lowStock: s.quantity <= (s.reorderLevel || 0),
    };
  });

  return { rows, isLoading, variants: variants.data || [], products: products.data || [] };
};
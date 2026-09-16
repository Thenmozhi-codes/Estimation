import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  productRepo,
  variantRepo,
  variantAttributeRepo,
  priceRepo,
  stockRepo,
} from "@/lib/api/repos";
import { productService } from "@/lib/services/productService";
import { qk } from "./queryKeys";

/* ─────── Products ─────── */

export const useProducts = (filters = {}) =>
  useQuery({
    queryKey: qk.products(filters),
    queryFn: () => productRepo.list(filters),
  });

export const useProduct = (id) =>
  useQuery({
    queryKey: qk.product(id),
    queryFn: () => productRepo.get(id),
    enabled: !!id,
  });

export const useProductVariants = (productId) =>
  useQuery({
    queryKey: qk.variants(productId),
    queryFn: () => variantRepo.list({ productId }),
    enabled: !!productId,
  });

export const useVariantAttributes = (variantId) =>
  useQuery({
    queryKey: qk.variantAttributes(variantId),
    queryFn: () => variantAttributeRepo.list({ variantId }),
    enabled: !!variantId,
  });

export const useVariantPrices = (variantId) =>
  useQuery({
    queryKey: qk.prices(variantId),
    queryFn: () => priceRepo.list({ variantId }),
    enabled: !!variantId,
  });

export const useStock = () =>
  useQuery({
    queryKey: qk.stock,
    queryFn: () => stockRepo.list(),
  });

/* ─────── Mutations ─────── */

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => productService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: qk.stock });
    },
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => productRepo.update(id, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: qk.product(v.id) });
    },
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => productRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};
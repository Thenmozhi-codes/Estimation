import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  unitRepo,
  brandRepo,
  taxRepo,
  attributeRepo,
  attributeValueRepo,
  categoryRepo,
  categoryAttributeRepo,
} from "@/lib/api/repos";
import { qk } from "./queryKeys";

/* ─────────────────────── Units ─────────────────────── */

export const useUnits = () =>
  useQuery({
    queryKey: qk.units,
    queryFn: () => unitRepo.list({ isActive: true }),
  });

export const useCreateUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => unitRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units }),
  });
};

export const useUpdateUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => unitRepo.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units }),
  });
};

export const useDeleteUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => unitRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.units }),
  });
};

/* ─────────────────────── Brands ─────────────────────── */

export const useBrands = () =>
  useQuery({
    queryKey: qk.brands,
    queryFn: () => brandRepo.list({ isActive: true }),
  });

export const useCreateBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => brandRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.brands }),
  });
};

export const useUpdateBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => brandRepo.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.brands }),
  });
};

export const useDeleteBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => brandRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.brands }),
  });
};

/* ─────────────────────── Taxes ─────────────────────── */

export const useTaxes = () =>
  useQuery({
    queryKey: qk.taxes,
    queryFn: () => taxRepo.list({ isActive: true }),
  });

export const useCreateTax = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => taxRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taxes }),
  });
};

export const useUpdateTax = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => taxRepo.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taxes }),
  });
};

export const useDeleteTax = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => taxRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taxes }),
  });
};

/* ─────────────────────── Attributes ─────────────────────── */

export const useAttributes = () =>
  useQuery({
    queryKey: qk.attributes,
    queryFn: () => attributeRepo.list({ isActive: true }),
  });

export const useCreateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => attributeRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attributes }),
  });
};

export const useUpdateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => attributeRepo.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attributes }),
  });
};

export const useDeleteAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => attributeRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attributes }),
  });
};

/* ─────────────────────── Attribute Values ─────────────────────── */

export const useAttributeValues = (attributeId) =>
  useQuery({
    queryKey: qk.attributeValues(attributeId),
    queryFn: () => attributeValueRepo.list({ attributeId }),
    enabled: !!attributeId,
  });

export const useCreateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => attributeValueRepo.create(dto),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.attributeValues(vars.attributeId) }),
  });
};

export const useUpdateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => attributeValueRepo.update(id, patch),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.attributeValues(vars.attributeId) }),
  });
};

export const useDeleteAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => attributeValueRepo.remove(id),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.attributeValues(vars.attributeId) }),
  });
};

/* ─────────────────────── Categories ─────────────────────── */

export const useCategories = () =>
  useQuery({
    queryKey: qk.categories,
    queryFn: () => categoryRepo.list({ isActive: true }),
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => categoryRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => categoryRepo.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => categoryRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};

/* ─────────────────────── Category ↔ Attribute Mapping ─────────────────────── */

export const useCategoryAttributes = (categoryId) =>
  useQuery({
    queryKey: qk.categoryAttributes(categoryId),
    queryFn: () => categoryAttributeRepo.list({ categoryId }),
    enabled: !!categoryId,
  });

export const useUpsertCategoryAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, attributeId, isRequired, sortOrder }) => {
      const existing = await categoryAttributeRepo.list({
        categoryId,
        attributeId,
      });
      if (existing.length) {
        return categoryAttributeRepo.update(existing[0].id, {
          isRequired,
          sortOrder,
        });
      }
      return categoryAttributeRepo.create({
        categoryId,
        attributeId,
        isRequired,
        sortOrder,
      });
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: qk.categoryAttributes(vars.categoryId),
      }),
  });
};

export const useRemoveCategoryAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => categoryAttributeRepo.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoryAttributes"] });
    },
  });
};
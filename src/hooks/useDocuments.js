import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  quotationRepo,
  quotationItemRepo,
  invoiceRepo,
  invoiceItemRepo,
  purchaseRepo,
  purchaseItemRepo,
  paymentRepo,
  partyRepo,
} from "@/lib/api/repos";
import { quotationService } from "@/lib/services/quotationService";
import { invoiceService } from "@/lib/services/invoiceService";
import { purchaseService } from "@/lib/services/purchaseService";
import { qk } from "./queryKeys";

/* ─────────────── Quotations ─────────────── */

export const useQuotations = () =>
  useQuery({ queryKey: qk.quotations, queryFn: () => quotationRepo.list() });

export const useQuotation = (id) =>
  useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationRepo.get(id),
    enabled: !!id,
  });

export const useQuotationItems = (id) =>
  useQuery({
    queryKey: qk.quotationItems(id),
    queryFn: () => quotationItemRepo.list({ quotationId: id }),
    enabled: !!id,
  });

export const useCreateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => quotationService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quotations }),
  });
};

export const useUpdateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => quotationRepo.update(id, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.quotations });
      qc.invalidateQueries({ queryKey: ["quotation", v.id] });
    },
  });
};

export const useDeleteQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => quotationRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quotations }),
  });
};

/* ─────────────── Invoices ─────────────── */

export const useInvoices = () =>
  useQuery({ queryKey: qk.invoices, queryFn: () => invoiceRepo.list() });

export const useInvoice = (id) =>
  useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceRepo.get(id),
    enabled: !!id,
  });

export const useInvoiceItems = (id) =>
  useQuery({
    queryKey: qk.invoiceItems(id),
    queryFn: () => invoiceItemRepo.list({ invoiceId: id }),
    enabled: !!id,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => invoiceService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.stock });
    },
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => invoiceRepo.update(id, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: ["invoice", v.id] });
    },
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => invoiceRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invoices }),
  });
};

export const useConvertQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quotationId) => invoiceService.fromQuotation(quotationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.quotations });
      qc.invalidateQueries({ queryKey: qk.stock });
    },
  });
};

/* ─────────────── Payments ─────────────── */

export const usePayments = () =>
  useQuery({ queryKey: qk.payments, queryFn: () => paymentRepo.list() });

export const useCreatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => paymentRepo.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.invoices });
    },
  });
};

export const useDeletePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => paymentRepo.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.invoices });
    },
  });
};

/* ─────────────── Purchases (F7 needs them) ─────────────── */

export const usePurchases = () =>
  useQuery({ queryKey: qk.purchases, queryFn: () => purchaseRepo.list() });

export const usePurchase = (id) =>
  useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchaseRepo.get(id),
    enabled: !!id,
  });

export const usePurchaseItems = (id) =>
  useQuery({
    queryKey: ["purchaseItems", id],
    queryFn: () => purchaseItemRepo.list({ purchaseId: id }),
    enabled: !!id,
  });

export const useCreatePurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => purchaseService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.purchases });
      qc.invalidateQueries({ queryKey: qk.stock });
    },
  });
};
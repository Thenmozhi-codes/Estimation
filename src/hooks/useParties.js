import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  partyRepo,
  quotationRepo,
  invoiceRepo,
  paymentRepo,
} from "@/lib/api/repos";
import { qk } from "./queryKeys";

/* ─────────────── List + single ─────────────── */

export const useParties = (filters = {}) =>
  useQuery({
    queryKey: qk.parties(filters),
    queryFn: () => partyRepo.list(filters),
  });

export const useParty = (id) =>
  useQuery({
    queryKey: qk.party(id),
    queryFn: () => partyRepo.get(id),
    enabled: !!id,
  });

/* ─────────────── CRUD ─────────────── */

export const useCreateParty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto) => partyRepo.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parties"] }),
  });
};

export const useUpdateParty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => partyRepo.update(id, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: qk.party(v.id) });
    },
  });
};

export const useDeleteParty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => partyRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parties"] }),
  });
};

/* ─────────────── Related documents for one party ─────────────── */

export const usePartyQuotations = (partyId) =>
  useQuery({
    queryKey: ["partyQuotations", partyId],
    queryFn: () => quotationRepo.list({ partyId }),
    enabled: !!partyId,
  });

export const usePartyInvoices = (partyId) =>
  useQuery({
    queryKey: ["partyInvoices", partyId],
    queryFn: () => invoiceRepo.list({ partyId }),
    enabled: !!partyId,
  });

export const usePartyPayments = (partyId) =>
  useQuery({
    queryKey: ["partyPayments", partyId],
    queryFn: () => paymentRepo.list({ partyId }),
    enabled: !!partyId,
  });
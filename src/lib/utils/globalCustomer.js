import { partyRepo } from "@/lib/api/repos";

/*
 * The "global" customer used when a quotation / invoice is made without
 * choosing a customer (walk-in sale). It is created once and then reused.
 */
export const GLOBAL_CUSTOMER_NAME = "Walk-in Customer";

let pending = null;

export function ensureGlobalCustomer(queryClient) {
  /* several forms asking at the same moment share one lookup */
  if (!pending) {
    pending = (async () => {
      const parties = (await partyRepo.list()) || [];

      const found =
        parties.find((party) => party.isGlobal) ||
        parties.find(
          (party) =>
            String(party.name || "").trim().toLowerCase() ===
            GLOBAL_CUSTOMER_NAME.toLowerCase(),
        );

      if (found) return found;

      const created = await partyRepo.create({
        name: GLOBAL_CUSTOMER_NAME,
        type: "customer",
        isGlobal: true,
        status: "active",
        phone: "",
        email: "",
        gstin: "",
        address: "",
      });

      /* refresh the cached customer lists so the new entry appears */
      queryClient?.invalidateQueries({
        predicate: (query) =>
          JSON.stringify(query.queryKey).toLowerCase().includes("part"),
      });

      return created;
    })().finally(() => {
      pending = null;
    });
  }

  return pending;
}

export const isGlobalCustomer = (party) =>
  Boolean(party?.isGlobal) ||
  String(party?.name || "").trim().toLowerCase() ===
    GLOBAL_CUSTOMER_NAME.toLowerCase();
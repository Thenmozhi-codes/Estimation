import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { attributeValueRepo } from "@/lib/api/repos";
import { qk } from "@/hooks/queryKeys";
import {
  useAttributes,
  useCategoryAttributes,
} from "@/hooks/useMasters";

/**
 * Live, read-only view of what Attribute Master has configured for a
 * Product Type. This is the single place both Product Master (form +
 * detail) pull from, so anything added/edited/removed on the
 * Attributes page shows up here immediately — no duplication, no
 * stale copies.
 */
export function useAttributeConfig(categoryId) {
  const { data: mappings = [], isLoading: mappingsLoading } =
    useCategoryAttributes(categoryId);
  const { data: attributes = [], isLoading: attributesLoading } =
    useAttributes();

  const sortedMappings = useMemo(
    () => [...mappings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [mappings],
  );

  const valueQueries = useQueries({
    queries: sortedMappings.map((m) => ({
      queryKey: qk.attributeValues(m.attributeId),
      queryFn: () => attributeValueRepo.list({ attributeId: m.attributeId }),
      enabled: !!m.attributeId,
    })),
  });

  const rows = useMemo(
    () =>
      sortedMappings
        .map((mapping, i) => {
          const attribute = attributes.find((a) => a.id === mapping.attributeId);
          if (!attribute) return null;
          const values = (valueQueries[i]?.data || []).filter(
            (v) => v.isActive !== false,
          );
          return {
            mapping,
            attribute,
            values,
            isRequired: mapping.isRequired ?? true,
          };
        })
        .filter(Boolean),
    [sortedMappings, attributes, valueQueries],
  );

  const isLoading =
    !!categoryId &&
    (mappingsLoading ||
      attributesLoading ||
      valueQueries.some((q) => q.isLoading));

  return { rows, isLoading };
}

export function AttributeConfigPreview({
  categoryId,
  categoryName,
  dense = false,
}) {
  const navigate = useNavigate();
  const { rows, isLoading } = useAttributeConfig(categoryId);

  if (!categoryId) return null;

  if (isLoading) {
    return (
      <div className={dense ? "p-4" : "p-5"}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={`rounded-xl border border-amber-500/25 bg-amber-500/5 ${
          dense ? "p-3.5" : "p-4"
        } flex items-start gap-3`}
      >
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-ink">
            No attributes configured for {categoryName || "this Product Type"} yet
          </div>
          <p className="text-[11px] text-muted mt-1 leading-5">
            Billing for this Product Type won&apos;t offer any Thickness,
            Length or Grade choices until you add them in Attribute Master.
          </p>
          <Button
            size="sm"
            variant="subtle"
            className="mt-2.5"
            onClick={() => navigate(`/master/attributes?type=${categoryId}`)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Configure in Attribute Master
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-primary-500/15 bg-primary-500/5 ${
        dense ? "p-3.5" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] text-muted leading-5">
          <span className="font-bold text-ink">
            {categoryName || "This Product Type"}
          </span>{" "}
          inherits {rows.length} attribute{rows.length === 1 ? "" : "s"} from
          Attribute Master. Edit them there and every product of this type
          updates automatically.
        </div>
        <button
          type="button"
          onClick={() => navigate(`/master/attributes?type=${categoryId}`)}
          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
        >
          Manage
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map(({ attribute, values, isRequired }) => (
          <div key={attribute.id} className="flex items-start gap-2.5">
            <div className="text-[10px] font-bold text-ink w-20 shrink-0 pt-1 flex items-center gap-1">
              {attribute.name}
              {isRequired && (
                <span className="text-primary-500" title="Required">
                  *
                </span>
              )}
            </div>
            <div className="flex-1 flex flex-wrap gap-1.5">
              {values.length === 0 ? (
                <span className="text-[10px] text-muted italic">
                  No allowed values yet
                </span>
              ) : (
                values.map((value) => (
                  <span
                    key={value.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface border border-line text-ink text-[10px] font-semibold"
                  >
                    {value.label}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AttributeConfigPreview;

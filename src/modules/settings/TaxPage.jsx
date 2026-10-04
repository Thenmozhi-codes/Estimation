import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { MasterListPage } from "@/components/master/MasterListPage";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/lib/toast";

import {
  taxSchema,
} from "@/lib/domain/schemas";

import {
  useTaxes,
  useCreateTax,
  useUpdateTax,
  useDeleteTax,
} from "@/hooks/useMasters";

import { companyRepo } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function TaxPage() {
  const qc = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });

  const company = companies[0];

  const { data: taxes = [] } = useTaxes();

  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstTaxId, setGstTaxId] = useState("");

  useEffect(() => {
    if (!company) return;

    setGstEnabled(Boolean(company.gstEnabled));
    setGstTaxId(company.gstTaxId ? String(company.gstTaxId) : "");
  }, [company]);

  const saveGst = useMutation({
    mutationFn: () =>
      companyRepo.update(company.id, {
        ...company,
        gstEnabled: Boolean(gstEnabled),
        gstTaxId: gstEnabled && gstTaxId ? gstTaxId : null,
      }),

    onSuccess: () => {
      toast.success("GST settings saved");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },

    onError: () => {
      toast.error("Unable to save GST settings");
    },
  });

  const activeTaxes = (taxes || []).filter(
    (tax) => tax.isActive !== false,
  );

  return (
    <>
      <MasterListPage
        config={{
          title: "Tax Rates",
          description: "GST and other tax rates",
          moduleKey: "settings",
          tabs: MODULE_TABS.settings,
          schema: taxSchema,
          defaultValues: {
            name: "",
            rate: 18,
            isActive: true,
          },
          entityLabel: "Tax",
          searchKeys: ["name"],
          useList: useTaxes,
          useCreate: useCreateTax,
          useUpdate: useUpdateTax,
          useDelete: useDeleteTax,

          columns: [
            {
              key: "name",
              header: "Tax",
              sortable: true,
            },
            {
              key: "rate",
              header: "Rate",
              sortable: true,
              align: "right",
              render: (r) => `${r.rate}%`,
            },
            {
              key: "isActive",
              header: "Status",
              align: "right",
              render: (r) =>
                r.isActive ? "Active" : "Inactive",
            },
          ],

          fields: [
            {
              name: "name",
              label: "Tax name",
              required: true,
              placeholder: "e.g. GST 18%",
            },
            {
              name: "rate",
              label: "Rate (%)",
              required: true,
              type: "number",
            },
            {
              name: "isActive",
              label: "Status",
              type: "switch",
              switchLabel: "Active",
              colSpan: 2,
            },
          ],
        }}
      />

      {company && (
        <div className="px-3 pb-6 md:px-6">
          <div className="max-w-4xl">
            <Card>
              <CardBody>
                <div className="flex flex-col gap-5">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Global GST Settings
                    </h3>

                    <p className="mt-1 text-xs text-muted">
                      GST is controlled globally from Settings.
                      Quotations and invoices will automatically
                      use this setting.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-line bg-bg/40 p-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Enable GST
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        Automatically apply GST to new quotations
                        and invoices.
                      </p>
                    </div>

                    <Switch
                      checked={gstEnabled}
                      onChange={setGstEnabled}
                      label={gstEnabled ? "Enabled" : "Disabled"}
                    />
                  </div>

                  {gstEnabled && (
                    <Field
                      label="Default GST Rate"
                      hint="This rate will be automatically used in new documents."
                    >
                      {activeTaxes.length > 0 ? (
                        <Select
                          value={gstTaxId}
                          onChange={(e) =>
                            setGstTaxId(e.target.value)
                          }
                        >
                          <option value="">
                            Select GST rate
                          </option>

                          {activeTaxes.map((tax) => (
                            <option
                              key={tax.id}
                              value={String(tax.id)}
                            >
                              {tax.name || "GST"}{" "}
                              {Number(tax.rate) || 0}%
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                          No active tax rates available. Create
                          a GST rate above first.
                        </div>
                      )}
                    </Field>
                  )}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => saveGst.mutate()}
                      disabled={
                        saveGst.isPending ||
                        (gstEnabled && !gstTaxId)
                      }
                    >
                      <Save className="h-4 w-4" />
                      Save GST Settings
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
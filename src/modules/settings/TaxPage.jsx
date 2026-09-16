import { MasterListPage } from "@/components/master/MasterListPage";
import { taxSchema } from "@/lib/domain/schemas";
import { useTaxes, useCreateTax, useUpdateTax, useDeleteTax } from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";

export function TaxPage() {
  return (
    <MasterListPage
      config={{
        title: "Tax Rates",
        description: "GST and other tax rates",
        moduleKey: "settings",
        tabs: MODULE_TABS.settings,
        schema: taxSchema,
        defaultValues: { name: "", rate: 18, isActive: true },
        entityLabel: "Tax",
        searchKeys: ["name"],
        useList: useTaxes,
        useCreate: useCreateTax,
        useUpdate: useUpdateTax,
        useDelete: useDeleteTax,
        columns: [
          { key: "name", header: "Tax", sortable: true },
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
            render: (r) => (r.isActive ? "Active" : "Inactive"),
          },
        ],
        fields: [
          { name: "name", label: "Tax name", required: true, placeholder: "e.g. GST 18%" },
          { name: "rate", label: "Rate (%)", required: true, type: "number" },
          { name: "isActive", label: "Status", type: "switch", switchLabel: "Active", colSpan: 2 },
        ],
      }}
    />
  );
}
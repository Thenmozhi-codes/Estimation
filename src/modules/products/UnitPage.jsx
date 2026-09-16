import { MasterListPage } from "@/components/master/MasterListPage";
import { unitSchema } from "@/lib/domain/schemas";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";

export function UnitPage() {
  return (
    <MasterListPage
      config={{
        title: "Units",
        description: "Units of measure used across products",
        moduleKey: "products",
        tabs: MODULE_TABS.products,
        schema: unitSchema,
        defaultValues: { name: "", code: "", isActive: true },
        entityLabel: "Unit",
        searchKeys: ["name", "code"],
        useList: useUnits,
        useCreate: useCreateUnit,
        useUpdate: useUpdateUnit,
        useDelete: useDeleteUnit,
        columns: [
          { key: "name", header: "Unit", sortable: true },
          { key: "code", header: "Code", sortable: true, hideOnMobile: true },
          {
            key: "isActive",
            header: "Status",
            align: "right",
            render: (r) => (r.isActive ? "Active" : "Inactive"),
          },
        ],
        fields: [
          { name: "name", label: "Unit name", required: true, placeholder: "e.g. Sheet" },
          { name: "code", label: "Code", required: true, placeholder: "e.g. SHT" },
          { name: "isActive", label: "Status", type: "switch", switchLabel: "Active", colSpan: 2 },
        ],
      }}
    />
  );
}
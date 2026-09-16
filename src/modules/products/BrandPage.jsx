import { MasterListPage } from "@/components/master/MasterListPage";
import { brandSchema } from "@/lib/domain/schemas";
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";

export function BrandPage() {
  return (
    <MasterListPage
      config={{
        title: "Brands",
        description: "Manufacturers and brands",
        moduleKey: "products",
        tabs: MODULE_TABS.products,
        schema: brandSchema,
        defaultValues: { name: "", code: "", isActive: true },
        entityLabel: "Brand",
        searchKeys: ["name", "code"],
        useList: useBrands,
        useCreate: useCreateBrand,
        useUpdate: useUpdateBrand,
        useDelete: useDeleteBrand,
        columns: [
          { key: "name", header: "Brand", sortable: true },
          { key: "code", header: "Code", sortable: true, hideOnMobile: true },
          {
            key: "isActive",
            header: "Status",
            align: "right",
            render: (r) => (r.isActive ? "Active" : "Inactive"),
          },
        ],
        fields: [
          { name: "name", label: "Brand name", required: true, placeholder: "e.g. Sharon Gold" },
          { name: "code", label: "Code", required: true, placeholder: "e.g. SHARON_GOLD" },
          { name: "isActive", label: "Status", type: "switch", switchLabel: "Active", colSpan: 2 },
        ],
      }}
    />
  );
}
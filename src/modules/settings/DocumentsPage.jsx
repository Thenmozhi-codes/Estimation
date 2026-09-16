import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { toast } from "@/lib/toast";
import { companyRepo } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function DocumentsPage() {
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  const [form, setForm] = useState({});
  useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  const save = useMutation({
    mutationFn: () => companyRepo.update(company.id, form),
    onSuccess: () => {
      toast.success("Document prefixes saved");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value.toUpperCase() });

  if (!company) return null;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Prefixes used for numbering quotations, invoices and purchases"
        actions={
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.settings} />

      <div className="p-3 md:p-6 max-w-3xl">
        <Card>
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Quotation prefix" hint="e.g. EST → EST-2026-0001">
                <Input
                  value={form.quotationPrefix || ""}
                  onChange={set("quotationPrefix")}
                />
              </Field>
              <Field label="Invoice prefix">
                <Input
                  value={form.invoicePrefix || ""}
                  onChange={set("invoicePrefix")}
                />
              </Field>
              <Field label="Purchase prefix">
                <Input
                  value={form.purchasePrefix || ""}
                  onChange={set("purchasePrefix")}
                />
              </Field>
              <Field label="Payment prefix">
                <Input
                  value={form.paymentPrefix || ""}
                  onChange={set("paymentPrefix")}
                />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
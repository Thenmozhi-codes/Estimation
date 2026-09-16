import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { toast } from "@/lib/toast";
import { companyRepo } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function CompanyPage() {
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
      toast.success("Company settings saved");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!company) return null;

  return (
    <>
      <PageHeader
        title="Company"
        description="Business identity shown on documents"
        actions={
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.settings} />

      <div className="p-3 md:p-6 max-w-3xl space-y-4">
        <Card>
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Display name" className="sm:col-span-2">
                <Input value={form.name || ""} onChange={set("name")} />
              </Field>
              <Field label="Legal name" className="sm:col-span-2">
                <Input value={form.legalName || ""} onChange={set("legalName")} />
              </Field>
              <Field label="GSTIN">
                <Input value={form.gstin || ""} onChange={set("gstin")} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone || ""} onChange={set("phone")} />
              </Field>
              <Field label="Email">
                <Input value={form.email || ""} onChange={set("email")} />
              </Field>
              <Field label="City">
                <Input value={form.city || ""} onChange={set("city")} />
              </Field>
              <Field label="State">
                <Input value={form.state || ""} onChange={set("state")} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.address || ""}
                  onChange={set("address")}
                />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
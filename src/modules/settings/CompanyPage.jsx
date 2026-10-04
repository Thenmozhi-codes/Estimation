import { useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Trash2, Upload } from "lucide-react";
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

/* ==========================================================================
   LOGO HELPERS
========================================================================== */

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_FILE_MB = 2;
const LOGO_MAX_SIDE = 400; // px — plenty for a PDF header, keeps storage small

/*
 * Reads the chosen image and returns a data URL scaled down to LOGO_MAX_SIDE.
 * PNG / WebP keep their transparency; JPEG gets a white background.
 */
function fileToLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the image"));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("This file is not a valid image"));

      image.onload = () => {
        const scale = Math.min(
          1,
          LOGO_MAX_SIDE / Math.max(image.width, image.height),
        );

        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        const isJpeg = file.type === "image/jpeg";

        if (isJpeg) {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
        }

        context.drawImage(image, 0, 0, width, height);

        resolve(
          isJpeg
            ? canvas.toDataURL("image/jpeg", 0.9)
            : canvas.toDataURL("image/png"),
        );
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   PAGE
========================================================================== */

export function CompanyPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  const [form, setForm] = useState({});
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  const save = useMutation({
    mutationFn: () => companyRepo.update(company.id, form),
    onSuccess: () => {
      toast.success("Company settings saved");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => {
      console.error("Company save failed:", error);
      toast.error(error?.message || "Could not save company settings");
    },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  /* LOGO — add / change */
  const onPickLogo = async (event) => {
    const file = event.target.files?.[0];

    /* lets the same file be chosen again later */
    event.target.value = "";

    if (!file) return;

    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP image");
      return;
    }

    if (file.size > LOGO_MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Logo must be smaller than ${LOGO_MAX_FILE_MB} MB`);
      return;
    }

    setLogoBusy(true);

    try {
      const logo = await fileToLogo(file);

      setForm((current) => ({ ...current, logo }));
      toast.success("Logo added. Click Save to apply it.");
    } catch (error) {
      console.error("Logo upload failed:", error);
      toast.error(error?.message || "Could not use this image");
    } finally {
      setLogoBusy(false);
    }
  };

  /* LOGO — remove */
  const onRemoveLogo = () => {
    setForm((current) => ({ ...current, logo: "" }));
    toast.success("Logo removed. Click Save to apply it.");
  };

  if (!company) return null;

  const logo = form.logo || "";
  const logoChanged = (company.logo || "") !== logo;

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

      <div className="p-3 md:p-6 w-full space-y-4">
        {/* LOGO */}
        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-ink">Company logo</div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-bg/40 p-2">
                {logo ? (
                  <img
                    src={logo}
                    alt="Company logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[11px]">No logo</span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoBusy}
                  >
                    <Upload className="h-4 w-4" />
                    {logoBusy ? "Processing…" : logo ? "Change logo" : "Upload logo"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRemoveLogo}
                    disabled={!logo || logoBusy}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={LOGO_TYPES.join(",")}
                    onChange={onPickLogo}
                    className="hidden"
                  />
                </div>

                <p className="mt-2 text-xs text-muted">
                  PNG, JPG or WebP, up to {LOGO_MAX_FILE_MB} MB. Shown at the top
                  of quotation and invoice PDFs.
                </p>

                {logoChanged && (
                  <p className="mt-1 text-xs font-semibold text-amber-600">
                    Not saved yet. Click Save to apply the change.
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* DETAILS */}
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

export default CompanyPage;
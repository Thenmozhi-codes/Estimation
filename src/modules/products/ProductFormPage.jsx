import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Save, Wand2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Switch } from "@/components/ui/Switch";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/FormGrid";
import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";
import { newId } from "@/lib/utils/id";
import {
  useCategories,
  useBrands,
  useAttributes,
  useCategoryAttributes,
  useAttributeValues,
} from "@/hooks/useMasters";
import {
  useProduct,
  useProductVariants,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";
import {
  variantRepo,
  variantAttributeRepo,
  priceRepo,
} from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

const PRICE_TYPES = [
  { key: "purchase",  label: "Purchase" },
  { key: "selling",   label: "Selling" },
  { key: "wholesale", label: "Wholesale" },
  { key: "retail",    label: "Retail" },
  { key: "minimum",   label: "Minimum" },
];

const emptyVariant = () => ({
  tempId: newId(),
  sku: "",
  attributeValues: {},
  prices: {
    purchase: "",
    selling: "",
    wholesale: "",
    retail: "",
    minimum: "",
  },
  openingStock: "",
  reorderLevel: "",
  isDefault: false,
});

/* ─────────────────────────────────────────────────────────────
   SKU builder
   - prefix from category (first 4 letters of first word), fallback "PRD"
   - initials from product name (first letter of each word)
   - result like "PLYW-SGP"
   ───────────────────────────────────────────────────────────── */
function buildProductSku(name, categoryName) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return "";

  let prefix = "PRD";
  if (categoryName) {
    const first = toCode(categoryName).split("_")[0];
    prefix = (first || "PRD").slice(0, 4);
  }

  const initials = cleanName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

  return initials ? `${prefix}-${initials}` : `${prefix}-ITEM`;
}

/* Variant SKU: product SKU + numeric suffix if missing */
function buildVariantSku(productSku, existingVariantSkus, index) {
  const base = (productSku || "VAR").toUpperCase();
  let n = index + 1;
  let candidate = `${base}-${String(n).padStart(2, "0")}`;
  while (existingVariantSkus.includes(candidate)) {
    n += 1;
    candidate = `${base}-${String(n).padStart(2, "0")}`;
  }
  return candidate;
}

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  /* Identity */
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuLocked, setSkuLocked] = useState(false); // true once user types manually
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  /* Variants */
  const [variants, setVariants] = useState([emptyVariant()]);
  const [existingMap, setExistingMap] = useState({});
  const [loaded, setLoaded] = useState(!isEdit);

  /* Load for edit */
  const productQ = useProduct(id);
  const variantsQ = useProductVariants(id);

  useEffect(() => {
    if (!isEdit || loaded) return;
    if (!productQ.data || !variantsQ.data) return;

    const p = productQ.data;
    setName(p.name);
    setSku(p.sku);
    setSkuLocked(true); // editing an existing product — don't auto-overwrite its SKU
    setCategoryId(p.categoryId);
    setBrandId(p.brandId || "");
    setDescription(p.description || "");
    setStatus(p.status || "active");

    (async () => {
      const map = {};
      const loadedVariants = [];
      for (const v of variantsQ.data) {
        const [attrs, prices] = await Promise.all([
          variantAttributeRepo.list({ variantId: v.id }),
          priceRepo.list({ variantId: v.id }),
        ]);
        const attributeValues = {};
        for (const a of attrs) {
          if (a.attributeValueId) attributeValues[a.attributeId] = a.attributeValueId;
          else if (a.rawValue != null) attributeValues[a.attributeId] = a.rawValue;
        }
        const priceMap = {
          purchase: "",
          selling: "",
          wholesale: "",
          retail: "",
          minimum: "",
        };
        for (const pr of prices) {
          if (pr.amount != null) priceMap[pr.priceType] = String(pr.amount);
        }
        const tempId = newId();
        map[tempId] = { variantId: v.id };
        loadedVariants.push({
          tempId,
          sku: v.sku,
          attributeValues,
          prices: priceMap,
          openingStock: "",
          reorderLevel: "",
          isDefault: !!v.isDefault,
        });
      }
      setExistingMap(map);
      setVariants(loadedVariants.length ? loadedVariants : [emptyVariant()]);
      setLoaded(true);
    })();
  }, [isEdit, loaded, productQ.data, variantsQ.data]);

  /* Category attributes (dynamic) */
  const { data: categoryAttrs = [] } = useCategoryAttributes(categoryId);
  const { data: allAttrs = [] } = useAttributes();

  const activeAttrs = useMemo(() => {
    return categoryAttrs
      .map((ca) => {
        const a = allAttrs.find((x) => x.id === ca.attributeId);
        return a
          ? { ...a, isRequired: ca.isRequired, sortOrder: ca.sortOrder }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categoryAttrs, allAttrs]);

  /* Mutations */
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();

  /* ───── Auto SKU (product + first empty variant) ───── */
  const handleAutoSku = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Enter a product name first");
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);
    const suggested = buildProductSku(cleanName, cat?.name);
    if (!suggested) {
      toast.error("Could not build SKU");
      return;
    }

    setSku(suggested);
    setSkuLocked(true);

    // Auto-fill any empty variant SKUs based on the new product SKU
    setVariants((current) => {
      const used = current.map((v) => v.sku).filter(Boolean);
      let idx = 0;
      return current.map((v) => {
        if (v.sku && v.sku.trim()) return v; // keep existing
        idx += 1;
        const nextSku = buildVariantSku(suggested, used, idx - 1);
        used.push(nextSku);
        return { ...v, sku: nextSku };
      });
    });

    toast.success(`SKU suggested: ${suggested}`);
  };

  /* ───── Manual SKU ───── */
  const handleManualSku = (value) => {
    setSku(value.toUpperCase());
    setSkuLocked(true);
  };

  const handleClearSku = () => {
    setSku("");
    setSkuLocked(false);
  };

  /* Variant helpers */
  const addVariant = () =>
    setVariants((v) => {
      const used = v.map((x) => x.sku).filter(Boolean);
      const newSku = sku
        ? buildVariantSku(sku, used, used.length)
        : "";
      return [
        ...v,
        { ...emptyVariant(), sku: newSku, isDefault: v.length === 0 },
      ];
    });

  const removeVariant = (tempId) =>
    setVariants((v) => v.filter((x) => x.tempId !== tempId));

  const updateVariant = (tempId, patch) =>
    setVariants((v) =>
      v.map((x) => (x.tempId === tempId ? { ...x, ...patch } : x)),
    );

  const setVariantAttr = (tempId, attributeId, value) =>
    setVariants((v) =>
      v.map((x) =>
        x.tempId === tempId
          ? {
              ...x,
              attributeValues: { ...x.attributeValues, [attributeId]: value },
            }
          : x,
      ),
    );

  const setVariantPrice = (tempId, priceType, value) =>
    setVariants((v) =>
      v.map((x) =>
        x.tempId === tempId
          ? { ...x, prices: { ...x.prices, [priceType]: value } }
          : x,
      ),
    );

  const suggestVariantSku = (tempId) => {
    const current = variants.find((v) => v.tempId === tempId);
    if (!current) return;
    const used = variants
      .filter((v) => v.tempId !== tempId)
      .map((v) => v.sku)
      .filter(Boolean);
    const base = sku || "VAR";
    // Try to make the variant SKU informative: use the numeric piece if present
    const next = buildVariantSku(base, used, used.length);
    updateVariant(tempId, { sku: next });
  };

  /* Validate */
  const validate = () => {
    if (!name.trim()) return "Product name is required";
    if (!sku.trim()) return "Product SKU is required";
    if (!categoryId) return "Category is required";
    if (!variants.length) return "Add at least one variant";
    for (const v of variants) {
      if (!v.sku.trim()) return "Every variant needs a SKU";
      for (const a of activeAttrs) {
        if (a.isRequired) {
          const val = v.attributeValues[a.id];
          if (val == null || val === "")
            return `${a.name} is required on every variant`;
        }
      }
    }
    return null;
  };

  /* Submit */
  const handleSave = async () => {
    const err = validate();
    if (err) return toast.error(err);

    try {
      if (!isEdit) {
        const payload = {
          name: name.trim(),
          sku: sku.trim(),
          categoryId,
          brandId: brandId || null,
          description,
          status,
          variants: variants.map((v, idx) => ({
            sku: v.sku.trim(),
            isDefault: idx === 0,
            attributes: activeAttrs.map((a) => {
              const val = v.attributeValues[a.id];
              const isSelect = a.dataType === "select";
              return {
                attributeId: a.id,
                attributeValueId: isSelect ? val || null : null,
                rawValue: isSelect
                  ? null
                  : val === "" || val == null
                  ? null
                  : a.dataType === "number"
                  ? Number(val)
                  : a.dataType === "boolean"
                  ? Boolean(val)
                  : val,
              };
            }),
            prices: PRICE_TYPES.map((pt) => ({
              priceType: pt.key,
              amount:
                v.prices[pt.key] === "" ? null : Number(v.prices[pt.key]),
            })),
            openingStock:
              v.openingStock === "" ? 0 : Number(v.openingStock),
            reorderLevel:
              v.reorderLevel === "" ? 0 : Number(v.reorderLevel),
          })),
        };
        const created = await createMut.mutateAsync(payload);
        toast.success("Product created");
        navigate(`/products/${created.id}`);
      } else {
        await updateMut.mutateAsync({
          id,
          patch: {
            name: name.trim(),
            sku: sku.trim(),
            categoryId,
            brandId: brandId || null,
            description,
            status,
          },
        });

        for (const v of variants) {
          const existing = existingMap[v.tempId];
          const variantId = existing?.variantId;
          if (!variantId) continue;

          await variantRepo.update(variantId, { sku: v.sku.trim() });

          const existingAttrs = await variantAttributeRepo.list({ variantId });
          for (const a of activeAttrs) {
            const val = v.attributeValues[a.id];
            const isSelect = a.dataType === "select";
            const row = existingAttrs.find((x) => x.attributeId === a.id);
            const payload = {
              attributeValueId: isSelect ? val || null : null,
              rawValue: isSelect
                ? null
                : val === "" || val == null
                ? null
                : a.dataType === "number"
                ? Number(val)
                : a.dataType === "boolean"
                ? Boolean(val)
                : val,
            };
            if (row) await variantAttributeRepo.update(row.id, payload);
            else
              await variantAttributeRepo.create({
                variantId,
                attributeId: a.id,
                ...payload,
              });
          }

          const existingPrices = await priceRepo.list({ variantId });
          for (const pt of PRICE_TYPES) {
            const raw = v.prices[pt.key];
            const amount = raw === "" ? null : Number(raw);
            const row = existingPrices.find((p) => p.priceType === pt.key);
            if (row) await priceRepo.update(row.id, { amount });
            else if (amount != null)
              await priceRepo.create({
                variantId,
                priceType: pt.key,
                amount,
                currency: "INR",
                effectiveFrom: new Date().toISOString(),
              });
          }
        }

        toast.success("Product updated");
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["product", id] });
        qc.invalidateQueries({ queryKey: ["variants", id] });
        navigate(`/products/${id}`);
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    }
  };

  if (isEdit && !loaded) {
    return (
      <>
        <PageHeader title="Edit Product" />
        <div className="p-6 text-sm text-muted">Loading product…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Product" : "New Product"}
        description="Enter product identity, then add variants with attributes and prices"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/products")}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              <Save className="h-4 w-4" />
              {isEdit ? "Save changes" : "Create product"}
            </Button>
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.products} />

      <div className="p-3 md:p-6 space-y-4 max-w-6xl">
        {/* ───── Basic Information ───── */}
        <Card>
          <CardHeader title="Basic Information" />
          <CardBody>
            <FormGrid cols={2}>
              <Field label="Product name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sharon Gold Plywood"
                />
              </Field>

              <Field
                label="Product SKU"
                required
                hint={
                  skuLocked && sku
                    ? "Manual entry — clear the field to re-enable Auto"
                    : !isEdit
                    ? "Type your own, or click Auto to generate"
                    : undefined
                }
              >
                <div className="flex gap-2">
                  <Input
                    value={sku}
                    onChange={(e) => handleManualSku(e.target.value)}
                    placeholder="e.g. PLYW-SGP"
                  />
                  {!isEdit && (
                    <>
                      <Button
                        variant="subtle"
                        size="md"
                        onClick={handleAutoSku}
                        title="Generate SKU from name and category"
                      >
                        <Wand2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Auto</span>
                      </Button>
                      {sku && (
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={handleClearSku}
                          title="Clear and re-enable Auto"
                        >
                          Clear
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Field>

              <Field label="Category" required>
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Brand">
                <Select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this product"
                />
              </Field>

              <Field label="Status">
                <div className="flex items-center h-9">
                  <Switch
                    checked={status === "active"}
                    onChange={(v) => setStatus(v ? "active" : "inactive")}
                    label={status === "active" ? "Active" : "Inactive"}
                  />
                </div>
              </Field>
            </FormGrid>
          </CardBody>
        </Card>

        {/* Prompt until category chosen */}
        {!categoryId && (
          <Card>
            <CardBody>
              <div className="text-sm text-muted">
                Pick a category to load its attributes and build variants.
              </div>
            </CardBody>
          </Card>
        )}

        {/* ───── Variants ───── */}
        {categoryId && (
          <Card>
            <CardHeader
              title={`Variants (${variants.length})`}
              subtitle={
                activeAttrs.length
                  ? `Attributes: ${activeAttrs.map((a) => a.name).join(", ")}`
                  : "This category has no attributes configured yet."
              }
              actions={
                <Button size="sm" variant="outline" onClick={addVariant}>
                  <Plus className="h-4 w-4" /> Add variant
                </Button>
              }
            />
            <CardBody className="space-y-4">
              {variants.map((v, idx) => (
                <VariantEditor
                  key={v.tempId}
                  index={idx}
                  variant={v}
                  attributes={activeAttrs}
                  productSku={sku}
                  onChange={(patch) => updateVariant(v.tempId, patch)}
                  onAttrChange={(attrId, val) =>
                    setVariantAttr(v.tempId, attrId, val)
                  }
                  onPriceChange={(pt, val) =>
                    setVariantPrice(v.tempId, pt, val)
                  }
                  onSuggestSku={() => suggestVariantSku(v.tempId)}
                  onRemove={
                    variants.length > 1
                      ? () => removeVariant(v.tempId)
                      : undefined
                  }
                />
              ))}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

/* ───────── Variant editor ───────── */

function VariantEditor({
  index,
  variant,
  attributes,
  productSku,
  onChange,
  onAttrChange,
  onPriceChange,
  onSuggestSku,
  onRemove,
}) {
  return (
    <div className="border border-line rounded-lg p-3 md:p-4 bg-timber-50/40">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-timber-500 text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </div>
          <div className="text-sm font-semibold text-timber-700">
            Variant {index + 1}
          </div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-danger hover:bg-red-50 rounded p-1"
            title="Remove variant"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <FormGrid cols={2}>
        <Field label="Variant SKU" required hint={productSku ? `Product SKU: ${productSku}` : undefined}>
          <div className="flex gap-2">
            <Input
              value={variant.sku}
              onChange={(e) =>
                onChange({ sku: e.target.value.toUpperCase() })
              }
              placeholder="e.g. PLYW-SGP-01"
            />
            <Button
              variant="subtle"
              size="md"
              onClick={onSuggestSku}
              title="Suggest variant SKU"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </Field>
        <Field label="Opening stock">
          <Input
            type="number"
            value={variant.openingStock}
            onChange={(e) => onChange({ openingStock: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label="Reorder level">
          <Input
            type="number"
            value={variant.reorderLevel}
            onChange={(e) => onChange({ reorderLevel: e.target.value })}
            placeholder="0"
          />
        </Field>
      </FormGrid>

      {attributes.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold text-timber-700 uppercase tracking-wide mb-2">
            Attributes
          </div>
          <FormGrid cols={3}>
            {attributes.map((a) => (
              <AttributeField
                key={a.id}
                attribute={a}
                value={variant.attributeValues[a.id] ?? ""}
                onChange={(val) => onAttrChange(a.id, val)}
              />
            ))}
          </FormGrid>
        </div>
      )}

      <div className="mt-4">
        <div className="text-[11px] font-bold text-timber-700 uppercase tracking-wide mb-2">
          Prices
        </div>
        <FormGrid cols={3}>
          {PRICE_TYPES.map((pt) => (
            <Field key={pt.key} label={pt.label}>
              <MoneyInput
                value={variant.prices[pt.key]}
                onChange={(e) => onPriceChange(pt.key, e.target.value)}
                placeholder="0.00"
              />
            </Field>
          ))}
        </FormGrid>
      </div>
    </div>
  );
}

/* ───────── Dynamic attribute input ───────── */

function AttributeField({ attribute, value, onChange }) {
  const { data: values = [] } = useAttributeValues(
    attribute.dataType === "select" ? attribute.id : null,
  );

  if (attribute.dataType === "select") {
    return (
      <Field label={attribute.name} required={attribute.isRequired}>
        <Select value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (attribute.dataType === "boolean") {
    const isOn = value === true || value === "true";
    return (
      <Field label={attribute.name} required={attribute.isRequired}>
        <div className="flex items-center h-9">
          <Switch
            checked={isOn}
            onChange={onChange}
            label={isOn ? "Yes" : "No"}
          />
        </div>
      </Field>
    );
  }

  if (attribute.dataType === "number") {
    return (
      <Field label={attribute.name} required={attribute.isRequired}>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
      </Field>
    );
  }

  return (
    <Field label={attribute.name} required={attribute.isRequired}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={attribute.name}
      />
    </Field>
  );
}
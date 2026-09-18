import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Boxes,
  Layers3,
  Package,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";

import {
  useAttributes,
  useCategories,
} from "@/hooks/useMasters";

import { useProducts } from "@/hooks/useProducts";
import { useParties } from "@/hooks/useParties";

import { MODULE_TABS } from "@/app/moduleNav";

const RESOURCES = [
  {
    key: "product-types",
    title: "Product Types",
    description:
      "Define product types and the attributes that apply to each.",
    path: "/master/attributes",
    icon: Layers3,
    tone: "indigo",
  },
  {
    key: "attributes",
    title: "Attributes",
    description:
      "Define reusable fields and allowed values for products.",
    path: "/master/attributes",
    icon: Boxes,
    tone: "violet",
  },
  {
    key: "products",
    title: "Products",
    description:
      "Create products by name and Product Type. Attributes flow in automatically.",
    path: "/master/products",
    icon: Package,
    tone: "emerald",
  },
  {
    key: "customers",
    title: "Customers",
    description:
      "Manage customers used across your sales documents.",
    path: "/master/customers",
    icon: Users,
    tone: "amber",
  },
];

const TONES = {
  indigo:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
  amber:
    "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
};

export function MasterOverviewPage() {
  const navigate = useNavigate();

  const { data: categories = [] } = useCategories();
  const { data: attributes = [] } = useAttributes();
  const { data: products = [] } = useProducts();
  const { data: parties = [] } = useParties();

  const customers = useMemo(
    () =>
      parties.filter(
        (party) =>
          party.type === "customer" ||
          party.type === "both",
      ),
    [parties],
  );

  const stats = {
    "product-types": categories.length,
    attributes: attributes.length,
    products: products.length,
    customers: customers.length,
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Master"
        description="Manage the building blocks of your products and sales workflow."
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <div className="mb-5">
          <div className="text-xs font-semibold text-muted">
            Business setup
          </div>

          <h2 className="mt-1 text-lg md:text-xl font-bold tracking-tight text-ink">
            Everything starts here
          </h2>

          <p className="mt-1 text-sm text-muted max-w-2xl">
            Configure your product structure once, then reuse it
            throughout quotations, invoices and reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RESOURCES.map((resource) => {
            const Icon = resource.icon;

            return (
              <Card
                key={resource.key}
                interactive
                className="group"
              >
                <button
                  type="button"
                  onClick={() => navigate(resource.path)}
                  className="w-full text-left"
                >
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div
                        className={`
                          h-11
                          w-11
                          rounded-xl
                          flex
                          items-center
                          justify-center
                          shrink-0
                          ${TONES[resource.tone]}
                        `}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-ink">
                            {resource.title}
                          </h3>

                          <ArrowUpRight
                            className="
                              h-4
                              w-4
                              text-subtle
                              transition-transform
                              group-hover:-translate-y-0.5
                              group-hover:translate-x-0.5
                              group-hover:text-primary-500
                            "
                          />
                        </div>

                        <p className="text-xs text-muted mt-1.5 leading-relaxed">
                          {resource.description}
                        </p>

                        <div className="mt-5 flex items-end justify-between">
                          <div>
                            <div className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                              {stats[resource.key] ?? 0}
                            </div>

                            <div className="text-[10px] text-muted mt-0.5">
                              {resource.key === "product-types"
                                ? "configured types"
                                : resource.key === "attributes"
                                  ? "defined attributes"
                                  : resource.key === "products"
                                    ? "products"
                                    : "customers"}
                            </div>
                          </div>

                          <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                            Open
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </button>
              </Card>
            );
          })}
        </div>

        <Card className="mt-4">
          <CardBody>
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">
                  How your product setup works
                </div>

                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Pick a Product Type in Attribute Master, then list
                  which Attributes apply and their allowed values.
                  Products just pick a name and a type — everything
                  else flows through automatically.
                </p>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                <FlowItem number="01" label="Product Type" />
                <FlowLine />
                <FlowItem number="02" label="Attributes" />
                <FlowLine />
                <FlowItem number="03" label="Allowed Values" />
                <FlowLine />
                <FlowItem number="04" label="Product" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function FlowItem({ number, label }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="h-7 w-7 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold">
        {number}
      </div>

      <span className="text-xs font-semibold text-ink whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

function FlowLine() {
  return <div className="w-7 h-px bg-line shrink-0" />;
}
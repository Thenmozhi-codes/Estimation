import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { userRepo } from "@/lib/api/repos";
import { fmtDate } from "@/lib/utils/date";
import { MODULE_TABS } from "@/app/moduleNav";

export function UsersPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => userRepo.list(),
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Team members and their roles"
      />
      <ModuleTabs tabs={MODULE_TABS.settings} />

      <div className="p-3 md:p-6 max-w-4xl">
        <Card>
          <DataTable
            columns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email", hideOnMobile: true },
              {
                key: "role",
                header: "Role",
                render: (r) => (
                  <span className="capitalize">{r.role}</span>
                ),
              },
              {
                key: "isActive",
                header: "Status",
                align: "right",
                render: (r) => (
                  <StatusBadge status={r.isActive ? "active" : "inactive"} />
                ),
              },
              {
                key: "createdAt",
                header: "Added",
                align: "right",
                hideOnMobile: true,
                render: (r) => fmtDate(r.createdAt),
              },
            ]}
            rows={users}
            loading={isLoading}
            emptyTitle="No users"
          />
        </Card>
      </div>
    </>
  );
}
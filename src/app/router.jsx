import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "./RequireAuth";

// Auth
import { LoginPage } from "@/modules/auth/LoginPage";

// Products
import { ProductListPage }   from "@/modules/products/ProductListPage";
import { ProductFormPage }   from "@/modules/products/ProductFormPage";
import { ProductDetailPage } from "@/modules/products/ProductDetailPage";
import { BrandPage }         from "@/modules/products/BrandPage";
import { UnitPage }          from "@/modules/products/UnitPage";
import { AttributePage }     from "@/modules/products/AttributePage";
import { CategoryPage }      from "@/modules/products/CategoryPage";

// Parties
import { PartiesPage }     from "@/modules/parties/PartiesPage";
import { PartyDetailPage } from "@/modules/parties/PartyDetailPage";

// Sales
import { QuotationListPage }   from "@/modules/sales/QuotationListPage";
import { QuotationFormPage }   from "@/modules/sales/QuotationFormPage";
import { QuotationDetailPage } from "@/modules/sales/QuotationDetailPage";
import { InvoiceListPage }     from "@/modules/sales/InvoiceListPage";
import { InvoiceFormPage }     from "@/modules/sales/InvoiceFormPage";
import { InvoiceDetailPage }   from "@/modules/sales/InvoiceDetailPage";
import { PaymentListPage }     from "@/modules/sales/PaymentListPage";

// Purchases + Inventory
import { PurchaseListPage }   from "@/modules/purchases/PurchaseListPage";
import { PurchaseFormPage }   from "@/modules/purchases/PurchaseFormPage";
import { PurchaseDetailPage } from "@/modules/purchases/PurchaseDetailPage";
import { InventoryPage }      from "@/modules/inventory/InventoryPage";

// Dashboard + Reports
import { DashboardPage }         from "@/modules/dashboard/DashboardPage";
import { SalesReportPage }       from "@/modules/reports/SalesReportPage";
import { PurchaseReportPage }    from "@/modules/reports/PurchaseReportPage";
import { InventoryReportPage }   from "@/modules/reports/InventoryReportPage";
import { OutstandingReportPage } from "@/modules/reports/OutstandingReportPage";

// Settings
import { CompanyPage }    from "@/modules/settings/CompanyPage";
import { DocumentsPage }  from "@/modules/settings/DocumentsPage";
import { TaxPage }        from "@/modules/settings/TaxPage";
import { UsersPage }      from "@/modules/settings/UsersPage";
import { AppearancePage } from "@/modules/settings/AppearancePage";

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected app */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* ─── Sales ─── */}
        <Route path="/sales" element={<Navigate to="/sales/quotations" replace />} />
        <Route path="/sales/quotations" element={<QuotationListPage />} />
        <Route path="/sales/quotations/new" element={<QuotationFormPage />} />
        <Route path="/sales/quotations/:id" element={<QuotationDetailPage />} />
        <Route path="/sales/invoices" element={<InvoiceListPage />} />
        <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
        <Route path="/sales/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/sales/payments" element={<PaymentListPage />} />

        {/* ─── Products ─── */}
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:id/edit" element={<ProductFormPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/products/categories" element={<CategoryPage />} />
        <Route path="/products/attributes" element={<AttributePage />} />
        <Route path="/products/brands"     element={<BrandPage />} />
        <Route path="/products/units"      element={<UnitPage />} />

        {/* ─── Parties ─── */}
        <Route path="/parties" element={<Navigate to="/parties/customers" replace />} />
        <Route path="/parties/customers"     element={<PartiesPage type="customer" />} />
        <Route path="/parties/customers/:id" element={<PartyDetailPage type="customer" />} />
        <Route path="/parties/suppliers"     element={<PartiesPage type="supplier" />} />
        <Route path="/parties/suppliers/:id" element={<PartyDetailPage type="supplier" />} />

        {/* ─── Purchases ─── */}
        <Route path="/purchases" element={<PurchaseListPage />} />
        <Route path="/purchases/new" element={<PurchaseFormPage />} />
        <Route path="/purchases/:id" element={<PurchaseDetailPage />} />

        {/* ─── Inventory ─── */}
        <Route path="/inventory" element={<InventoryPage />} />

        {/* ─── Reports ─── */}
        <Route path="/reports" element={<Navigate to="/reports/sales" replace />} />
        <Route path="/reports/sales"       element={<SalesReportPage />} />
        <Route path="/reports/purchase"    element={<PurchaseReportPage />} />
        <Route path="/reports/inventory"   element={<InventoryReportPage />} />
        <Route path="/reports/outstanding" element={<OutstandingReportPage />} />

        {/* ─── Settings ─── */}
        <Route path="/settings" element={<Navigate to="/settings/company" replace />} />
        <Route path="/settings/company"    element={<CompanyPage />} />
        <Route path="/settings/documents"  element={<DocumentsPage />} />
        <Route path="/settings/tax"        element={<TaxPage />} />
        <Route path="/settings/users"      element={<UsersPage />} />
        <Route path="/settings/appearance" element={<AppearancePage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
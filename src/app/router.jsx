import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "./RequireAuth";
import { LoginPage } from "@/modules/auth/LoginPage";

/* ── Dashboard ── */
import { DashboardPage } from "@/modules/dashboard/DashboardPage";

/* ── Master ── */
import { ProductTypesPage }  from "@/modules/master/ProductTypesPage";
import { AttributesPage }    from "@/modules/master/AttributesPage";
import { ProductsPage }      from "@/modules/master/ProductsPage";
import { ProductFormPage }   from "@/modules/master/ProductFormPage";
import { ProductDetailPage } from "@/modules/master/ProductDetailPage";
import { CustomersPage }     from "@/modules/master/CustomersPage";
import { CustomerDetailPage } from "@/modules/master/CustomerDetailPage";

/* ── Bills ── */
import { QuotationListPage }   from "@/modules/bills/QuotationListPage";
import { QuotationFormPage }   from "@/modules/bills/QuotationFormPage";
import { QuotationDetailPage } from "@/modules/bills/QuotationDetailPage";
import { InvoiceListPage }     from "@/modules/bills/InvoiceListPage";
import { InvoiceFormPage }     from "@/modules/bills/InvoiceFormPage";
import { InvoiceDetailPage }   from "@/modules/bills/InvoiceDetailPage";

/* ── Reports ── */
import { SalesReportPage }       from "@/modules/reports/SalesReportPage";
import { ProductsReportPage }    from "@/modules/reports/ProductsReportPage";
import { CustomersReportPage }   from "@/modules/reports/CustomersReportPage";
import { OutstandingReportPage } from "@/modules/reports/OutstandingReportPage";

/* ── Settings ── */
import { CompanyPage }    from "@/modules/settings/CompanyPage";
import { TaxPage }        from "@/modules/settings/TaxPage";
import { UsersPage }      from "@/modules/settings/UsersPage";
import { AppearancePage } from "@/modules/settings/AppearancePage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* ── Master ── */}
        <Route path="/master" element={<Navigate to="/master/product-types" replace />} />
        <Route path="/master/product-types" element={<ProductTypesPage />} />
        <Route path="/master/attributes"    element={<AttributesPage />} />
        <Route path="/master/products"      element={<ProductsPage />} />
        <Route path="/master/products/new"  element={<ProductFormPage />} />
        <Route path="/master/products/:id/edit" element={<ProductFormPage />} />
        <Route path="/master/products/:id"  element={<ProductDetailPage />} />
        <Route path="/master/customers"     element={<CustomersPage />} />
        <Route path="/master/customers/:id" element={<CustomerDetailPage />} />

        {/* ── Bills ── */}
        <Route path="/bills" element={<Navigate to="/bills/quotations" replace />} />
        <Route path="/bills/quotations"     element={<QuotationListPage />} />
        <Route path="/bills/quotations/new" element={<QuotationFormPage />} />
        <Route path="/bills/quotations/:id" element={<QuotationDetailPage />} />
        <Route path="/bills/invoices"       element={<InvoiceListPage />} />
        <Route path="/bills/invoices/new"   element={<InvoiceFormPage />} />
        <Route path="/bills/invoices/:id"   element={<InvoiceDetailPage />} />

        {/* ── Reports ── */}
        <Route path="/reports" element={<Navigate to="/reports/sales" replace />} />
        <Route path="/reports/sales"       element={<SalesReportPage />} />
        <Route path="/reports/products"    element={<ProductsReportPage />} />
        <Route path="/reports/customers"   element={<CustomersReportPage />} />
        <Route path="/reports/outstanding" element={<OutstandingReportPage />} />

        {/* ── Settings ── */}
        <Route path="/settings" element={<Navigate to="/settings/company" replace />} />
        <Route path="/settings/company"    element={<CompanyPage />} />
        <Route path="/settings/tax"        element={<TaxPage />} />
        <Route path="/settings/users"      element={<UsersPage />} />
        <Route path="/settings/appearance" element={<AppearancePage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const requestId = require("./middleware/request-id.middleware");
const errorHandler = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const brandRoutes = require("./routes/brand.routes");
const unitRoutes = require("./routes/unit.routes");
const attributeRoutes = require("./routes/attribute.routes");
const attributeValueRoutes = require("./routes/attribute-value.routes");
const categoryAttributeRoutes = require("./routes/category-attribute.routes");
const productRoutes = require("./routes/product.routes");
const productVariantRoutes = require("./routes/product-variant.routes");
const variantAttributeRoutes = require("./routes/variant-attribute.routes");
const priceTierRoutes = require("./routes/price-tier.routes");
const variantPriceRoutes = require("./routes/variant-price.routes");
const partyRoutes = require("./routes/party.routes");
const stockMovementRoutes = require("./routes/stock-movement.routes");
const purchaseRoutes = require("./routes/purchase.routes");
const quotationRoutes = require("./routes/quotation.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const paymentRoutes = require("./routes/payment.routes");
const reportRoutes = require("./routes/report.routes");
const userRoutes = require("./routes/user.routes");
const auditRoutes = require("./routes/audit.routes");
const numberSequenceRoutes = require("./routes/number-sequence.routes");
const settingsRoutes = require("./routes/settings.routes");

const app = express();

// =====================================================
// SECURITY HEADERS
// =====================================================

app.use(helmet());

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://estimation-ld4s.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin, including Postman
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin not allowed by CORS");
      error.statusCode = 403;

      return callback(error);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: false,
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json({ limit: "1mb" }));

// =====================================================
// REQUEST ID
// =====================================================

app.use(requestId);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Timber ERP backend is running",
    requestId: req.requestId || null,
  });
});

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/brands", brandRoutes);
app.use("/api/v1/units", unitRoutes);

app.use("/api/v1/attributes", attributeRoutes);
app.use("/api/v1/attribute-values", attributeValueRoutes);
app.use("/api/v1/category-attributes", categoryAttributeRoutes);

app.use("/api/v1/products", productRoutes);
app.use("/api/v1/product-variants", productVariantRoutes);
app.use("/api/v1/variant-attributes", variantAttributeRoutes);

app.use("/api/v1/price-tiers", priceTierRoutes);
app.use("/api/v1/variant-prices", variantPriceRoutes);

app.use("/api/v1/parties", partyRoutes);
app.use("/api/v1/stock-movements", stockMovementRoutes);

app.use("/api/v1/purchases", purchaseRoutes);
app.use("/api/v1/quotations", quotationRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use("/api/v1/payments", paymentRoutes);

app.use("/api/v1/reports", reportRoutes);

app.use("/api/v1/number-sequences", numberSequenceRoutes);
app.use("/api/v1/settings", settingsRoutes);

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/audit-logs", auditRoutes);

// =====================================================
// HANDLE UNKNOWN ROUTES
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    requestId: req.requestId || null,
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// Must remain after all routes
// =====================================================

app.use(errorHandler);

module.exports = app;
import { mockStore } from "@/lib/store/mockStore";
import { newId } from "@/lib/utils/id";
import { toCode } from "@/lib/utils/code";
import { nowIso } from "@/lib/utils/date";

export function seedIfEmpty() {
  if (!mockStore.get().companies.length) mockStore.set(build());
  ensureDefaultProductTypes();
  ensureDemoBrands();
}

/*
 * Default Product Types added after the first release.
 * Safe to run on every start: it only inserts what is missing, so existing
 * browser data (localStorage) gets the new types without a reset.
 */
const DEFAULT_PRODUCT_TYPES = [
  "Timber",
  "Beading",
  "Laminated Board",
  "HMR Board",
  "Door",
];

export function ensureDefaultProductTypes() {
  const norm = (v) => String(v || "").trim().toLowerCase();
  const companyId = mockStore.get().companies?.[0]?.id || null;

  for (const name of DEFAULT_PRODUCT_TYPES) {
    const exists = mockStore.all("categories").some((c) => norm(c.name) === norm(name));
    if (exists) continue;
    mockStore.insert("categories", {
      id: newId(), companyId, name, code: toCode(name),
      description: "", isActive: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
  }

  /*
   * An earlier version mapped the shared Thickness / Width / Length / Unit
   * attributes to these types, which made Timber share Plywood's mm values.
   * Remove those shared mappings; Master -> Specifications creates a
   * dedicated Thickness list per type (inches for Timber / Beading).
   */
  const newIds = new Set(
    mockStore.all("categories")
      .filter((c) => DEFAULT_PRODUCT_TYPES.some((n) => norm(n) === norm(c.name)))
      .map((c) => c.id),
  );
  const mappings = mockStore.all("categoryAttributes");
  const sharedElsewhere = (attributeId) =>
    mappings.some((m) => m.attributeId === attributeId && !newIds.has(m.categoryId));

  mappings
    .filter((m) => newIds.has(m.categoryId) && sharedElsewhere(m.attributeId))
    .forEach((m) => mockStore.remove("categoryAttributes", m.id));
}

/*
 * DEMO BRANDS — a few ready-made brands for every Product Type, each with
 * its specifications, prices and unit, so the Brand master, the Brand form
 * and the quotation picker can be shown with real-looking data.
 *
 * Safe to run on every start: a brand is added only once (tracked by
 * `demoKey`), so a demo brand you rename or delete never comes back, and
 * nothing you created yourself is touched. Demo brands carry `isDemo: true`.
 *
 * Specification lists match the Brand form (same values per Product Type).
 */
const DEMO_SPECS = {
  Plywood: ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
  Laminate: ["0.6mm", "0.8mm", "1mm"],
  "Edge Band": ["0.5mm"],
  WPC: ["3x2 inch", "4x2.5 inch"],
  Fevicol: ["1/2kg", "1kg", "2kg", "5kg", "10kg", "20kg", "50kg"],
  Timber: ["1 inch", "1.5 inch", "2 inch", "3 inch", "4 inch"],
  Beading: ["1/2 inch", "3/4 inch", "1 inch"],
  "Laminated Board": ["19mm", "18mm", "16mm", "12mm", "9mm", "6mm"],
  "HMR Board": ["19mm", "18mm", "16mm", "12mm"],
  Door: ["40mm", "35mm", "32mm", "30mm", "25mm", "18mm"],
};

/* category names a Product Type may be stored under, best match first */
const DEMO_CATEGORY_NAMES = { Fevicol: ["Adhesive", "Fevicol"] };

/* [brand name, unit, prices in the same order as the type's specifications] */
const DEMO_BRANDS = {
  Plywood: [
    ["Royal Teak MR Plywood", "Sq.ft", [84, 78, 70, 56, 46, 36]],
    ["Prime Gold BWP Plywood", "Sq.ft", [118, 108, 96, 78, 62, 48]],
  ],
  Laminate: [
    ["Classic Oak Laminate", "Sq.ft", [22, 26, 32]],
    ["Stella Gloss Laminate", "Sq.ft", [25, 30, 38]],
  ],
  "Edge Band": [
    ["Smooth Edge Band PVC", "R.ft", [5]],
    ["Premium Edge Band ABS", "R.ft", [6.5]],
  ],
  WPC: [
    ["Durable WPC Door Frame", "C.ft", [420, 560]],
    ["Eco WPC Frame", "C.ft", [390, 520]],
  ],
  Fevicol: [
    ["Fevicol Marine", "Nos", [95, 180, 345, 820, 1580, 3050, 7400]],
    ["Fevicol SpeedX", "Nos", [90, 170, 330, 790, 1520, 2950, 7150]],
  ],
  Timber: [
    ["Burma Teak Wood", "C.ft", [5200, 5400, 5600, 5800, 6000]],
    ["Mahogany Wood", "C.ft", [3200, 3300, 3400, 3500, 3600]],
  ],
  Beading: [
    ["Teak Beading", "R.ft", [18, 24, 32]],
    ["Mahogany Beading", "R.ft", [10, 14, 19]],
  ],
  "Laminated Board": [
    ["Prelam MDF Board", "Sq.ft", [72, 66, 58, 46, 38, 30]],
    ["Royal Laminated Board", "Sq.ft", [80, 74, 65, 52, 43, 34]],
  ],
  "HMR Board": [
    ["Hydro HMR Board", "Sq.ft", [78, 72, 64, 52]],
    ["Aqua Shield HMR Board", "Sq.ft", [86, 80, 72, 58]],
  ],
  Door: [
    ["Premium Panel Door", "Sq.ft", [180, 165, 150, 140, 120, 95]],
    ["Standard Flush Door", "Sq.ft", [140, 128, 115, 105, 92, 75]],
  ],
};

export function ensureDemoBrands() {
  const norm = (v) => String(v || "").trim().toLowerCase();
  const db = mockStore.get();
  const companyId = db.companies?.[0]?.id || null;

  const categories = mockStore.all("categories");
  /* a COPY (the store returns its live array); includes deleted ones */
  const existing = [...mockStore.all("brands")];

  const findCategory = (type) =>
    (DEMO_CATEGORY_NAMES[type] || [type])
      .map((name) => categories.find((c) => norm(c.name) === norm(name)))
      .find(Boolean) || null;

  for (const [type, brands] of Object.entries(DEMO_BRANDS)) {
    const category = findCategory(type);
    if (!category) continue; // Product Type not created yet

    const specs = DEMO_SPECS[type];

    brands.forEach(([name, unit, prices]) => {
      const demoKey = `${toCode(type)}-${toCode(name)}`;

      const alreadyThere = existing.some(
        (b) =>
          b.demoKey === demoKey ||
          (norm(b.name) === norm(name) && b.categoryId === category.id),
      );
      if (alreadyThere) return;

      const row = {
        id: newId(),
        companyId,
        name,
        code: toCode(name),
        categoryId: category.id,
        isActive: true,
        isDemo: true,
        demoKey,
        specifications: specs.map((specification, i) => ({
          specification,
          price: prices[i] ?? null,
        })),
        materialDetails: { category: type, brand: name, unit },
        calculation: { wastage: null, markup: null, discount: null },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      mockStore.insert("brands", row);
      existing.push(row);
    });
  }
}

function build() {
  const db = {
    companies: [], users: [], roles: [],
    units: [], brands: [], taxes: [],
    attributes: [], attributeValues: [],
    categories: [], categoryAttributes: [],
    products: [], variants: [], variantAttributes: [],
    prices: [], stock: [], stockMovements: [],
    parties: [],
    quotations: [], quotationItems: [],
    invoices: [], invoiceItems: [],
    purchases: [], purchaseItems: [],
    payments: [],
    counters: { QTN: 0, INV: 0, PUR: 0, PAY: 0 },
  };

  // ── Company ────────────────────────────────────────
  const company = {
    id: newId(),
    name: "Sri Ganesh Timber Trading Co.",
    address: "# 474, M.T.H. Road, Ambattur, Chennai - 600 053",
    gstin: "33AABFG8586A1ZL",
    phone: "+91 98765 43210",
    email: "ganesh_timber@yahoo.co.in",
    invoicePrefix: "INV",
    quotationPrefix: "EST",
    purchasePrefix: "PUR",
    paymentPrefix: "PAY",
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  db.companies.push(company);

  db.users.push({
    id: newId(), companyId: company.id, name: "Admin",
    email: "admin@sgt.local", role: "admin", isActive: true,
    createdAt: nowIso(), updatedAt: nowIso(),
  });

  // ── Units ──────────────────────────────────────────
  [["Sheet","SHT"],["Square Foot","SQFT"],["Piece","PCS"],
   ["Meter","MTR"],["Kg","KG"],["Litre","LTR"],["Box","BOX"]].forEach(([name, code]) => {
    db.units.push({ id: newId(), companyId: company.id, name, code,
      isActive: true, createdAt: nowIso(), updatedAt: nowIso() });
  });

  // ── Brands (from your reference) ───────────────────
  [
    "Sharon Gold", "Sharon Sovereign", "Mikasa MR+", "Mikasa BWP+",
    "Mikasa Marine", "Mikasa Marine Blue", "Hardwood Ply", "Afyun Plywood",
    "Ambi Plywood", "Green HDWR", "Action Tesa HDHMR",
    "Merino Laminate", "Greenlam Laminate", "Century Laminate",
    "Formica Laminate", "Sundek Laminate", "Decolam Laminate",
    "Royal Touch Laminate", "Virgo Laminate", "Archidply Laminate",
    "Action Laminate",
    "Rehau Edge Band", "Banda Edge Band", "Virutex Edge Band",
    "Century Edge Band", "Greenlam Edge Band", "Merino Edge Band",
    "WPC Frame", "WPC Door Frame", "WPC Door",
    "Fevicol SH", "Fevicol HI-PER", "Fevicol HI-PER Star",
    "Fevicol Heatex", "Fevicol Probond",
  ].forEach((name) => {
    db.brands.push({ id: newId(), companyId: company.id, name,
      code: toCode(name), isActive: true,
      createdAt: nowIso(), updatedAt: nowIso() });
  });

  // ── Taxes ──────────────────────────────────────────
  [["GST 18%",18],["GST 12%",12],["GST 5%",5],["Exempt",0]].forEach(([name, rate]) => {
    db.taxes.push({ id: newId(), companyId: company.id, name, rate,
      isActive: true, createdAt: nowIso(), updatedAt: nowIso() });
  });

  // ── Attributes ─────────────────────────────────────
  [
    { name: "Brand",      dataType: "select", isRequired: true },
    { name: "Thickness",  dataType: "select", isRequired: true },
    { name: "Length",     dataType: "select", isRequired: false },
    { name: "Width",      dataType: "select", isRequired: false },
    { name: "Grade",      dataType: "select", isRequired: false },
    { name: "Finish",     dataType: "select", isRequired: false },
    { name: "Color",      dataType: "select", isRequired: false },
    { name: "Pack Size",  dataType: "select", isRequired: false },
    { name: "Unit",       dataType: "select", isRequired: true },
  ].forEach((a) => {
    db.attributes.push({ id: newId(), companyId: company.id,
      name: a.name, code: toCode(a.name), dataType: a.dataType,
      isRequired: a.isRequired, isActive: true,
      createdAt: nowIso(), updatedAt: nowIso() });
  });
  const attrBy = Object.fromEntries(db.attributes.map((a) => [a.name, a]));

  // ── Attribute values ───────────────────────────────
  const valueDefs = {
    Brand: db.brands.map((b) => b.name),
    Thickness: ["0.5mm","0.6mm","0.8mm","1mm","6mm","9mm","12mm","16mm","18mm","19mm"],
    Length: ["6ft","7ft","8ft","10ft","50m"],
    Width: ["3ft","4ft","5ft","6ft","22mm"],
    Grade: ["MR","BWR","BWP","Marine"],
    Finish: ["Smooth","Matte","Glossy","Textured"],
    Color: ["White","Beige","Grey","Walnut","Oak","Teak","Wenge","Ivory"],
    "Pack Size": ["250g","500g","1kg","2kg","5kg","10kg","20kg"],
    Unit: db.units.map((u) => u.name),
  };
  for (const [attrName, labels] of Object.entries(valueDefs)) {
    const attr = attrBy[attrName];
    labels.forEach((label, i) => {
      db.attributeValues.push({
        id: newId(), attributeId: attr.id, label,
        code: toCode(label), sortOrder: i, isActive: true,
        createdAt: nowIso(), updatedAt: nowIso(),
      });
    });
  }
  const valBy = (attrName, label) =>
    db.attributeValues.find((v) => v.attributeId === attrBy[attrName].id && v.label === label);

  // ── Categories + mapping ───────────────────────────
  const cats = [
    { name: "Plywood",   attrs: ["Brand","Thickness","Length","Width","Grade","Finish","Unit"] },
    { name: "Laminate",  attrs: ["Brand","Thickness","Length","Width","Finish","Color","Unit"] },
    { name: "Edge Band", attrs: ["Brand","Thickness","Width","Color","Length","Unit"] },
    { name: "WPC",       attrs: ["Brand","Thickness","Length","Width","Finish","Unit"] },
    { name: "Adhesive",  attrs: ["Brand","Pack Size","Unit"] },
  ];
  for (const c of cats) {
    const cat = { id: newId(), companyId: company.id, name: c.name,
      code: toCode(c.name), description: "", isActive: true,
      createdAt: nowIso(), updatedAt: nowIso() };
    db.categories.push(cat);
    c.attrs.forEach((name, i) => {
      db.categoryAttributes.push({
        id: newId(), categoryId: cat.id,
        attributeId: attrBy[name].id, isRequired: attrBy[name].isRequired,
        sortOrder: i,
      });
    });
  }
  const catBy = Object.fromEntries(db.categories.map((c) => [c.name, c]));

  // ── Sample products ────────────────────────────────
  const sampleProducts = [
    {
      name: "Sharon Gold Plywood", sku: "PLY-SG",
      category: "Plywood", brand: "Sharon Gold",
      variants: [
        { thickness:"6mm",  grade:"MR",  finish:"Smooth", length:"8ft", width:"4ft", unit:"Sheet", purchase:780,  selling:980,  wholesale:940,  retail:1000, min:900,  stock:25 },
        { thickness:"12mm", grade:"MR",  finish:"Smooth", length:"8ft", width:"4ft", unit:"Sheet", purchase:1350, selling:1620, wholesale:1560, retail:1680, min:1500, stock:60 },
        { thickness:"18mm", grade:"BWP", finish:"Smooth", length:"8ft", width:"4ft", unit:"Sheet", purchase:2100, selling:2450, wholesale:2380, retail:2520, min:2280, stock:40 },
      ],
    },
    {
      name: "Merino Laminate 1mm", sku: "LAM-MR",
      category: "Laminate", brand: "Merino Laminate",
      variants: [
        { thickness:"1mm", finish:"Matte",  color:"Walnut", length:"8ft", width:"4ft", unit:"Sheet", purchase:720, selling:950, wholesale:900, retail:990, min:860, stock:120 },
        { thickness:"1mm", finish:"Glossy", color:"White",  length:"8ft", width:"4ft", unit:"Sheet", purchase:750, selling:990, wholesale:940, retail:1020, min:900, stock:90 },
      ],
    },
    {
      name: "Fevicol SH", sku: "ADH-FV-SH",
      category: "Adhesive", brand: "Fevicol SH",
      variants: [
        { packSize:"1kg", unit:"Box", purchase:220, selling:280, wholesale:265, retail:295, min:260, stock:180 },
        { packSize:"5kg", unit:"Box", purchase:950, selling:1180, wholesale:1120, retail:1220, min:1080, stock:40 },
      ],
    },
  ];

  for (const p of sampleProducts) {
    const cat = catBy[p.category];
    const brand = db.brands.find((b) => b.name === p.brand);
    const productId = newId();
    db.products.push({
      id: productId, companyId: company.id,
      name: p.name, sku: p.sku,
      categoryId: cat.id, brandId: brand ? brand.id : null,
      description: "", status: "active",
      createdAt: nowIso(), updatedAt: nowIso(),
    });

    p.variants.forEach((v, idx) => {
      const variantId = newId();
      db.variants.push({
        id: variantId, productId,
        sku: `${p.sku}-${(v.thickness || v.packSize || idx + 1).replace(/[^0-9]/g, "") || idx + 1}`,
        isDefault: idx === 0, status: "active",
        createdAt: nowIso(), updatedAt: nowIso(),
      });

      const push = (attrName, label) => {
        const value = label ? valBy(attrName, label) : null;
        if (!attrBy[attrName] || !value) return;
        db.variantAttributes.push({
          id: newId(), variantId,
          attributeId: attrBy[attrName].id,
          attributeValueId: value.id, rawValue: null,
        });
      };
      const brandVal = db.attributeValues.find(
        (x) => x.attributeId === attrBy.Brand.id && x.label === p.brand,
      );
      if (brandVal) {
        db.variantAttributes.push({
          id: newId(), variantId,
          attributeId: attrBy.Brand.id,
          attributeValueId: brandVal.id, rawValue: null,
        });
      }
      push("Thickness", v.thickness);
      push("Length", v.length);
      push("Width", v.width);
      push("Grade", v.grade);
      push("Finish", v.finish);
      push("Color", v.color);
      push("Unit", v.unit);
      if (v.packSize) push("Pack Size", v.packSize);

      [["purchase",v.purchase],["selling",v.selling],
       ["wholesale",v.wholesale],["retail",v.retail],["minimum",v.min]]
        .forEach(([priceType, amount]) => {
          if (amount == null) return;
          db.prices.push({ id: newId(), variantId, priceType,
            amount, currency: "INR", effectiveFrom: nowIso() });
        });

      db.stock.push({
        id: newId(), variantId,
        quantity: v.stock || 0, reorderLevel: 10, updatedAt: nowIso(),
      });
      db.stockMovements.push({
        id: newId(), companyId: company.id, variantId,
        type: "opening", quantity: v.stock || 0,
        referenceType: "opening", referenceId: null,
        unitCost: v.purchase || 0, notes: "Opening stock",
        createdAt: nowIso(),
      });
    });
  }

  // ── Parties ────────────────────────────────────────
  [
    ["Ramesh Traders",  "customer", "9876543210", "ramesh@example.com", "33AAAPZ1234C1Z1", "Tamil Nadu", "Chennai"],
    ["Sharma Interiors","customer", "9820011111", "",                    "33BBBPZ2345D1Z2", "Tamil Nadu", "Chennai"],
    ["Kumar Wood Works","customer", "9820022222", "",                    "",                 "Tamil Nadu", "Ambattur"],
    ["Century Ply Depot","supplier","9820033333", "sales@centuryply.in","33EEEPZ5678G1Z5", "Tamil Nadu", "Chennai"],
    ["Merino Stockist", "supplier", "9820044444", "merino@example.in",  "33GGGPZ7890I1Z7", "Tamil Nadu", "Chennai"],
  ].forEach(([name, type, phone, email, gstin, state, city]) => {
    db.parties.push({
      id: newId(), companyId: company.id, type, name, phone, email,
      gstin, state, city, address: "",
      creditLimit: 0, openingBalance: 0, isActive: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
  });

  return db;
}
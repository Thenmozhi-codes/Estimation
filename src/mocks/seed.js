import { mockStore } from "@/lib/store/mockStore";
import { newId } from "@/lib/utils/id";
import { toCode } from "@/lib/utils/code";
import { nowIso } from "@/lib/utils/date";

export function seedIfEmpty() {
  if (mockStore.get().companies.length) return;
  mockStore.set(build());
}

function build() {
  const db = {
    companies: [], users: [],
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
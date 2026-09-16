import { z } from "zod";

export const unitSchema = z.object({
  name: z.string().min(1, "Name required"),
  code: z.string().min(1, "Code required"),
  isActive: z.boolean().default(true),
});

export const brandSchema = z.object({
  name: z.string().min(1, "Name required"),
  code: z.string().min(1, "Code required"),
  isActive: z.boolean().default(true),
});

export const taxSchema = z.object({
  name: z.string().min(1, "Name required"),
  rate: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

export const attributeSchema = z.object({
  name: z.string().min(1, "Name required"),
  code: z.string().min(1, "Code required"),
  dataType: z.enum(["select", "number", "text", "boolean"]),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const attributeValueSchema = z.object({
  attributeId: z.string().min(1),
  label: z.string().min(1, "Label required"),
  code: z.string().min(1, "Code required"),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name required"),
  code: z.string().min(1, "Code required"),
  description: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export const partySchema = z.object({
  type: z.enum(["customer", "supplier", "both"]),
  name: z.string().min(1, "Name required"),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  state: z.string().optional().default(""),
  city: z.string().optional().default(""),
  address: z.string().optional().default(""),
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});
import { z } from "zod";

import { ATTRIBUTE_DATA_TYPES, PARTY_TYPES } from "../constants";

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
  dataType: z.enum(Object.values(ATTRIBUTE_DATA_TYPES)),
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

export const categoryAttributeSchema = z.object({
  categoryId: z.string().min(1),
  attributeId: z.string().min(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.coerce.number().default(0),
});
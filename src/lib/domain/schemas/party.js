import { z } from "zod";
import { PARTY_TYPES } from "../constants";

export const partySchema = z.object({
  type: z.enum(Object.values(PARTY_TYPES)),
  name: z.string().min(1, "Name required"),
  phone: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  gstin: z.string().optional().default(""),
  state: z.string().optional().default(""),
  city: z.string().optional().default(""),
  address: z.string().optional().default(""),
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});
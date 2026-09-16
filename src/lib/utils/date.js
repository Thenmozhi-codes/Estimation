import { format } from "date-fns";
export const nowIso = () => new Date().toISOString();
export const fmtDate = (d) => (d ? format(new Date(d), "dd MMM yyyy") : "—");
export const fmtDateTime = (d) => (d ? format(new Date(d), "dd MMM yyyy, HH:mm") : "—");
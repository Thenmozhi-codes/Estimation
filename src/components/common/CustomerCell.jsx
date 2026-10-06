/* Customer name and phone number on ONE line (list tables).
   Long names are cut with "…" (full text on hover) so a row never grows taller. */
export function CustomerCell({ party }) {
  const name = party?.name;
  const phone = party?.phone || party?.mobile;

  if (!name) return <span className="text-muted">Walk-in customer</span>;

  return (
    <div
      className="flex min-w-0 max-w-[280px] items-baseline gap-2"
      title={phone ? `${name} • ${phone}` : name}
    >
      <span className="min-w-0 truncate font-semibold text-ink">{name}</span>

      {phone && (
        <span className="shrink-0 text-xs tabular-nums text-muted">{phone}</span>
      )}
    </div>
  );
}

export default CustomerCell;
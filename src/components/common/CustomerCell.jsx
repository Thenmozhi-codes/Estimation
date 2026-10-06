/* Customer name with the phone number underneath (list tables) */
export function CustomerCell({ party }) {
  const name = party?.name;
  const phone = party?.phone || party?.mobile;

  if (!name) return <span className="text-muted">Walk-in customer</span>;

  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-ink">{name}</div>
      {phone && <div className="text-2xs tabular-nums text-muted">{phone}</div>}
    </div>
  );
}

export default CustomerCell;

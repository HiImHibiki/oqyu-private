const LABEL: Record<string, string> = {
  paid: "lunas", pending: "menunggu", failed: "gagal",
  expired: "kedaluwarsa", refunded: "refund",
};
const COLOR: Record<string, string> = {
  paid: "var(--ok)", pending: "var(--warn)", failed: "var(--danger)",
  expired: "var(--fg-muted)", refunded: "var(--danger)",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className="chip" style={{ color: COLOR[status] ?? "var(--fg-muted)" }}>
      {LABEL[status] ?? status}
    </span>
  );
}

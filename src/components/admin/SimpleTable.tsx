export function SimpleTable<T extends Record<string, any>>({ rows, columns }: { rows: T[]; columns: { key: keyof T; label: string; render?: (v: any, r: T) => React.ReactNode }[] }) {
  return (
    <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-muted-foreground text-xs">
          <tr>{columns.map((c) => <th key={String(c.key)} className="text-left px-4 py-3 font-medium">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40 hover:bg-secondary/30">
              {columns.map((c) => <td key={String(c.key)} className="px-4 py-3">{c.render ? c.render(r[c.key], r) : String(r[c.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

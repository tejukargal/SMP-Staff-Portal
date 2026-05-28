export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-12 h-12' }[size];
  return (
    <span
      className={`inline-block rounded-full border-2 border-sky-100 border-t-sky-500 animate-spin ${cls}`}
    />
  );
}

export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3 border-b border-sky-50">
          <div className="skeleton h-4 rounded" />
        </td>
      ))}
    </tr>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

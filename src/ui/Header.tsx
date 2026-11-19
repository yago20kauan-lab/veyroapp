import { Link } from 'react-router-dom'
import { Wordmark, VeyroMark } from './brand'

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between pb-4 pt-4">
      {title ? (
        <div>
          {subtitle && <div className="label mb-1">{subtitle}</div>}
          <h1 className="font-display text-2xl font-bold">{title}</h1>
        </div>
      ) : (
        <Wordmark size={22} />
      )}
      <Link
        to="/perfil"
        aria-label="Perfil"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
      >
        <VeyroMark size={16} />
      </Link>
    </header>
  )
}

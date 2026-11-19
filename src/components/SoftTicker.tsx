import './SoftTicker.css'

const SEGMENTS = [
  { italic: 'first squeeze is ten percent lighter', mono: 'SOFT10' },
  { italic: 'quietly taken off at bag', mono: 'DROP 01' },
  { italic: 'soft pays off', mono: '10% OFF FIRST TUBE' },
  { italic: 'squeeze responsibly', mono: 'CODE SOFT10' },
]

export default function SoftTicker({ onOpenBag }: { onOpenBag: () => void }) {
  return (
    <div className="soft-ticker" role="region" aria-label="First squeeze note">
      <button
        type="button"
        className="soft-ticker__btn"
        onClick={onOpenBag}
        aria-label="Open bag with SOFT10 perk"
      >
        <div className="soft-ticker__track">
          {[0, 1].map(copy => (
            <div key={copy} className="soft-ticker__group" aria-hidden={copy === 1}>
              {SEGMENTS.map((seg, i) => (
                <span key={`${copy}-${i}`} className="soft-ticker__item">
                  <em className="soft-ticker__italic">{seg.italic}</em>
                  <span className="soft-ticker__dot" aria-hidden="true" />
                  <span className="soft-ticker__mono">{seg.mono}</span>
                  <span className="soft-ticker__dot soft-ticker__dot--muted" aria-hidden="true" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </button>
    </div>
  )
}

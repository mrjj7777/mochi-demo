import './SoftTicker.css'

const PHRASES = [
  'SOFT PAYS OFF — TEN PERCENT LIGHTER ON YOUR FIRST SQUEEZE',
  'YOUR LIPS ALREADY VOTED YES — CODE SOFT10 AT BAG',
  'ONE LESS EXCUSE — FIRST TUBE IS 10% EASIER',
  'SQUEEZE RESPONSIBLY — TAKE TEN PERCENT OFF QUIETLY',
]

export default function SoftTicker({ onOpenBag }: { onOpenBag: () => void }) {
  return (
    <div className="soft-ticker" role="region" aria-label="First squeeze offer">
      <button
        type="button"
        className="soft-ticker__btn"
        onClick={onOpenBag}
        aria-label="Open bag with SOFT10 10% perk"
      >
        <div className="soft-ticker__track">
          {[0, 1].map(copy => (
            <div key={copy} className="soft-ticker__group" aria-hidden={copy === 1}>
              {PHRASES.map((line, i) => (
                <span key={`${copy}-${i}`} className="soft-ticker__item">
                  <span>{line}</span>
                  <span className="soft-ticker__sep" aria-hidden="true">
                    /
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </button>
    </div>
  )
}

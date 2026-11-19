import { flavours, type Flavour } from '../brand'
import './BagPage.css'

export default function BagPage({
  bagItems,
  soft10,
  onToggleSoft10,
  onUpdateQty,
  onAddFlavour,
  onClearBag,
  onNavigate,
}: {
  bagItems: Record<string, number>
  soft10: boolean
  onToggleSoft10: () => void
  onUpdateQty: (key: string, delta: number) => void
  onAddFlavour: (item: Flavour) => void
  onClearBag: () => void
  onNavigate: (route: 'home' | 'flavours' | 'wallpapers' | 'bag') => void
}) {
  const entries = flavours
    .map(item => ({ item, qty: bagItems[item.key] || 0 }))
    .filter(entry => entry.qty > 0)

  const totalCount = entries.reduce((sum, e) => sum + e.qty, 0)
  const visualTubes = entries.flatMap(e => Array.from({ length: Math.min(e.qty, 3) }, (_, idx) => ({ ...e.item, uid: `${e.item.key}-${idx}` })))

  return (
    <section className="bag-page" data-aura="#F6D3D6,#F4A27E">
      <div className="bag-top">
        <button type="button" className="bag-back" onClick={() => onNavigate('home')}>
          ← BACK TO MOCHI
        </button>
        <span className="bag-eyebrow">YOUR POCKET — {String(totalCount).padStart(2, '0')} TUBES</span>
      </div>

      <div className="bag-grid">
        {/* Left: Visual Pocket Tray showing the exact MOCHI tubes in your bag */}
        <div className="bag-tray-col">
          <h1 className="bag-heading">
            your <em>bag.</em>
          </h1>

          {totalCount === 0 ? (
            <div className="bag-empty">
              <p className="bag-empty__line">
                your pocket is still <em>empty.</em>
              </p>
              <p className="bag-empty__sub">tap any shade below to drop a tube in.</p>
            </div>
          ) : (
            <div className="bag-tray" aria-label="Tubes currently in your bag">
              {visualTubes.map(tube => (
                <div key={tube.uid} className="bag-tray__tube">
                  <img
                    src={`/media/cutouts/mochi-${tube.asset}.webp`}
                    alt={`${tube.name} lip jelly`}
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="bag-quick">
            <span className="bag-quick__label">DROP A SHADE IN</span>
            <div className="bag-quick__row">
              {flavours.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className="bag-quick__btn"
                  style={{ '--swatch': item.jelly } as React.CSSProperties}
                  onClick={() => onAddFlavour(item)}
                >
                  + {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Minimalist Editorial Bag Ledger + SOFT10 Perk */}
        <div className="bag-ledger-col">
          <div className="bag-perk">
            <div className="bag-perk__copy">
              <span className="bag-perk__tag">FIRST SQUEEZE PERK — CODE SOFT10</span>
              <p className="bag-perk__line">
                soft pays off — ten percent quietly taken off your first squeeze.
              </p>
            </div>
            <button
              type="button"
              className={`bag-perk__toggle ${soft10 ? 'is-on' : ''}`}
              onClick={onToggleSoft10}
              aria-pressed={soft10}
            >
              {soft10 ? '[ SOFT10 APPLIED ✓ ]' : '[ APPLY SOFT10 ]'}
            </button>
          </div>

          {entries.length > 0 && (
            <div className="bag-rows">
              {entries.map(({ item, qty }) => (
                <div key={item.key} className="bag-row">
                  <div className="bag-row__info">
                    <span className="bag-row__name">{item.name}</span>
                    <span className="bag-row__mood">{item.mood} · 9 ML</span>
                  </div>
                  <div className="bag-row__controls">
                    <button
                      type="button"
                      className="bag-qty-btn"
                      onClick={() => onUpdateQty(item.key, -1)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      −
                    </button>
                    <span className="bag-qty-val">{String(qty).padStart(2, '0')}</span>
                    <button
                      type="button"
                      className="bag-qty-btn"
                      onClick={() => onUpdateQty(item.key, 1)}
                      aria-label={`Add one ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bag-summary">
            <div className="bag-summary__line">
              <span>TOTAL TUBES</span>
              <span>{String(totalCount).padStart(2, '0')}</span>
            </div>
            <div className="bag-summary__line">
              <span>PERK</span>
              <span>{soft10 ? 'SOFT10 — 10% LIGHTER' : 'NONE APPLIED'}</span>
            </div>
            <p className="bag-demo-note">
              Concept brand by J&amp;J Intelligence — studio demo only, no checkout, just soft objects worth holding.
            </p>
            <div className="bag-summary__actions">
              <button type="button" className="bag-primary-btn" onClick={() => onNavigate('flavours')}>
                EXPLORE ALL SIX FLAVOURS →
              </button>
              {totalCount > 0 && (
                <button type="button" className="bag-clear-btn" onClick={onClearBag}>
                  EMPTY BAG
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bag-bottom">
        <button type="button" className="bag-crosslink" onClick={() => onNavigate('wallpapers')}>
          TAKE THE COLOUR HOME (WALLPAPERS) →
        </button>
      </div>
    </section>
  )
}

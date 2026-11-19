import { useEffect, useState } from 'react'
import { flavours, type Flavour } from '../brand'
import InteractiveTube from '../components/InteractiveTube'
import './FlavoursPage.css'

const NOTES: Record<Flavour['key'], { finish: string; feel: string; note: string }> = {
  cherry: { finish: 'SHEER RUBY GLAZE', feel: 'CUSHION JELLY', note: 'loud without trying.' },
  peach: { finish: 'WARM NECTAR TINT', feel: 'SOFT SILICONE', note: 'easy from morning to midnight.' },
  lychee: { finish: 'MILKY PETAL SHEEN', feel: 'CLOUD GLOSS', note: 'quiet, glassy, barely there.' },
  grape: { finish: 'DEEP BERRY VEIL', feel: 'PLUSH JELLY', note: 'made for after-hours light.' },
  mint: { finish: 'COOL CLEAR SHINE', feel: 'CRISP BOUNCE', note: 'fresh glass on bare lips.' },
  mango: { finish: 'GOLDEN DEW WASH', feel: 'VELVET JELLY', note: 'sunny in one quiet squeeze.' },
}

export default function FlavoursPage({
  bagItems,
  onAddFlavour,
  onNavigate,
  onSelectGlobalFlavour,
}: {
  bagItems: Record<string, number>
  onAddFlavour: (item: Flavour) => void
  onNavigate: (route: 'home' | 'flavours' | 'wallpapers' | 'bag') => void
  onSelectGlobalFlavour: (item: Flavour) => void
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [justAdded, setJustAdded] = useState(false)
  const active = flavours[activeIdx]
  const details = NOTES[active.key]
  const inBagCount = bagItems[active.key] || 0

  useEffect(() => {
    onSelectGlobalFlavour(active)
  }, [active, onSelectGlobalFlavour])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        setActiveIdx(i => (i + 1) % flavours.length)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        setActiveIdx(i => (i - 1 + flavours.length) % flavours.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleAdd = () => {
    onAddFlavour(active)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 950)
  }

  return (
    <section
      className="fp-page"
      data-aura={`${active.aura},${active.jelly}`}
      style={{ '--jelly': active.jelly, '--aura': active.aura } as React.CSSProperties}
    >
      <div className="fp-top">
        <button type="button" className="fp-back" onClick={() => onNavigate('home')}>
          ← BACK TO MOCHI
        </button>
        <span className="fp-eyebrow">FLAVOUR ATELIER — DROP 01</span>
      </div>

      <div className="fp-grid">
        {/* Left: Editorial Flavour Index */}
        <div className="fp-index-col">
          <h1 className="fp-heading">
            six <em>moods.</em>
          </h1>

          <div className="fp-list" role="tablist" aria-label="Select flavour">
            {flavours.map((item, idx) => {
              const selected = idx === activeIdx
              const qty = bagItems[item.key] || 0
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`fp-row ${selected ? 'is-active' : ''}`}
                  style={{ '--row-jelly': item.jelly } as React.CSSProperties}
                  onClick={() => setActiveIdx(idx)}
                >
                  <span className="fp-row__num">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="fp-row__name">{item.name}</span>
                  <span className="fp-row__mood">{item.mood}</span>
                  <span className="fp-row__qty">{qty > 0 ? `IN BAG (${qty})` : ''}</span>
                </button>
              )
            })}
          </div>

          <div className="fp-detail-block">
            <p className="fp-note">{details.note}</p>
            <div className="fp-specs">
              <span>9 ML</span>
              <span>{details.finish}</span>
              <span>{details.feel}</span>
            </div>
            <div className="fp-actions">
              <button type="button" className="fp-add-btn" onClick={handleAdd}>
                {justAdded ? 'ADDED TO BAG ✓' : `+ ADD ${active.name} TO BAG`}
              </button>
              <button type="button" className="fp-secondary-btn" onClick={() => onNavigate('bag')}>
                {inBagCount > 0 ? `OPEN BAG (${inBagCount} ${active.name}) →` : 'VIEW BAG →'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Giant Tactile Specimen Stage */}
        <div className="fp-stage-col">
          <span className="fp-ghost" aria-hidden="true">
            {active.name}
          </span>
          <InteractiveTube item={active} className="fp-tube" />
          <span className="fp-hint">PRESS OR DRAG TUBE TO SQUISH</span>
        </div>
      </div>

      <div className="fp-bottom">
        <button type="button" className="fp-crosslink" onClick={() => onNavigate('wallpapers')}>
          NEXT STUDIO — TAKE THE COLOUR HOME (WALLPAPERS) →
        </button>
      </div>
    </section>
  )
}

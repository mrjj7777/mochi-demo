import { useEffect, useMemo, useRef, useState } from 'react'
import { flavours, type Flavour } from '../brand'
import { clamp, createSpring } from '../physics'
import './BagPage.css'

const UNIT_PRICE = 18

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
  const [packaging, setPackaging] = useState<'soft' | 'atelier'>('soft')
  const [stage, setStage] = useState<'packing' | 'sealing' | 'confirmed'>('packing')
  const [orderCode, setOrderCode] = useState('MCH-4821')
  const [squishedUid, setSquishedUid] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const arcRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  const entries = useMemo(
    () =>
      flavours
        .map(item => ({ item, qty: bagItems[item.key] || 0 }))
        .filter(entry => entry.qty > 0),
    [bagItems],
  )

  const totalCount = entries.reduce((sum, e) => sum + e.qty, 0)
  const subtotal = totalCount * UNIT_PRICE
  const discount = soft10 ? +(subtotal * 0.1).toFixed(2) : 0
  const total = +(subtotal - discount).toFixed(2)

  const visualTubes = useMemo(
    () =>
      entries
        .flatMap(e =>
          Array.from({ length: Math.min(e.qty, 3) }, (_, idx) => ({
            ...e.item,
            uid: `${e.item.key}-${idx}`,
          })),
        )
        .slice(0, 6),
    [entries],
  )

  // Live inverse 3D perspective studio stage driven by heavy spring on pointer move
  useEffect(() => {
    const stageEl = stageRef.current
    const arcEl = arcRef.current
    if (!stageEl || !arcEl) return

    let disposed = false
    let rafId = 0
    let lastNow = performance.now()
    const rotY = createSpring('heavy', 0)
    const rotX = createSpring('heavy', 0)

    const tick = (now: number) => {
      rafId = 0
      if (disposed) return
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now
      const ry = rotY.step(dt)
      const rx = rotX.step(dt)
      arcEl.style.transform = `perspective(1400px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`
      if (!rotY.atRest(0.01) || !rotX.atRest(0.01)) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (!rafId && !disposed) {
        lastNow = performance.now()
        rafId = requestAnimationFrame(tick)
      }
    }

    const onMove = (e: PointerEvent) => {
      const rect = stageEl.getBoundingClientRect()
      const nx = clamp(((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1)
      const ny = clamp(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1)
      // True physical 3D tilt: cursor side pushes back while the opposite side swings outward
      rotY.setTarget(nx * 14)
      rotX.setTarget(-ny * 8)
      wake()
    }

    const onLeave = () => {
      rotY.setTarget(0)
      rotX.setTarget(0)
      wake()
    }

    stageEl.addEventListener('pointermove', onMove, { passive: true })
    stageEl.addEventListener('pointerleave', onLeave)
    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      stageEl.removeEventListener('pointermove', onMove)
      stageEl.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  useEffect(() => {
    return () => timers.current.forEach(t => window.clearTimeout(t))
  }, [])

  const triggerCheckout = () => {
    if (totalCount === 0 || stage !== 'packing') return
    setOrderCode(`MCH-${String(Math.floor(1000 + Math.random() * 8999))}`)
    setStage('sealing')
    timers.current.forEach(t => window.clearTimeout(t))
    const t1 = window.setTimeout(() => setStage('confirmed'), 760)
    timers.current = [t1]
  }

  const resetDrop = () => {
    timers.current.forEach(t => window.clearTimeout(t))
    setStage('packing')
    onClearBag()
  }

  return (
    <section className="bag-shell section" data-aura="#F6D3D6,#F4A27E">
      <div className="bag-split">
        {/* LEFT 52%: Photorealistic 3D Floating Studio Tube Stage */}
        <div ref={stageRef} className={`bag-stage ${stage !== 'packing' ? `bag-stage--${stage}` : ''}`}>
          <div className="bag-stage__top">
            <h1 className="bag-heading">
              {stage === 'confirmed' ? (
                <>
                  sealed &amp; <em>yours.</em>
                </>
              ) : (
                <>
                  your <em>bag.</em>
                </>
              )}
            </h1>
            <span className="bag-count-meta">
              {stage === 'confirmed'
                ? `#${orderCode}`
                : `${String(totalCount).padStart(2, '0')} ${totalCount === 1 ? 'TUBE' : 'TUBES'}`}
            </span>
          </div>

          <div className="bag-stage__viewport">
            <div ref={arcRef} className="bag-arc">
              {visualTubes.length === 0 ? (
                <div className="bag-empty">
                  <p className="bag-empty__line">
                    your pocket is <em>empty.</em>
                  </p>
                  <span className="bag-empty__sub">DROP ANY SHADE BELOW TO STAGE IT IN 3D</span>
                </div>
              ) : (
                visualTubes.map((tube, idx) => {
                  const mid = (visualTubes.length - 1) / 2
                  const delta = idx - mid
                  const zDepth = Math.round((1 - Math.abs(delta) * 0.35) * 48)
                  const rot = delta * 3.5
                  const isSquished = squishedUid === tube.uid
                  return (
                    <button
                      key={tube.uid}
                      type="button"
                      className={`bag-tube3d ${isSquished ? 'is-squished' : ''}`}
                      style={
                        {
                          '--tz': `${stage === 'packing' ? zDepth : 24}px`,
                          '--rot': `${stage === 'packing' ? rot : 0}deg`,
                          '--aura-tint': tube.aura,
                          '--delay': `${idx * 45}ms`,
                        } as React.CSSProperties
                      }
                      onPointerDown={() => setSquishedUid(tube.uid)}
                      onPointerUp={() => setSquishedUid(null)}
                      onPointerLeave={() => setSquishedUid(null)}
                      aria-label={`Squish ${tube.name} tube in your bag`}
                    >
                      <img
                        src={`/media/cutouts/mochi-${tube.asset}.webp`}
                        alt={`${tube.name} lip jelly`}
                        decoding="async"
                        draggable={false}
                      />
                      <span className="bag-tube3d__shadow" aria-hidden="true" />
                    </button>
                  )
                })
              )}
            </div>

            {/* Express Seal Hairline Curtain Sweep */}
            {stage !== 'packing' && (
              <div className="bag-seal-banner" aria-live="polite">
                <span>DROP 01 · {stage === 'sealing' ? 'RESERVING STUDIO PARCEL' : `RESERVED · #${orderCode}`}</span>
              </div>
            )}
          </div>

          {/* Quick Shade Adder Strip */}
          {stage === 'packing' && (
            <div className="bag-quick">
              <span className="bag-quick__label">DROP A SHADE</span>
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
          )}
        </div>

        {/* RIGHT 48%: Minimalist Silicon-Valley Express Checkout Sheet */}
        <div className="bag-sheet">
          {stage === 'confirmed' ? (
            <div className="bag-receipt">
              <div className="bag-receipt__timeline">
                <span className="is-done">01 CONFIRMED</span>
                <span className="is-done">02 PACKING</span>
                <span className="is-active">03 STUDIO DISPATCH</span>
              </div>

              <h2 className="bag-receipt__title">
                drop 01 <em>reserved.</em>
              </h2>
              <p className="bag-receipt__desc">
                {totalCount} {totalCount === 1 ? 'tube' : 'tubes'} staged in{' '}
                {packaging === 'atelier' ? 'signed atelier packaging' : 'soft matte packaging'}.
              </p>

              <div className="bag-receipt__ledger">
                <div>
                  <span>REFERENCE</span>
                  <span>#{orderCode}</span>
                </div>
                <div>
                  <span>PERK</span>
                  <span>{soft10 ? `SOFT10 (−$${discount.toFixed(2)})` : 'STANDARD'}</span>
                </div>
                <div>
                  <span>ESTIMATED TOTAL</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <p className="bag-demo-note">
                Concept checkout by J&amp;J Intelligence — studio demonstration, no payment processed.
              </p>

              <div className="bag-receipt__actions">
                <button type="button" className="bag-cta-btn" onClick={resetDrop}>
                  PACK ANOTHER DROP →
                </button>
                <div className="bag-links">
                  <button type="button" onClick={() => onNavigate('wallpapers')}>
                    WALLPAPERS →
                  </button>
                  <button type="button" onClick={() => onNavigate('home')}>
                    HOME
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bag-ledger">
              <div className="bag-sheet__head">
                <span>EXPRESS CHECKOUT</span>
                <span>DROP 01 · 9 ML</span>
              </div>

              <div className="bag-rows">
                {entries.length === 0 ? (
                  <p className="bag-rows__empty">Select any shade on the left to stage your MOCHI drop.</p>
                ) : (
                  entries.map(({ item, qty }) => (
                    <div key={item.key} className="bag-row">
                      <div className="bag-row__info">
                        <span className="bag-row__name">
                          {item.name.toLowerCase()} — <em>{item.mood}</em>
                        </span>
                        <span className="bag-row__spec">9 ML · SILICONE TUBE</span>
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
                        <span className="bag-row__price">${(qty * UNIT_PRICE).toFixed(0)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bag-options">
                <div className="bag-option-row">
                  <span className="bag-option-label">PACKAGING</span>
                  <div className="bag-option-choices">
                    <button
                      type="button"
                      className={packaging === 'soft' ? 'is-selected' : ''}
                      onClick={() => setPackaging('soft')}
                    >
                      SOFT MATTE
                    </button>
                    <button
                      type="button"
                      className={packaging === 'atelier' ? 'is-selected' : ''}
                      onClick={() => setPackaging('atelier')}
                    >
                      ATELIER EDITION
                    </button>
                  </div>
                </div>

                <div className="bag-option-row">
                  <p className="bag-perk__line">
                    <em>first squeeze 10% lighter</em> · <span>SOFT10</span>
                  </p>
                  <button
                    type="button"
                    className={`bag-perk__toggle ${soft10 ? 'is-on' : ''}`}
                    onClick={onToggleSoft10}
                    aria-pressed={soft10}
                  >
                    {soft10 ? `APPLIED (−$${discount.toFixed(2)}) ✓` : 'APPLY SOFT10'}
                  </button>
                </div>
              </div>

              <div className="bag-summary">
                <div className="bag-totals">
                  <span className="bag-totals__label">TOTAL</span>
                  <span className="bag-totals__val">${total.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  className={`bag-cta-btn ${stage === 'sealing' ? 'is-sealing' : ''}`}
                  disabled={totalCount === 0 || stage === 'sealing'}
                  onClick={triggerCheckout}
                >
                  {totalCount === 0
                    ? 'ADD A SHADE TO RESERVE'
                    : stage === 'sealing'
                      ? 'RESERVING DROP 01...'
                      : `RESERVE DROP 01 — $${total.toFixed(2)} →`}
                </button>
              </div>

              <div className="bag-footer">
                <p className="bag-demo-note">Concept demo by J&amp;J Intelligence — no card charged.</p>
                <div className="bag-links">
                  <button type="button" onClick={() => onNavigate('flavours')}>
                    SIX MOODS →
                  </button>
                  <button type="button" onClick={() => onNavigate('wallpapers')}>
                    WALLPAPERS →
                  </button>
                  {totalCount > 0 && (
                    <button type="button" className="bag-clear" onClick={onClearBag}>
                      CLEAR
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

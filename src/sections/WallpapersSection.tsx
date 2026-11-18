import { useCallback, useEffect, useRef, useState } from 'react'
import { flavours, wallpaperFileSize, wallpaperSize } from '../brand'
import { PointerHistory, clamp, createSpring, projectMomentum } from '../physics/spring'
import type { DeviceTier } from '../types/mochi'
import EditorialAction from './EditorialAction'

export type WallpapersSectionProps = {
  reduced?: boolean
  tier?: DeviceTier
  onOpen: (index: number) => void
}

const REST_ANGLES = [-2.4, 1.8, -3.2, 2.6, -1.4, 3.0]
const REST_OFFSETS_X = [0, 7, -8, 12, -11, 15]
const REST_OFFSETS_Y = [0, 4, 8, 12, 15, 19]

type CardSpring = {
  x: ReturnType<typeof createSpring>
  y: ReturnType<typeof createSpring>
  rot: ReturnType<typeof createSpring>
}

export default function WallpapersSection({ reduced = false, onOpen }: WallpapersSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // order[0] is the print currently on top of the physical stack
  const [order, setOrder] = useState<number[]>(() => flavours.map((_, i) => i))
  const orderRef = useRef(order)
  orderRef.current = order

  const springsRef = useRef<CardSpring[]>(
    flavours.map((_, slot) => ({
      x: createSpring('heavy', REST_OFFSETS_X[slot] ?? 0),
      y: createSpring('heavy', REST_OFFSETS_Y[slot] ?? 0),
      rot: createSpring('heavy', REST_ANGLES[slot] ?? 0),
    })),
  )

  const historyRef = useRef(new PointerHistory(5))
  const dragRef = useRef<{
    active: boolean
    cardIndex: number
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: number
    grabOffsetX: number
    grabOffsetY: number
  }>({
    active: false,
    cardIndex: -1,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: 0,
    grabOffsetX: 0,
    grabOffsetY: 0,
  })
  const cycleTimerRef = useRef(0)
  const tappedViaPointerRef = useRef(false)

  const syncTargetsToOrder = useCallback((nextOrder: number[]) => {
    nextOrder.forEach((cardIdx, slot) => {
      const s = springsRef.current[cardIdx]
      if (!s) return
      s.x.setTarget(REST_OFFSETS_X[slot] ?? 0)
      s.y.setTarget(REST_OFFSETS_Y[slot] ?? 0)
      s.rot.setTarget(REST_ANGLES[slot] ?? 0)
    })
  }, [])

  // Step all 6 heavy print springs smoothly when visible / active
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let visible = true
    let last = performance.now()

    const io = new IntersectionObserver(
      entries => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { rootMargin: '200px' },
    )
    if (sectionRef.current) io.observe(sectionRef.current)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      springsRef.current.forEach((s, cardIdx) => {
        const x = s.x.step(dt)
        const y = s.y.step(dt)
        const rot = s.rot.step(dt)
        const el = cardRefs.current[cardIdx]
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`
        }
      })
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.clearTimeout(cycleTimerRef.current)
    }
  }, [reduced])

  const sendTopCardToBack = useCallback(
    (cardIndex: number, vx: number, vy: number, torqueSign: number) => {
      const s = springsRef.current[cardIndex]
      if (!s) return

      // Project flight outward proportional to release velocity
      const projectedX = clamp(projectMomentum(s.x.value, vx * 0.45), -440, 440)
      const projectedY = clamp(projectMomentum(s.y.value, vy * 0.45), -260, 260)
      const launchX = Math.abs(projectedX) < 150 ? Math.sign(vx || 1) * 260 : projectedX
      const launchY = projectedY

      s.x.setVelocity(vx * 0.65)
      s.y.setVelocity(vy * 0.65)
      s.x.setTarget(launchX)
      s.y.setTarget(launchY)
      s.rot.setTarget(s.rot.value + torqueSign * clamp(Math.hypot(vx, vy) * 0.014, 8, 22))

      // After peak throw, cycle z-order to back of stack and arc cleanly underneath
      window.clearTimeout(cycleTimerRef.current)
      cycleTimerRef.current = window.setTimeout(() => {
        setOrder(prev => {
          const rest = prev.filter(i => i !== cardIndex)
          const next = [...rest, cardIndex]
          syncTargetsToOrder(next)
          return next
        })
      }, 210)
    },
    [syncTargetsToOrder],
  )

  const handleCardPointerDown = (cardIndex: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || orderRef.current[0] !== cardIndex) return
    const rect = event.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width * 0.5
    const cy = rect.top + rect.height * 0.5
    const grabOffsetX = (event.clientX - cx) / Math.max(1, rect.width * 0.5)
    const grabOffsetY = (event.clientY - cy) / Math.max(1, rect.height * 0.5)

    dragRef.current = {
      active: true,
      cardIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: 0,
      grabOffsetX,
      grabOffsetY,
    }
    historyRef.current.reset()
    historyRef.current.add(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCardPointerMove = (cardIndex: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !dragRef.current.active || dragRef.current.cardIndex !== cardIndex) return
    const dx = event.clientX - dragRef.current.lastX
    const dy = event.clientY - dragRef.current.lastY
    dragRef.current.lastX = event.clientX
    dragRef.current.lastY = event.clientY
    dragRef.current.moved += Math.hypot(dx, dy)
    historyRef.current.add(event.clientX, event.clientY)

    const s = springsRef.current[cardIndex]
    if (!s) return
    const totalDx = event.clientX - dragRef.current.startX
    const totalDy = event.clientY - dragRef.current.startY
    const torque = (totalDx * -dragRef.current.grabOffsetY + totalDy * dragRef.current.grabOffsetX) * 0.08 + totalDx * 0.04

    s.x.snap(REST_OFFSETS_X[0] + totalDx)
    s.y.snap(REST_OFFSETS_Y[0] + totalDy)
    s.rot.snap(REST_ANGLES[0] + clamp(torque, -26, 26))
  }

  const finishCardDrag = (cardIndex: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.cardIndex !== cardIndex) return
    const { moved, grabOffsetY } = dragRef.current
    dragRef.current.active = false
    const vel = historyRef.current.velocity()
    historyRef.current.reset()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (moved < 8) {
      tappedViaPointerRef.current = true
      window.setTimeout(() => {
        tappedViaPointerRef.current = false
      }, 60)
      onOpen(cardIndex)
      return
    }

    const s = springsRef.current[cardIndex]
    const dist = s ? Math.hypot(s.x.value - REST_OFFSETS_X[0], s.y.value - REST_OFFSETS_Y[0]) : 0
    const speed = Math.hypot(vel.x, vel.y)
    if (speed > 240 || dist > 88) {
      const torqueSign = Math.sign((vel.x || 1) * (-grabOffsetY || 0.5)) || 1
      sendTopCardToBack(cardIndex, vel.x, vel.y, torqueSign)
    } else {
      syncTargetsToOrder(orderRef.current)
    }
  }

  const topIndex = order[0] ?? 0
  const topFlavour = flavours[topIndex] ?? flavours[0]

  return (
    <section
      id="wallpapers"
      ref={sectionRef}
      className={`wallpapers section ${reduced ? 'wallpapers--reduced' : ''}`}
      data-aura="#2346B8,#F2EDE4"
    >
      <div className="wallpapers__layout mochi-grid">
        <div className="wallpapers__header">
          <h2 className="display wallpapers__title">take the colour home.</h2>
          {!reduced && (
            <div className="wallpapers__meta">
              <span className="wallpapers__label micro" aria-live="polite">
                {wallpaperSize} — {topFlavour.name}
              </span>
              <div className="wallpapers__actions">
                <EditorialAction
                  as="a"
                  href={`/media/wallpapers/mochi-${topFlavour.asset}-${wallpaperFileSize}.png`}
                  download
                  reduced={reduced}
                >
                  ↓ DOWNLOAD {wallpaperSize}
                </EditorialAction>
              </div>
            </div>
          )}
        </div>

        {reduced ? (
          <div className="wallpapers__grid">
            {flavours.map((item, idx) => {
              const file = `/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`
              return (
                <article key={item.key} className="wallpaper-print wallpaper-print--static">
                  <button
                    type="button"
                    className="wallpaper-print__trigger"
                    onClick={() => onOpen(idx)}
                    aria-label={`Preview ${item.name} wallpaper, ${wallpaperSize}`}
                  >
                    <span className="crop-mark crop-mark--tl" aria-hidden="true" />
                    <span className="crop-mark crop-mark--tr" aria-hidden="true" />
                    <span className="crop-mark crop-mark--bl" aria-hidden="true" />
                    <span className="crop-mark crop-mark--br" aria-hidden="true" />
                    <img
                      src={file}
                      width={1290}
                      height={2796}
                      alt={`${item.name} MOCHI phone wallpaper`}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  <p className="wallpaper-print__caption micro">
                    {wallpaperSize} — {item.name}
                  </p>
                  <EditorialAction as="a" href={file} download reduced={reduced}>
                    ↓ DOWNLOAD {wallpaperSize}
                  </EditorialAction>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="wallpapers__stack-area">
            <div className="wallpapers__stack">
              {flavours.map((item, idx) => {
                const slot = order.indexOf(idx)
                const isTop = slot === 0
                const file = `/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`
                return (
                  <div
                    key={item.key}
                    ref={el => {
                      cardRefs.current[idx] = el
                    }}
                    className={`wallpaper-print ${isTop ? 'wallpaper-print--top' : ''}`}
                    style={{
                      zIndex: flavours.length - slot,
                      transform: `translate3d(${REST_OFFSETS_X[slot] ?? 0}px, ${REST_OFFSETS_Y[slot] ?? 0}px, 0) rotate(${REST_ANGLES[slot] ?? 0}deg)`,
                    }}
                    onPointerDown={e => handleCardPointerDown(idx, e)}
                    onPointerMove={e => handleCardPointerMove(idx, e)}
                    onPointerUp={e => finishCardDrag(idx, e)}
                    onPointerCancel={e => finishCardDrag(idx, e)}
                  >
                    <span className="crop-mark crop-mark--tl" aria-hidden="true" />
                    <span className="crop-mark crop-mark--tr" aria-hidden="true" />
                    <span className="crop-mark crop-mark--bl" aria-hidden="true" />
                    <span className="crop-mark crop-mark--br" aria-hidden="true" />

                    <button
                      type="button"
                      className="wallpaper-print__trigger"
                      tabIndex={isTop ? 0 : -1}
                      aria-label={`Preview ${item.name} wallpaper, ${wallpaperSize}`}
                      onClick={() => {
                        if (tappedViaPointerRef.current) return
                        onOpen(idx)
                      }}
                    >
                      <img
                        src={file}
                        width={1290}
                        height={2796}
                        alt={`${item.name} MOCHI phone wallpaper`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

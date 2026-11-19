import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours, type Flavour } from '../brand'
import InteractiveTube from '../components/InteractiveTube'
import './FlavoursPage.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const POETIC_LINES: Record<Flavour['key'], string> = {
  cherry: 'loud without trying.',
  peach: 'easy from morning to midnight.',
  lychee: 'quiet, glassy, barely there.',
  grape: 'made for after-hours light.',
  mint: 'fresh glass on bare lips.',
  mango: 'sunny in one quiet squeeze.',
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
  const rootRef = useRef<HTMLDivElement>(null)
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const [activeChapter, setActiveChapter] = useState(0)

  useEffect(() => {
    onSelectGlobalFlavour(flavours[activeChapter] ?? flavours[0])
  }, [activeChapter, onSelectGlobalFlavour])

  // Monumental scroll-driven parallax & chapter reveal across all six 100svh shade spreads
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const chapters = gsap.utils.toArray<HTMLElement>('.fp-chapter', root)
      chapters.forEach((chapter, idx) => {
        ScrollTrigger.create({
          trigger: chapter,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActiveChapter(idx),
          onEnterBack: () => setActiveChapter(idx),
        })

        if (reduced) return

        const word = chapter.querySelector<HTMLElement>('.fp-chapter__word')
        const tube = chapter.querySelector<HTMLElement>('.fp-chapter__tube-wrap')
        const meta = chapter.querySelector<HTMLElement>('.fp-chapter__meta')

        if (word) {
          gsap.fromTo(
            word,
            { yPercent: 18 },
            {
              yPercent: -18,
              ease: 'none',
              scrollTrigger: {
                trigger: chapter,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.7,
              },
            },
          )
        }

        if (tube) {
          gsap.fromTo(
            tube,
            { y: 56, scale: 0.9, rotate: idx % 2 === 0 ? -3 : 3 },
            {
              y: -36,
              scale: 1.04,
              rotate: idx % 2 === 0 ? 2 : -2,
              ease: 'none',
              scrollTrigger: {
                trigger: chapter,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.85,
              },
            },
          )
        }

        if (meta) {
          gsap.fromTo(
            meta,
            { y: 28, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: chapter,
                start: 'top 78%',
                end: 'top 38%',
                scrub: 0.5,
              },
            },
          )
        }
      })

      // Opening 6-tube parade gentle horizontal expansion on scroll
      if (!reduced) {
        const parade = root.querySelector<HTMLElement>('.fp-parade')
        if (parade) {
          gsap.fromTo(
            parade,
            { scale: 1, y: 0 },
            {
              scale: 1.07,
              y: -36,
              ease: 'none',
              scrollTrigger: {
                trigger: '.fp-intro',
                start: 'top top',
                end: 'bottom top',
                scrub: 0.6,
              },
            },
          )
        }
      }
    },
    { scope: rootRef },
  )

  const scrollToShade = (idx: number) => {
    const el = document.getElementById(`shade-${flavours[idx].key}`)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleAdd = (item: Flavour) => {
    onAddFlavour(item)
    setAddedKey(item.key)
    window.setTimeout(() => setAddedKey(prev => (prev === item.key ? null : prev)), 1000)
  }

  return (
    <div ref={rootRef} className="fp-root">
      {/* Minimal vertical shade rail on right edge */}
      <aside className="fp-rail" aria-label="Jump to shade">
        {flavours.map((item, idx) => (
          <button
            key={item.key}
            type="button"
            className={`fp-rail__btn ${idx === activeChapter ? 'is-active' : ''}`}
            onClick={() => scrollToShade(idx)}
            aria-label={`Jump to ${item.name}`}
          >
            {String(idx + 1).padStart(2, '0')}
          </button>
        ))}
      </aside>

      {/* Opening 100svh Monumental Breath */}
      <section className="fp-intro section" data-aura="#F2EDE4,#F6D3D6">
        <div className="fp-intro__head">
          <h1 className="fp-intro__title">
            six <em>moods.</em>
          </h1>
          <p className="fp-intro__sub">one soft silhouette. six ways to wear light.</p>
        </div>

        <div className="fp-parade" aria-label="All six MOCHI shades">
          {flavours.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              className="fp-parade__item"
              onClick={() => scrollToShade(idx)}
              aria-label={`Explore ${item.name} — ${item.mood}`}
            >
              <img
                src={`/media/cutouts/mochi-${item.asset}.webp`}
                alt={`${item.name} lip jelly`}
                loading="eager"
                decoding="async"
              />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Six Full-Screen 100svh Monumental Shade Chapters */}
      {flavours.map((item, idx) => {
        const qty = bagItems[item.key] || 0
        return (
          <section
            key={item.key}
            id={`shade-${item.key}`}
            className="fp-chapter section"
            data-aura={`${item.aura},${item.jelly}`}
            style={{ '--jelly': item.jelly, '--aura': item.aura } as React.CSSProperties}
          >
            {/* Full-width fitted display wordmark — NEVER cut off at edges */}
            <span className="fp-chapter__word" aria-hidden="true">
              {item.name}
            </span>

            {/* Giant centered interactive silicone tube (press/drag to squish + pop cap) */}
            <div className="fp-chapter__tube-wrap">
              <InteractiveTube item={item} className="fp-chapter__tube" />
            </div>

            {/* Minimal calm editorial footer anchors with generous air */}
            <div className="fp-chapter__meta">
              <div className="fp-chapter__left">
                <span className="fp-chapter__index">
                  {String(idx + 1).padStart(2, '0')} / 06 · 9 ML
                </span>
                <p className="fp-chapter__mood">
                  {item.name.toLowerCase()} — <em>{item.mood}</em>
                </p>
                <p className="fp-chapter__line">{POETIC_LINES[item.key]}</p>
              </div>

              <div className="fp-chapter__right">
                <button type="button" className="fp-chapter__add" onClick={() => handleAdd(item)}>
                  {addedKey === item.key
                    ? 'ADDED TO BAG ✓'
                    : qty > 0
                      ? `+ ADD ANOTHER (${qty} IN BAG)`
                      : '+ ADD TO BAG'}
                </button>
                {qty > 0 && (
                  <button type="button" className="fp-chapter__baglink" onClick={() => onNavigate('bag')}>
                    OPEN BAG →
                  </button>
                )}
              </div>
            </div>
          </section>
        )
      })}

      {/* Spacious Editorial Closing Breath */}
      <section className="fp-outro section" data-aura="#F2EDE4,#E46A8E">
        <p className="fp-outro__eyebrow">CONTINUE</p>
        <button type="button" className="fp-outro__link" onClick={() => onNavigate('wallpapers')}>
          take the colour <em>home.</em>
        </button>
        <div className="fp-outro__sublinks">
          <button type="button" onClick={() => onNavigate('bag')}>
            OPEN BAG →
          </button>
          <button type="button" onClick={() => onNavigate('home')}>
            BACK TO MOCHI
          </button>
        </div>
      </section>
    </div>
  )
}

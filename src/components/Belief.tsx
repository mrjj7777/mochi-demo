import { useEffect, useMemo, useRef } from 'react'
import { clamp, createSpring, type SpringValue } from '../physics'
import './Belief.css'

type WordMode = 'soft' | 'squeezable' | 'yours'
type LetterState = { spring: SpringValue; reveal: SpringValue; base: number }

const copy: Array<{ word: WordMode; className: string }> = [
  { word: 'soft', className: 'belief__word--cherry' },
  { word: 'squeezable', className: 'belief__word--lychee' },
  { word: 'yours', className: 'belief__word--mango' },
]

function createLetters(word: string, mode: WordMode): LetterState[] {
  return Array.from(word).map((_, index) => {
    const spring = createSpring(mode === 'yours' ? 'heavy' : 'jelly', mode === 'yours' ? -1.08 - index * .04 : 1)
    spring.setTarget(mode === 'yours' ? 0 : 1)
    return { spring, reveal: createSpring('settle', -1), base: index }
  })
}

export default function Belief() {
  const rootRef = useRef<HTMLElement>(null)
  const pointerRef = useRef({ x: .5, y: .5, active: false })
  const lastTime = useRef(performance.now())
  const visibleRef = useRef(false)
  const words = useMemo(() => copy.map(item => ({ ...item, letters: createLetters(item.word, item.word) })), [])
  const refs = useRef<Array<HTMLSpanElement | null>[]>([])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let idleTimer = 0
    const wake = () => {
      if (idleTimer) { window.clearTimeout(idleTimer); idleTimer = 0 }
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onPointer = (event: PointerEvent) => { const rect = root.getBoundingClientRect(); pointerRef.current = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, active: true }; wake() }
    const onLeave = () => { pointerRef.current.active = false }
    const onScroll = () => {
      const rect = root.getBoundingClientRect(); const viewport = window.innerHeight; const progress = clamp((viewport - rect.top) / Math.max(1, rect.height + viewport), 0, 1)
      const pressure = clamp(Math.abs(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scroll-velocity')) || 0) / 2.5, 0, 1)
      const squeeze = clamp(Math.sin(progress * Math.PI) * .72 + pressure * .18, 0, .9)
      words[1].letters.forEach(letter => letter.spring.setTarget(1 - squeeze * (1 - Math.abs(letter.base - (words[1].letters.length - 1) / 2) / Math.max(1, words[1].letters.length / 2)) * .3))
      if (visibleRef.current) wake()
    }
    const observer = new IntersectionObserver(entries => { visibleRef.current = entries[0]?.isIntersecting ?? false; if (visibleRef.current) wake() }, { threshold: .08 })
    observer.observe(root); root.addEventListener('pointermove', onPointer); root.addEventListener('pointerleave', onLeave); window.addEventListener('scroll', onScroll, { passive: true })
    const tick = (now: number) => {
      raf = 0
      const dt = Math.min(.05, (now - lastTime.current) / 1000); lastTime.current = now
      const pointer = pointerRef.current
      words.forEach((entry, wordIndex) => entry.letters.forEach((letter, index) => {
        if (wordIndex === 0 && visibleRef.current) {
          if (pointer.active) {
            const distance = Math.hypot(pointer.x - .5, pointer.y - (.25 + index / Math.max(1, entry.letters.length) * .5))
            letter.spring.setTarget(1 - clamp(1 - distance * 2.2, 0, 1) * .14)
          } else {
            letter.spring.setTarget(1)
          }
        }
        if (reduced) { letter.spring.snap(wordIndex === 2 ? 0 : 1); letter.reveal.snap(1) } else { letter.reveal.setTarget(visibleRef.current ? 1 : 0); letter.reveal.step(dt); letter.spring.step(dt) }
        const node = refs.current[wordIndex]?.[index]
        if (node) {
          const physicalOffset = wordIndex === 2 ? -letter.spring.value * 10 : (1 - letter.spring.value) * 10
          const y = (1 - letter.reveal.value) * 110 + physicalOffset
          const scaleX = wordIndex === 1 ? letter.spring.value : 1
          const scaleY = wordIndex === 0 ? letter.spring.value : 1
          node.style.transform = `translate3d(0, ${y}%, 0) scale(${scaleX}, ${scaleY})`
        }
      }))
      if (reduced) return
      if (!visibleRef.current) {
        idleTimer = window.setTimeout(() => { idleTimer = 0; if (visibleRef.current) wake() }, 1000)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    onScroll()
    wake()
    return () => { if (raf) cancelAnimationFrame(raf); if (idleTimer) window.clearTimeout(idleTimer); observer.disconnect(); root.removeEventListener('pointermove', onPointer); root.removeEventListener('pointerleave', onLeave); window.removeEventListener('scroll', onScroll) }
  }, [words])

  return <section ref={rootRef} id="belief" className="belief section section--tall" data-aura="#2FA4A8,#E46A8E">
    <div className="belief__words" aria-label="soft. squeezable. yours.">
      {words.map((entry, wordIndex) => <span key={entry.word} className={`belief__word ${entry.className}`}>
        {Array.from(entry.word).map((character, index) => <span key={`${entry.word}-${index}`} ref={node => { if (!refs.current[wordIndex]) refs.current[wordIndex] = []; refs.current[wordIndex][index] = node }} className="belief__char" aria-hidden="true">{character}</span>)}<span className="belief__punctuation" aria-hidden="true">.</span>
      </span>)}
    </div>
    <p className="belief__small">a lip jelly you'll keep squeezing.</p>
  </section>
}

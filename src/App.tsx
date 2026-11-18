import { lazy, Suspense, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import { flavours, wallpaperFileSize, wallpaperSize, type Flavour } from './brand'
import PhysicsBelief from './components/Belief'
import GlobalAuraCanvas from './components/GlobalAura'
import PhysicsHero from './components/Hero'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBand } from './physics'

const MochiTube3D = lazy(() => import('./components/MochiTube3D'))

gsap.registerPlugin(ScrollTrigger, useGSAP)

const FlavourContext = createContext({ flavour: flavours[0], setFlavour: (_: Flavour) => {} })
const useFlavour = () => useContext(FlavourContext)

function Aura({ className = '' }: { className?: string }) {
  const { flavour } = useFlavour()
  return <div className={`aura ${className}`} style={{ '--aura': flavour.aura, '--jelly': flavour.jelly } as React.CSSProperties} aria-hidden="true" />
}

function LegacyGlobalAura() {
  const { flavour } = useFlavour()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false })
    const hex = (value: string) => { const clean = value.replace('#', ''); return [0, 2, 4].map(offset => parseInt(clean.slice(offset, offset + 2), 16) / 255) }
    const aura = hex(flavour.aura); const jelly = hex(flavour.jelly)
    if (!gl) return
    const vertex = gl.createShader(gl.VERTEX_SHADER); const fragment = gl.createShader(gl.FRAGMENT_SHADER)
    if (!vertex || !fragment) return
    gl.shaderSource(vertex, 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.0,1.0); }')
    gl.shaderSource(fragment, 'precision mediump float; uniform vec2 r; uniform float t; uniform vec3 aura; uniform vec3 jelly; void main(){ vec2 uv=gl_FragCoord.xy/r; vec2 c=uv-vec2(.5,.48); float d=length(c); float pulse=.5+.5*sin(t*.35); float ring=smoothstep(.72,.04,d)*(0.22+0.06*pulse); vec2 g=uv-vec2(.28,.72); float glow=smoothstep(.58,.0,length(g))*.11; vec3 colour=mix(jelly,aura,.64); gl_FragColor=vec4(colour,ring+glow); }')
    gl.compileShader(vertex); gl.compileShader(fragment)
    const program = gl.createProgram(); if (!program) return
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.useProgram(program)
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const resolution = gl.getUniformLocation(program, 'r'); const time = gl.getUniformLocation(program, 't'); const auraColour = gl.getUniformLocation(program, 'aura'); const jellyColour = gl.getUniformLocation(program, 'jelly')
    let frame = 0; const started = performance.now()
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height) }
    const draw = (now: number) => { gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, (now - started) / 1000); gl.uniform3fv(auraColour, aura); gl.uniform3fv(jellyColour, jelly); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); frame = requestAnimationFrame(draw) }
    resize(); window.addEventListener('resize', resize); frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteBuffer(buffer) }
  }, [flavour])
  return <canvas ref={canvasRef} className="global-aura" aria-hidden="true" />
}

function ProductTube({ flavour, squeezed = false, className = '' }: { flavour: Flavour; squeezed?: boolean; className?: string }) {
  return <div className={`tube ${squeezed ? 'tube--squeezed' : ''} ${className}`} style={{ '--jelly': flavour.jelly } as React.CSSProperties} aria-label={`${flavour.name} lip jelly`}>
    <span className="tube__cap" /><span className="tube__body"><span className="tube__shine" /><span className="tube__word">MOCHI</span><span className="tube__ml">9 ML</span></span><span className="tube__tip" />
  </div>
}

function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  useEffect(() => {
    const sources = [
      '/media/photos/mochi-hero-wide.webp',
      '/media/cutouts/mochi-cherry.webp',
      '/media/photos/mochi-peach-model.webp',
      '/media/photos/mochi-blob-stand.webp',
      '/media/photos/mochi-all-pile.webp',
      '/media/photos/mochi-model-1.webp',
      '/media/photos/mochi-model-2.webp',
      '/media/photos/mochi-model-3.webp',
      '/media/photos/mochi-model-4.webp',
      '/media/photos/mochi-model-5.webp',
      '/media/photos/mochi-diptych-cherry.webp',
    ]
    let complete = 0
    sources.forEach(source => { const image = new Image(); const markReady = () => { complete += 1; if (complete === sources.length) setAssetsReady(true) }; image.onload = markReady; image.onerror = markReady; image.src = source })
    return () => { complete = sources.length }
  }, [])
  useEffect(() => { let value = 0; const timer = window.setInterval(() => { value += 10; setCount(value); if (value >= 100 && assetsReady) { window.clearInterval(timer); window.setTimeout(onDone, 220) } }, 16); return () => window.clearInterval(timer) }, [assetsReady, onDone])
  return <div className={`preloader ${done ? 'preloader--done' : ''}`} aria-hidden={done}><div className="preloader__dome" /><div className="preloader__word">MOCHI</div><span className="micro preloader__count">{String(count).padStart(3, '0')}</span></div>
}

function Header({ bag, onJump }: { bag: number; onJump: (id: string) => void }) {
  const { setFlavour } = useFlavour()
  return <header className="site-nav"><button className="nav-brand" onClick={() => onJump('hero')} aria-label="MOCHI">MOCHI</button><nav className="nav-links" aria-label="MOCHI"><button onClick={() => { setFlavour(flavours[0]); onJump('flavours') }}>FLAVOURS</button><button onClick={() => onJump('wallpapers')}>WALLPAPERS</button><span className="bag" aria-label={`bag ${bag}`}>BAG ({bag})</span></nav></header>
}

function LegacyHero({ onJump }: { onJump: (id: string) => void }) {
  const heroRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetFrame = useRef(0)
  const currentFrame = useRef(0)
  const loadedFrames = useRef<(HTMLImageElement | undefined)[]>([])
  const hasScrolled = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const pin = pinRef.current
    if (!canvas || !pin) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return
    const mobile = window.matchMedia('(max-width: 700px)').matches
    const count = mobile ? 86 : 172
    const directory = mobile ? '/media/hero-seq-v4/mob' : '/media/hero-seq-v4/desk'
    loadedFrames.current = Array.from({ length: count })
    let raf = 0
    let disposed = false
    const draw = (frameIndex = Math.round(currentFrame.current)) => {
      if (disposed) return
      const image = loadedFrames.current[frameIndex] || loadedFrames.current.find(Boolean)
      if (!image?.naturalWidth) return
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(bounds.width * dpr))
      const height = Math.max(1, Math.round(bounds.height * dpr))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight)
      const imageWidth = image.naturalWidth * scale
      const imageHeight = image.naturalHeight * scale
      context.clearRect(0, 0, bounds.width, bounds.height)
      context.drawImage(image, (bounds.width - imageWidth) / 2, (bounds.height - imageHeight) / 2, imageWidth, imageHeight)
    }
    const animate = () => {
      currentFrame.current += (targetFrame.current - currentFrame.current) * 0.14
      draw()
      raf = requestAnimationFrame(animate)
    }
    const load = (index: number) => {
      if (loadedFrames.current[index]) return
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => { loadedFrames.current[index] = image; if (index === 0) draw(0) }
      image.src = `${directory}/${String(index + 1).padStart(4, '0')}.webp`
    }
    load(0)
    for (let index = 8; index < count; index += 8) load(index)
    for (let index = 1; index < count; index += 1) window.setTimeout(() => load(index), Math.min(2200, index * 18))
    const resize = () => draw()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(animate)
    const idle = window.setTimeout(() => {
      if (!hasScrolled.current) {
        targetFrame.current = Math.min(count - 1, mobile ? 17 : 18)
        window.setTimeout(() => { if (!hasScrolled.current) targetFrame.current = 0 }, 700)
      }
    }, 2500)
    return () => { disposed = true; cancelAnimationFrame(raf); window.clearTimeout(idle); window.removeEventListener('resize', resize) }
  }, [])

  useGSAP(() => {
    if (!heroRef.current || !pinRef.current) return
    const trigger = ScrollTrigger.create({
      trigger: heroRef.current,
      start: 'top top',
      end: () => `+=${window.innerHeight * (window.matchMedia('(max-width: 700px)').matches ? 1.6 : 2.2)}`,
      pin: pinRef.current,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: self => {
        hasScrolled.current = true
        const progress = self.progress
        const count = window.matchMedia('(max-width: 700px)').matches ? 86 : 172
        targetFrame.current = progress * (count - 1)
        pinRef.current?.style.setProperty('--headline-opacity', String(Math.min(1, Math.max(0, (progress - .08) * 8)) * (1 - Math.min(1, Math.max(0, progress - .84) * 6))))
      },
    })
    return () => trigger.kill()
  }, { scope: heroRef })

  return <section id="hero" className="hero section hero--sequence" ref={heroRef} data-aura="#F2EDE4,#F6D3D6"><div className="hero__pin" ref={pinRef}><canvas ref={canvasRef} className="hero__canvas" aria-label="MOCHI lip jelly Wave" /><div className="hero__grain" aria-hidden="true" /><div className="hero__headline" aria-hidden="true"><span>soft is</span> <em>a choice.</em></div><p className="hero__mono micro">LIP JELLY — DROP 01 — SIX MOODS</p><button className="scroll-cue" onClick={() => onJump('belief')} aria-label="Scroll to the belief"><span>SCROLL</span></button></div></section>
}

function LegacyBelief() {
  const ref = useRef<HTMLElement>(null)
  useGSAP(() => { if (!ref.current) return; const ctx = gsap.context(() => { gsap.utils.toArray<HTMLElement>('.belief__word').forEach((word, index) => gsap.fromTo(word, { scaleY: 0.2, opacity: 0.15 }, { scaleY: 1, opacity: 1, ease: 'elastic.out(1, 0.45)', duration: 1.1, scrollTrigger: { trigger: word, start: 'top 82%', end: 'top 35%', scrub: 1 }, delay: index * 0.08 })); gsap.from('.belief__small', { opacity: 0, y: 22, scrollTrigger: { trigger: '.belief__small', start: 'top 88%', end: 'top 68%', scrub: 1 } }) }, ref); return () => ctx.revert() }, { scope: ref })
  return <section id="belief" className="belief section section--tall" ref={ref}><Aura className="aura--belief" /><div className="belief__words"><span className="belief__word belief__word--cherry">soft.</span><span className="belief__word belief__word--lychee">squeezable.</span><span className="belief__word belief__word--mango">yours.</span></div><p className="belief__small">a lip jelly you'll keep squeezing.</p></section>
}

function Squeeze({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLElement>(null); const product = useRef<HTMLDivElement>(null); const [show3D, setShow3D] = useState(true)
  useEffect(() => {
    const section = ref.current
    if (!section) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setShow3D(true); observer.disconnect() }
    }, { rootMargin: '160px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])
  useGSAP(() => { if (!ref.current || !product.current || reduced) return; const ctx = gsap.context(() => { gsap.to(product.current, { scaleX: 1.18, scaleY: 0.84, scrollTrigger: { trigger: ref.current, start: 'top 45%', end: 'bottom 65%', scrub: 1 } }); gsap.from('.squeeze__callout', { y: 18, stagger: 0.18, scrollTrigger: { trigger: ref.current, start: 'top 30%', end: 'center center', scrub: 1 } }) }, ref); return () => ctx.revert() }, { scope: ref, dependencies: [reduced] })
  return <section id="squeeze" className="squeeze section section--squeeze" ref={ref} data-aura="#2FA4A8,#F2EDE4"><Aura /><div className="squeeze__inner"><p className="display squeeze__title">one squeeze.</p><div className="squeeze__product" ref={product}>{show3D ? <Suspense fallback={<img className="product-photo product-photo--squeeze" src="/media/cutouts/mochi-cherry.webp" alt="Cherry lip jelly" loading="lazy" decoding="async" />}><MochiTube3D colour="#B3122E" reducedMotion={reduced} fallbackSrc="/media/cutouts/mochi-cherry.webp" fallbackAlt="Cherry lip jelly" ariaLabel="Interactive cherry MOCHI lip jelly tube" /></Suspense> : <img className="product-photo product-photo--squeeze" src="/media/cutouts/mochi-cherry.webp" alt="Cherry lip jelly" loading="lazy" decoding="async" />}</div><div className="squeeze__callouts"><span className="squeeze__callout">9 ML</span><span className="squeeze__callout">SILICONE TUBE</span><span className="squeeze__callout">JELLY, NOT STICKY</span><span className="squeeze__callout">MILKY CAP</span></div></div></section>
}

function Flavours({ bag, setBag }: { bag: number; setBag: (value: number) => void }) {
  const { flavour, setFlavour } = useFlavour(); const [index, setIndex] = useState(0); const sectionRef = useRef<HTMLElement>(null); const trackRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setFlavour(flavours[index]) }, [index, setFlavour])
  useGSAP(() => {
    if (!sectionRef.current || !trackRef.current) return
    const ctx = gsap.context(() => {
      const tween = gsap.to(trackRef.current, { x: () => -(flavours.length - 1) * window.innerWidth, ease: 'none', scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: () => `+=${flavours.length * 90}%`, scrub: 1, pin: true, snap: 1 / (flavours.length - 1), invalidateOnRefresh: true, onUpdate: self => setIndex(Math.min(flavours.length - 1, Math.round(self.progress * (flavours.length - 1)))) } })
      return () => tween.kill()
    }, sectionRef)
    return () => ctx.revert()
  }, { scope: sectionRef })
  return <section id="flavours" className="flavours section" ref={sectionRef} data-aura="#F2EDE4,#F2EDE4" style={{ '--active-aura': flavour.aura } as React.CSSProperties}><div className="flavours__track" ref={trackRef}>{flavours.map((item, itemIndex) => <article className="flavour-panel" key={item.key} style={{ '--jelly': item.jelly, '--aura': item.aura } as React.CSSProperties}><div className="flavour-panel__aura" /><span className="flavour-panel__label micro">06 FLAVOURS — 9 ML</span><span className="flavour-panel__index micro">{String(itemIndex + 1).padStart(2, '0')}/06</span><span className="flavour-panel__name">{item.name}</span><img className="flavour-panel__image" src={`/media/cutouts/mochi-${item.asset}.webp`} alt={`${item.name} lip jelly`} loading="eager" decoding="async" /><p className="flavour-panel__mood">{item.name.toLowerCase()} — <em>{item.mood}</em></p><button className="add-pill" onClick={() => { setBag(bag + 1); setFlavour(item) }}>+ ADD TO BAG</button></article>)}</div><p className="display flavours__title">six moods.</p><div className="flavour-dots" role="tablist" aria-label="FLAVOURS">{flavours.map((item, dotIndex) => <button role="tab" aria-selected={dotIndex === index} key={item.key} className={dotIndex === index ? 'active' : ''} onClick={() => { setIndex(dotIndex); setFlavour(item) }} aria-label={`${item.name} · ${item.mood}`}>{item.name}</button>)}</div></section>
}

const photoNames = ['mochi-model-1.webp', 'mochi-peach-model.webp', 'mochi-model-4.webp', 'mochi-model-3.webp', 'mochi-model-2.webp', 'mochi-model-5.webp']

function Texture() {
  const photoRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 50, y: 50 })
  const current = useRef({ x: 50, y: 50 })
  const [active, setActive] = useState(false)
  useEffect(() => {
    let frame = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * (reduced ? 1 : 0.12)
      current.current.y += (target.current.y - current.current.y) * (reduced ? 1 : 0.12)
      if (lensRef.current) {
        lensRef.current.style.setProperty('--lens-x', `${current.current.x}%`)
        lensRef.current.style.setProperty('--lens-y', `${current.current.y}%`)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  const moveLens = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    target.current = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }
  }
  return <section id="texture" className="texture section" data-aura="#8FC3E6,#F4A27E" onPointerMove={moveLens} onPointerEnter={() => setActive(true)} onPointerLeave={() => setActive(false)}><div ref={photoRef} className="texture__photo"><img src="/media/photos/mochi-peach-model.webp" alt="MOCHI peach lip jelly in use" loading="eager" fetchPriority="high" decoding="sync" onError={event => { event.currentTarget.style.display = 'none' }} /><div className="texture__fallback" /><div ref={lensRef} className={`texture__lens ${active ? 'texture__lens--active' : ''}`} aria-hidden="true" /><span className="texture__readout micro">2.0× — GLOSS</span></div><p className="texture__line">real lips. <em>real gloss.</em></p></section>
}

function Lookbook({ onOpen }: { onOpen: (src: string, flavour: Flavour) => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll<HTMLElement>('.lookbook__card')
    if (!cards?.length) return
    const timers = new Map<HTMLElement, number>()
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < .58) return
        const card = entry.target as HTMLElement
        card.classList.remove('is-flashing')
        requestAnimationFrame(() => card.classList.add('is-flashing'))
        const timer = timers.get(card)
        if (timer) window.clearTimeout(timer)
        timers.set(card, window.setTimeout(() => {
          card.classList.remove('is-flashing')
          timers.delete(card)
        }, 720))
      })
    }, { threshold: [.58] })
    cards.forEach(card => observer.observe(card))
    return () => {
      observer.disconnect()
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [])
  const moveLight = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--spot-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    event.currentTarget.style.setProperty('--spot-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
    event.currentTarget.style.setProperty('--spot-opacity', '1')
  }
  const clearLight = (event: React.PointerEvent<HTMLButtonElement>) => event.currentTarget.style.setProperty('--spot-opacity', '0')
  return <section id="lookbook" ref={sectionRef} className="lookbook section" data-aura="#F2EDE4,#F6D3D6"><div className="lookbook__head"><p className="display">worn by <em>everyone.</em></p></div><div className="lookbook__grid">{photoNames.map((src, index) => { const item = flavours[index % flavours.length]; return <button className={`lookbook__card lookbook__card--${index + 1}`} key={src} onClick={() => onOpen(`/media/photos/${src}`, item)} onPointerMove={moveLight} onPointerEnter={moveLight} onPointerLeave={clearLight} aria-label={`Open ${item.name} lookbook image`}><div className="lookbook__image" style={{ '--photo-hue': item.jelly } as React.CSSProperties}><img src={`/media/photos/${src}`} alt={`${item.name} lookbook`} loading="eager" decoding="sync" onError={event => { event.currentTarget.style.display = 'none' }} /><span className="lookbook__tag micro">({String(index + 1).padStart(2, '0')}) {item.name} — {item.mood.toUpperCase()}</span></div></button> })}</div></section>
}

function Stand() {
  const [turn, setTurn] = useState(0)
  const spring = useRef(createSpring('heavy'))
  const history = useRef(new PointerHistory())
  const drag = useRef({ active: false, lastX: 0 })
  const frame = useRef(0)

  useEffect(() => {
    let previous = performance.now()
    const tick = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000))
      previous = time
      setTurn(spring.current.step(delta))
      if (drag.current.active || !spring.current.atRest()) frame.current = requestAnimationFrame(tick)
      else frame.current = 0
    }
    const wake = () => {
      if (!frame.current) {
        previous = performance.now()
        frame.current = requestAnimationFrame(tick)
      }
    }
    const scene = document.querySelector<HTMLElement>('#stand .stand__scene')
    scene?.addEventListener('pointermove', wake)
    return () => {
      scene?.removeEventListener('pointermove', wake)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  const boundTurn = (value: number) => value < -35 ? -35 - rubberBand(-35 - value, 35) : value > 35 ? 35 + rubberBand(value - 35, 35) : value
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { active: true, lastX: event.clientX }
    spring.current.setTarget(spring.current.value)
    history.current.reset()
    history.current.add(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const delta = event.clientX - drag.current.lastX
    drag.current.lastX = event.clientX
    history.current.add(event.clientX, event.clientY)
    spring.current.setTarget(boundTurn(spring.current.target + delta * 0.4))
    spring.current.setVelocity(history.current.velocity().x * 0.4)
  }
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    const velocity = history.current.velocity().x * 0.4
    history.current.reset()
    spring.current.setTarget(clamp(projectMomentum(spring.current.value, velocity), -35, 35))
    spring.current.setVelocity(velocity)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <section id="stand" className="stand section" data-aura="#8FC3E6,#F2EDE4"><Aura /><div className="stand__copy"><p className="display">the stand.</p><p>a soft home for all six.</p></div><div className="stand__scene" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} style={{ transform: `rotateY(${turn}deg)` }}><img className="stand__image" src="/media/photos/mochi-blob-stand.webp" alt="MOCHI stand with all six lip jelly shades" loading="eager" fetchPriority="high" decoding="sync" /></div></section>
}

function AllSix({ reduced }: { reduced: boolean }) {
  const [nudged, setNudged] = useState(false)
  return <section id="all-six" className="all-six section" data-aura="#E46A8E,#F2B632"><div className="all-six__copy"><p className="display">all six.</p><p>can't pick? <em>don't.</em></p></div><button className={`pile ${reduced ? 'pile--static' : ''} ${nudged ? 'pile--nudged' : ''}`} onClick={() => setNudged(!nudged)} aria-label="all six MOCHI shades"><img className="pile__image" src="/media/photos/mochi-all-pile.webp" alt="All six MOCHI lip jelly shades" loading="eager" fetchPriority="high" decoding="sync" /></button></section>
}

function Wallpapers({ onOpen }: { onOpen: (index: number) => void }) {
  return <section id="wallpapers" className="wallpapers section" data-aura="#2346B8,#F2EDE4"><p className="display">take the colour home.</p><div className="wallpaper-fan">{flavours.map((item, index) => <article className="wallpaper-card" key={item.key} style={{ '--jelly': item.jelly, '--aura': item.aura, '--i': index } as React.CSSProperties}><button className="wallpaper-card__open" onClick={() => onOpen(index)} aria-label={`Preview ${item.name} wallpaper`}><div className="wallpaper-card__aura" style={{ backgroundImage: `url(/media/cutouts/mochi-${item.asset}-aura.webp)` }} /><span>{wallpaperSize} — {item.name}</span></button><a className="download-pill" href={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`} download>↓ DOWNLOAD {wallpaperSize}</a></article>)}</div></section>
}

function Footer() {
  return <footer className="footer section" data-aura="#2346B8,#B3122E"><Aura /><div className="footer__word" aria-label="MOCHI"><span>M</span><span>O</span><span>C</span><span>H</span><span>I</span></div><p className="footer__signoff"><em>squeeze responsibly.</em></p><p className="footer__credit">Made by J&amp;J Intelligence</p><p className="footer__legal">Studio demo · MOCHI is an invented brand by J&amp;J Intelligence. Not a real product.</p></footer>
}

function WallpaperPreview({ index, onClose, onChange }: { index: number | null; onClose: () => void; onChange: (next: number) => void }) {
  const startX = useRef<number | null>(null)
  useEffect(() => {
    if (index === null) return
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key === 'ArrowRight') onChange((index + 1) % flavours.length); if (event.key === 'ArrowLeft') onChange((index + flavours.length - 1) % flavours.length) }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [index, onChange, onClose])
  if (index === null) return null
  const item = flavours[index]
  return <div className="wallpaper-preview" role="dialog" aria-modal="true" aria-label={`${item.name} wallpaper preview`} onClick={onClose} onPointerDown={event => { startX.current = event.clientX }} onPointerUp={event => { if (startX.current !== null && Math.abs(event.clientX - startX.current) > 42) onChange(event.clientX < startX.current ? (index + 1) % flavours.length : (index + flavours.length - 1) % flavours.length); startX.current = null }}><button className="wallpaper-preview__close" onClick={onClose}>CLOSE</button><button className="wallpaper-preview__arrow wallpaper-preview__arrow--prev" onClick={event => { event.stopPropagation(); onChange((index + flavours.length - 1) % flavours.length) }} aria-label="Previous wallpaper">←</button><img src={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`} alt={`${item.name} MOCHI wallpaper`} /><button className="wallpaper-preview__arrow wallpaper-preview__arrow--next" onClick={event => { event.stopPropagation(); onChange((index + 1) % flavours.length) }} aria-label="Next wallpaper">→</button><a className="wallpaper-preview__download" href={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`} download onClick={event => event.stopPropagation()}>↓ DOWNLOAD {wallpaperSize}</a><span className="wallpaper-preview__label micro">{item.name} · {String(index + 1).padStart(2, '0')} / 06</span></div>
}

function Lightbox({ data, onClose }: { data: { src: string; flavour: Flavour } | null; onClose: () => void }) {
  useEffect(() => { if (!data) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [data, onClose])
  if (!data) return null
  return <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}><Aura /><button onClick={onClose} aria-label="MOCHI">MOCHI</button><img src={data.src} alt={`${data.flavour.name} lip jelly`} decoding="async" onError={event => { event.currentTarget.style.display = 'none' }} /></div>
}

function App() {
  const [loaded, setLoaded] = useState(false); const [bag, setBag] = useState(0); const [reduced, setReduced] = useState(false); const [lightbox, setLightbox] = useState<{ src: string; flavour: Flavour } | null>(null); const [wallpaper, setWallpaper] = useState<number | null>(null); const [flavour, setFlavour] = useState(flavours[0]); const context = useMemo(() => ({ flavour, setFlavour }), [flavour])
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduced(media.matches); const handle = () => setReduced(media.matches); media.addEventListener('change', handle); return () => media.removeEventListener('change', handle) }, [])
  useEffect(() => { document.documentElement.style.setProperty('--jelly', flavour.jelly); document.documentElement.style.setProperty('--aura', flavour.aura) }, [flavour])
  useEffect(() => { if (reduced) return; const lenis = new Lenis({ duration: 1.25, smoothWheel: true, syncTouch: true, wheelMultiplier: .86, touchMultiplier: 1.05 }); const update = (time: number) => lenis.raf(time * 1000); gsap.ticker.add(update); lenis.on('scroll', ScrollTrigger.update); return () => { gsap.ticker.remove(update); lenis.destroy() } }, [reduced])
  useEffect(() => { if (loaded) document.body.classList.add('is-ready') }, [loaded])
  useEffect(() => {
    const blob = document.querySelector<HTMLElement>('.cursor-blob')
    if (!blob || window.matchMedia('(pointer: coarse)').matches) return
    const move = (event: PointerEvent) => { blob.style.left = `${event.clientX}px`; blob.style.top = `${event.clientY}px` }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  return <FlavourContext.Provider value={context}><Preloader done={loaded} onDone={() => setLoaded(true)} /><div className={`app ${reduced ? 'reduced-motion' : ''}`}><GlobalAuraCanvas /><Header bag={bag} onJump={jump} /><main><PhysicsHero onJump={jump} /><PhysicsBelief /><Squeeze reduced={reduced} /><Flavours bag={bag} setBag={setBag} /><Texture /><Lookbook onOpen={(src, item) => setLightbox({ src, flavour: item })} /><Stand /><AllSix reduced={reduced} /><Wallpapers onOpen={setWallpaper} /></main><Footer />{reduced && <p className="reduced-note micro">motion reduced.</p>}<div className="cursor-blob" aria-hidden="true" /></div><Lightbox data={lightbox} onClose={() => setLightbox(null)} /><WallpaperPreview index={wallpaper} onClose={() => setWallpaper(null)} onChange={setWallpaper} /></FlavourContext.Provider>
}

export default App


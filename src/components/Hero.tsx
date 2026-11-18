import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './hero.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type HeroProps = { onJump: (id: string) => void }

export default function Hero({ onJump }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const targetTime = useRef(0)
  const currentTime = useRef(0)
  const duration = useRef(0)
  const rafRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => {
    const video = videoRef.current
    const pin = pinRef.current
    if (!video || !pin) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false
    const render = () => {
      rafRef.current = 0
      if (disposed || !activeRef.current || document.visibilityState === 'hidden') return
      if (duration.current > 0 && Number.isFinite(video.duration)) {
        const distance = targetTime.current - currentTime.current
        currentTime.current += distance * (reduced ? 1 : 0.16)
        if (Math.abs(distance) < 0.012) currentTime.current = targetTime.current
        try { video.currentTime = Math.max(0, Math.min(duration.current - 0.04, currentTime.current)) } catch { /* seek can race metadata */ }
      }
      if (Math.abs(targetTime.current - currentTime.current) > 0.012) rafRef.current = requestAnimationFrame(render)
    }
    const startRender = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(render) }
    const onMetadata = () => {
      duration.current = Number.isFinite(video.duration) ? video.duration : 0
      currentTime.current = 0
      targetTime.current = 0
      video.currentTime = 0
      pin.classList.add('is-ready')
      startRender()
    }
    const onVisibility = () => {
      activeRef.current = document.visibilityState !== 'hidden'
      if (activeRef.current) startRender()
    }
    const observer = new IntersectionObserver(([entry]) => {
      activeRef.current = entry.isIntersecting
      if (activeRef.current) startRender()
    }, { threshold: 0 })
    video.addEventListener('loadedmetadata', onMetadata)
    document.addEventListener('visibilitychange', onVisibility)
    observer.observe(pin)
    if (video.readyState >= 1) onMetadata()
    return () => {
      disposed = true
      observer.disconnect()
      video.removeEventListener('loadedmetadata', onMetadata)
      document.removeEventListener('visibilitychange', onVisibility)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useGSAP(() => {
    const hero = heroRef.current
    const pin = pinRef.current
    if (!hero || !pin) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderFrame = () => {
      rafRef.current = 0
      const video = videoRef.current
      if (!video || duration.current <= 0) return
      const distance = targetTime.current - currentTime.current
      currentTime.current += distance * (reduced ? 1 : 0.16)
      try { video.currentTime = Math.max(0, Math.min(duration.current - 0.04, currentTime.current)) } catch { /* seek can race metadata */ }
      if (Math.abs(distance) > 0.012) rafRef.current = requestAnimationFrame(renderFrame)
    }
    const trigger = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => `+=${window.innerHeight * (window.matchMedia('(max-width: 700px)').matches ? 1.55 : 2.15)}`,
      pin,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: self => {
        const progress = self.progress
        if (duration.current > 0) {
          targetTime.current = progress * Math.max(0, duration.current - 0.04)
          if (reduced) currentTime.current = targetTime.current
          if (!rafRef.current) rafRef.current = requestAnimationFrame(renderFrame)
        }
        pin.style.setProperty('--hero-progress', progress.toFixed(4))
        pin.style.setProperty('--hero-headline-progress', Math.min(1, Math.max(0, (progress - 0.04) * 7)).toFixed(4))
      },
    })
    return () => trigger.kill()
  }, { scope: heroRef })

  return (
    <section id="hero" className="mochi-hero" ref={heroRef} data-aura="#F2EDE4,#F6D3D6">
      <div className="mochi-hero__pin" ref={pinRef} style={{ '--hero-progress': 0, '--hero-headline-progress': 0 } as React.CSSProperties}>
        <video ref={videoRef} className="mochi-hero__video" src="/media/video/hero-six.mp4" poster="/media/hero-seq-v4/poster.webp" muted playsInline preload="metadata" aria-label="MOCHI lip jelly Wave" />
        <div className="mochi-hero__grade" aria-hidden="true" />
        <div className="mochi-hero__headline" aria-hidden="true"><span>soft is</span> <em>a choice.</em></div>
        <p className="mochi-hero__mono">LIP JELLY — DROP 01 — SIX MOODS</p>
        <button type="button" className="mochi-hero__scroll-cue" onClick={() => onJump('belief')} aria-label="Scroll to the belief"><span>SCROLL</span></button>
      </div>
    </section>
  )
}

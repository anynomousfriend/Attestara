import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Cursor }           from "./components/Cursor";
import { Navbar }           from "./components/Navbar";
import { Hero }             from "./sections/Hero";
import { MetricsStrip }     from "./sections/MetricsStrip";
import { ArchitectureFlow } from "./sections/ArchitectureFlow";
import { PrivacyModel }     from "./sections/PrivacyModel";
import { TenderlySection }  from "./sections/TenderlySection";
import { AdversarialGrid }  from "./sections/AdversarialGrid";
import { DemoPreview }      from "./sections/DemoPreview";
import { FooterCTA }        from "./sections/FooterCTA";

gsap.registerPlugin(ScrollTrigger);

export function LandingPage() {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Smooth scroll
  useEffect(() => {
    const wrap    = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      wrap.style.position = "static";
      content.style.position = "static";
      return;
    }

    let target  = 0;
    let current = 0;
    let raf: number;

    const setHeight = () => {
      document.body.style.height = content.getBoundingClientRect().height + "px";
    };

    const onScroll  = () => { target = window.scrollY; };
    const onResize  = () => setHeight();

    window.addEventListener("scroll",  onScroll,  { passive: true });
    window.addEventListener("resize",  onResize);
    document.fonts.ready.then(setHeight);
    setHeight();

    ScrollTrigger.scrollerProxy(wrap, {
      scrollTop(value?: number) {
        if (value !== undefined) { target = value; current = value; }
        return target;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
    });

    const tick = () => {
      current += (target - current) * 0.1;
      if (Math.abs(target - current) > 0.1) {
        content.style.transform = `translate3d(0, ${-current}px, 0)`;
        ScrollTrigger.update();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Ambient gradient drift
    gsap.to(".amb-tr", { y: 50, x: -50, duration: 20, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".amb-bl", { y: -50, x: 50, duration: 25, repeat: -1, yoyo: true, ease: "sine.inOut" });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Fixed ambient + noise */}
      <div className="ambient amb-tr" />
      <div className="ambient amb-bl" />
      <svg className="noise-overlay" xmlns="http://www.w3.org/2000/svg">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      <Cursor />
      <Navbar />

      {/* Smooth scroll container */}
      <div id="smooth-wrapper" ref={wrapRef}>
        <div id="smooth-content" ref={contentRef}>
          <Hero />
          <MetricsStrip />
          <ArchitectureFlow />
          <hr className="section-divider" />
          <PrivacyModel />
          <hr className="section-divider" />
          <TenderlySection />
          <hr className="section-divider" />
          <AdversarialGrid />
          <hr className="section-divider" />
          <DemoPreview />
          <FooterCTA />
        </div>
      </div>
    </>
  );
}

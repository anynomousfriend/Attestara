import { useEffect, useRef } from "react";
import gsap from "gsap";

function splitChars(text: string, isLiability = false): React.ReactNode[] {
  const words = text.split(" ");
  const nodes: React.ReactNode[] = [];
  words.forEach((word, wi) => {
    if (isLiability && word === "liability.") {
      nodes.push(
        <span key={wi} className="liability-wrapper">
          {word.split("").map((ch, ci) => (
            <span key={ci} className="char-span">{ch}</span>
          ))}
          <div className="liability-underline" id="l-underline" />
        </span>
      );
    } else {
      nodes.push(
        <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {word.split("").map((ch, ci) => (
            <span key={ci} className="char-span">{ch}</span>
          ))}
        </span>
      );
    }
    if (wi < words.length - 1) nodes.push(" ");
  });
  return nodes;
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.from("#hero-badge",          { opacity: 0, y: 20, duration: 0.8, ease: "power3.out" }, 0.2)
      .to(".line-1 .char-span",     { opacity: 1, y: 0, rotateX: 0, stagger: 0.02, duration: 0.9, ease: "power4.out" }, 0.4)
      .to(".line-2 .char-span",     { opacity: 1, y: 0, rotateX: 0, stagger: 0.02, duration: 0.9, ease: "power4.out" }, 0.7)
      .to("#hero-sub",              { opacity: 1, y: 0, duration: 0.8 }, 1.0)
      .to("#l-underline",           { scaleX: 1, duration: 0.8, ease: "power3.out" }, 1.2)
      .fromTo("#hero-ctas",         { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 1.3);

    gsap.to("#scroll-ind svg", { y: 8, duration: 1, repeat: -1, yoyo: true, ease: "power1.inOut" });
  }, []);

  return (
    <section className="hero" ref={sectionRef}>
      <div className="eyebrow" id="hero-badge">
        <div className="eyebrow-dot" />
        ZERO-KNOWLEDGE COMPLIANCE PROXY
      </div>

      <h1 style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 900 }}>
        <span className="hero-title-line line-1">
          {splitChars("Institutional DeFi,")}
        </span>
        <span className="hero-title-line line-2">
          {splitChars("without the liability.", true)}
        </span>
      </h1>

      <p className="hero-sub" id="hero-sub">
        Attestara is a CRE-powered compliance middleware that screens every deposit against
        real-world AML providers, signs cryptographic attestations, and settles on-chain —
        with zero personal data on the ledger.
      </p>

      <div className="hero-ctas" id="hero-ctas">
        <a href="http://localhost:3001" className="btn-primary interactive" style={{ textDecoration: "none" }}>Launch App →</a>
        <a href="https://github.com" className="btn-secondary interactive" style={{ textDecoration: "none" }}>Read Docs</a>
      </div>

      <div className="scroll-ind" id="scroll-ind">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}

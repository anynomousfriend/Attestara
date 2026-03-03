import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>,
    title: "State Manipulation",
    desc: "tenderly_setBalance, evm_increaseTime — we control time and money for adversarial testing.",
  },
  {
    icon: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></>,
    title: "Transaction Simulation",
    desc: "Dry-run every deposit before committing. Decoded reverts, gas estimates, state diffs.",
  },
  {
    icon: <path d="M3 2v6h6M21 12A9 9 0 006 5.3L3 8M21 22v-6h-6M3 12a9 9 0 0015 6.7l3-2.7"/>,
    title: "Execution Replay",
    desc: "Fork at any historical block. Re-run compliance checks against past state conditions.",
  },
];

export function TenderlySection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: ref.current, start: "top 60%" },
    });
    tl.to(".tl-fork",      { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" })
      .from(".fork-pt",    { scale: 0, opacity: 0, duration: 0.5 }, "-=1")
      .from(".feat-card",  { y: 60, opacity: 0, stagger: 0.2, duration: 0.8, ease: "power3.out" }, "-=0.5");
  }, []);

  return (
    <section ref={ref} style={{ padding: "var(--pad-y) var(--pad-x)" }}>
      <div className="tenderly-section">
        <span className="section-label">INFRASTRUCTURE</span>
        <h2 className="tenderly-heading">Mainnet fidelity. Sandbox safety.</h2>
        <p className="tenderly-sub">
          Attestara runs on a Tenderly Virtual TestNet fork of Ethereum mainnet — real USDC,
          real contract state, real gas costs. No testnet tokens. No pretending.
        </p>

        {/* Fork timeline */}
        <div className="timeline-viz">
          <svg className="tl-svg" preserveAspectRatio="none">
            <line x1="0" y1="50%" x2="50%" y2="50%" className="tl-main" />
            <path
              d="M 50% 50% Q 60% 50% 70% 80% T 100% 80%"
              className="tl-fork"
            />
          </svg>
          <div className="fork-pt" />
          <div className="tl-label tl-main-label">
            <div>Ethereum Mainnet</div>
            <div>Block #19,284,501</div>
            <div>Real USDC at 0xA0b8…</div>
          </div>
          <div className="tl-label tl-fork-label">
            <div style={{ color: "var(--gold)" }}>Attestara TestNet</div>
            <div>Your contracts deployed here</div>
            <div>Same USDC, your rules</div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 24 24">{f.icon}</svg>
              </div>
              <h3 className="feat-title">{f.title}</h3>
              <p className="feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

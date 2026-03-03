import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const CARDS = [
  {
    col: 0, size: "tall",
    name: "Sanctioned Entity",
    desc: "Attempt deposit from an OFAC-listed address. CRE identifies flag off-chain and refuses to sign attestation.",
    revert: "Attestation__InvalidSignature()",
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  },
  {
    col: 1, size: "short",
    name: "Replay Attack",
    desc: "Attacker intercepts valid attestation and re-uses it for a second deposit.",
    revert: "Attestation__NonceUsed(42)",
    icon: <><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/><path d="M16 3h5v5M10 14L21 3"/></>,
  },
  {
    col: 1, size: "medium",
    name: "Missing DID",
    desc: "Attempt deposit with valid funds but no registered Identity Profile.",
    revert: "Vault__DIDNotRegistered(addr)",
    icon: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  },
  {
    col: 2, size: "medium",
    name: "Expired TTL",
    desc: "Valid attestation is held and submitted after the 15-minute compliance window closes.",
    revert: "Attestation__Expired(1718...)",
    icon: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  },
  {
    col: 2, size: "short",
    name: "Vault Paused",
    desc: "Emergency circuit breaker triggered by admin. All interactions halt regardless of compliance.",
    revert: "Vault__Paused()",
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  },
];

export function AdversarialGrid() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.timeline({
      scrollTrigger: { trigger: ref.current, start: "top 40%" },
    }).from(".adv-card", {
      rotateY: -15, rotateX: 5, opacity: 0, z: -100,
      stagger: 0.12, duration: 0.8, ease: "power3.out",
      onComplete() {
        gsap.to(".adv-defended", { opacity: 1, duration: 0.4 });
      },
    });
  }, []);

  const cols: (typeof CARDS)[] = [[], [], []];
  CARDS.forEach(c => cols[c.col].push(c));

  return (
    <section className="adv-section" ref={ref} style={{ padding: "var(--pad-y) var(--pad-x)" }}>
      <span className="section-label">SECURITY</span>
      <h2 className="privacy-heading">Five attacks. Five defenses.<br />Zero compromises.</h2>
      <p className="tenderly-sub" style={{ margin: "16px 0 0", maxWidth: 500 }}>
        Every security property is demonstrated live. Click a scenario, watch the system defend itself in real-time.
      </p>

      <div className="adv-grid">
        {cols.map((col, ci) => (
          <div key={ci} className={`adv-col adv-col-${ci + 1}`}>
            {col.map((card, i) => (
              <div key={i} className={`adv-card ${card.size} interactive`}>
                <svg className="adv-bg-icon" viewBox="0 0 24 24">{card.icon}</svg>
                <div className="adv-name">{card.name}</div>
                <div className="adv-desc">{card.desc}</div>
                <div className="adv-revert">{card.revert}</div>
                <div className="adv-defended">DEFENDED ✓</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

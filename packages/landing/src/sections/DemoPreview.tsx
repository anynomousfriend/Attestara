import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { id: "ms-1", label: "Initiating Deposit Intent..." },
  { id: "ms-2", label: "Querying AML Provider (Off-chain)" },
  { id: "ms-3", label: "Generating EIP-712 Signature" },
  { id: "ms-4", label: "Broadcasting TX to Vault" },
  { id: "ms-5", label: "Transaction Settled", settled: true },
];

export function DemoPreview() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: ref.current, start: "top 60%" },
    });

    tl.from("#demo-browser", { scale: 0.85, opacity: 0, y: 60, duration: 1, ease: "power3.out" })
      .to(".win-dot", { scale: 1, stagger: 0.05, duration: 0.4, ease: "back.out(2)" });

    // Step walk-through
    for (let i = 0; i < STEPS.length - 1; i++) {
      const cur  = `#${STEPS[i].id}`;
      const next = `#${STEPS[i + 1].id}`;
      tl.to(`${cur} .mock-circle`, { background: "transparent" }, `+=1`)
        .to(cur, { opacity: 0.5, color: "" }, "<")
        .to(next, { opacity: 1, color: "var(--gold)" }, "<")
        .to(`${next} .mock-circle`, { background: "currentColor" }, "<");
    }
    // Final step — success green
    tl.to("#ms-5", { color: "var(--success)" }, "+=1");
  }, []);

  return (
    <section className="demo-section" ref={ref} style={{ padding: "var(--pad-y) var(--pad-x)" }}>
      <h2 className="privacy-heading">One flow. Complete compliance.</h2>
      <p className="tenderly-sub" style={{ margin: "16px auto 0" }}>
        Watch a deposit go from intent to settlement in under 10 seconds.
      </p>

      <div className="browser-mockup" id="demo-browser">
        {/* Top bar */}
        <div className="browser-topbar">
          <div className="win-dots">
            <div className="win-dot r" />
            <div className="win-dot y" />
            <div className="win-dot g" />
          </div>
          <div className="url-bar">localhost:3000</div>
        </div>

        {/* Mock UI */}
        <div className="browser-content">
          <div className="mock-ui">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                id={s.id}
                className={`mock-step${i === 0 ? " active" : ""}`}
                style={s.settled ? { color: "var(--success)" } : undefined}
              >
                <div
                  className="mock-circle"
                  style={s.settled ? { borderColor: "var(--success)", background: "var(--success)" } : undefined}
                />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="demo-caption">
        Dashboard → AML Screen → EIP-712 Attestation → Vault Deposit → Settled
      </div>
    </section>
  );
}

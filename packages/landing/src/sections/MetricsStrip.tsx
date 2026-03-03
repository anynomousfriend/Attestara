import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function MetricsStrip() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ScrollTrigger.create({
      trigger: ref.current,
      start: "top 80%",
      once: true,
      onEnter: () => {
        // Counter: < 3s
        const obj1 = { val: 0 };
        gsap.to(obj1, {
          val: 3, duration: 1.2, ease: "power2.out",
          onUpdate() {
            const el = document.getElementById("m-speed");
            if (el) el.textContent = `< ${Math.floor(obj1.val)}s`;
          },
        });
        // Counter: 15 min
        const obj2 = { val: 0 };
        gsap.to(obj2, {
          val: 15, duration: 1.2, ease: "power2.out",
          onUpdate() {
            const el = document.getElementById("m-ttl");
            if (el) el.textContent = `${Math.floor(obj2.val)} min`;
          },
        });
        // Zero scale-in
        gsap.fromTo("#m-zero", { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.7)" });
        // Typewriter: EIP-712
        const twEl = document.getElementById("m-standard");
        if (twEl) {
          const text = "EIP-712";
          twEl.textContent = "";
          let i = 0;
          const iv = setInterval(() => {
            twEl.textContent += text[i++];
            if (i === text.length) clearInterval(iv);
          }, 100);
        }
      },
    });
  }, []);

  return (
    <div className="metrics-strip" ref={ref}>
      <div className="metric-cell">
        <div className="metric-value" id="m-speed">0s</div>
        <div className="metric-label">Average screening time</div>
      </div>
      <div className="metric-cell">
        <div className="metric-value" id="m-zero">0 bytes</div>
        <div className="metric-label">PII on-chain</div>
      </div>
      <div className="metric-cell">
        <div className="metric-value" id="m-standard">EIP-712</div>
        <div className="metric-label">Cryptographic attestation standard</div>
      </div>
      <div className="metric-cell">
        <div className="metric-value" id="m-ttl">0 min</div>
        <div className="metric-label">Attestation TTL</div>
      </div>
    </div>
  );
}

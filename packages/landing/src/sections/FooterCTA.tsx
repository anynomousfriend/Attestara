import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

function splitWords(text: string) {
  return text.split(" ").map((word, i) => (
    <span key={i} className="word-span">{word}{" "}</span>
  ));
}

export function FooterCTA() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.to(".word-span", {
      scrollTrigger: { trigger: ref.current, start: "top 70%" },
      opacity: 1, y: 0, filter: "blur(0px)",
      stagger: 0.06, duration: 0.8, ease: "power2.out",
    });
  }, []);

  return (
    <footer className="footer-cta" ref={ref}>
      <h2 className="final-heading">
        {splitWords("Compliance should be invisible.")}
      </h2>
      <p className="final-sub">
        Deploy Attestara as your compliance middleware. No protocol changes. No PII exposure. No compromises.
      </p>
      <a href="http://localhost:3001" className="btn-primary interactive" style={{ marginTop: 48, textDecoration: "none" }}>
        Launch App →
      </a>

      <div className="footer-bottom">
        <div className="nav-logo" style={{ fontSize: 18 }}>Attestara</div>
        <div className="footer-links">
          <a href="#" className="interactive">GitHub</a> ·{" "}
          <a href="#" className="interactive">Docs</a> ·{" "}
          <a href="#" className="interactive">API Reference</a>
        </div>
        <div>© 2026 Attestara. Built for the Chainlink Convergence Hackathon.</div>
      </div>
    </footer>
  );
}

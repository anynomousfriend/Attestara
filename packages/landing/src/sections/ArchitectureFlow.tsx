import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const NODES = [
  { cls: "node-1", title: "Institution", desc: "Initiates deposit",   badge: null,      badgeCls: "",
    icon: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/> },
  { cls: "node-2", title: "CRE Engine",  desc: "Intercepts intent",   badge: null,      badgeCls: "",
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/> },
  { cls: "node-3", title: "AML Provider",desc: "Off-chain check",     badge: "CLEARED ✓", badgeCls: "badge-cleared bc-3",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></> },
  { cls: "node-4", title: "Attestation", desc: "EIP-712 signed",      badge: null,      badgeCls: "",
    icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></> },
  { cls: "node-5", title: "Vault",       desc: "On-chain accept",     badge: "SETTLED",   badgeCls: "badge-settled bs-5",
    icon: <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></> },
];

export function ArchitectureFlow() {
  const secRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: secRef.current,
        start: "center center",
        end: "+=200%",
        pin: true,
        scrub: 1,
      },
    });

    const pl = document.querySelector<SVGLineElement>(".pl-anim");
    if (pl) {
      pl.style.strokeDasharray = "1000";
      pl.style.strokeDashoffset = "1000";
    }

    tl.to(".node-1", { opacity: 1, scale: 1, duration: 1 })
      .to(".pr-1",   { opacity: 1, scale: 2, duration: 0.5 }, "-=0.5")
      .to(".pr-1",   { opacity: 0, duration: 0.5 })
      // node 2
      .to(".pl-anim",       { strokeDashoffset: 750, duration: 1 })
      .to(".arch-particle", { opacity: 1, left: "25%", duration: 1 }, "-=1")
      .to(".node-2",        { opacity: 1, scale: 1, duration: 1 })
      // node 3
      .to(".pl-anim",       { strokeDashoffset: 500, duration: 1 })
      .to(".arch-particle", { left: "50%", duration: 1 }, "-=1")
      .to(".node-3",        { opacity: 1, scale: 1, duration: 1 })
      .to(".bc-3",          { opacity: 1, duration: 0.5 })
      // node 4
      .to(".pl-anim",       { strokeDashoffset: 250, duration: 1 })
      .to(".arch-particle", { left: "75%", duration: 1 }, "-=1")
      .to(".node-4",        { opacity: 1, scale: 1, duration: 1 })
      .to(".sh-4",          { x: "100%", duration: 1 })
      // node 5
      .to(".pl-anim",       { strokeDashoffset: 0, duration: 1 })
      .to(".arch-particle", { left: "100%", duration: 1 }, "-=1")
      .to(".node-5",        { opacity: 1, scale: 1, duration: 1 })
      .to(".bs-5",          { opacity: 1, duration: 0.5 })
      .to(".arch-particle", { opacity: 0, duration: 0.2 })
      .to(".pl-anim",       { opacity: 0.2, duration: 0.5 });
  }, []);

  return (
    <section className="arch-section" ref={secRef} id="arch-section">
      <span className="section-label">HOW IT WORKS</span>
      <h2 className="arch-heading">From deposit intent to on-chain settlement.</h2>

      <div className="pipeline-wrap">
        {/* SVG connecting lines */}
        <div className="pipeline-lines">
          <svg className="pl-svg" preserveAspectRatio="none">
            <line x1="0" y1="50%" x2="100%" y2="50%" className="pl-base" />
            <line x1="0" y1="50%" x2="0"    y2="50%" className="pl-anim" />
          </svg>
        </div>

        {/* Traveling particle */}
        <div className="arch-particle" />

        {NODES.map((n, i) => (
          <div key={i} className={`arch-node ${n.cls}`}>
            {i === 0 && <div className="pulse-ring pr-1" />}
            {n.badge && <div className={n.badgeCls}>{n.badge}</div>}
            {n.cls === "node-4" && <div className="shimmer sh-4" />}
            <svg className="node-icon" viewBox="0 0 24 24">{n.icon}</svg>
            <div className="node-title">{n.title}</div>
            <div className="node-desc">{n.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

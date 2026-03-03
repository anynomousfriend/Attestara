import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom Cursor state
  useEffect(() => {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;
    
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    
    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    
    document.addEventListener('mousemove', onMouseMove);
    
    const render = () => {
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;
      gsap.set(cursor, { x: cursorX, y: cursorY });
      requestAnimationFrame(render);
    };
    render();
    
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  useGSAP(() => {
    // Hero Animations
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    tl.from('.hero-badge', { opacity: 0, y: 20, duration: 0.8 }, 0.2)
      .from('.hero-word-1', { opacity: 0, y: 40, rotateX: -45, stagger: 0.05, duration: 0.9, ease: 'power4.out' }, 0.4)
      .from('.hero-word-2', { opacity: 0, y: 40, rotateX: -45, stagger: 0.05, duration: 0.9, ease: 'power4.out' }, 0.7)
      .from('.liability-underline', { scaleX: 0, transformOrigin: 'left', duration: 0.8 }, 1.2)
      .from('.hero-sub', { opacity: 0, y: 24, duration: 0.8 }, 1.0)
      .from('.hero-btn-group', { opacity: 0, y: 16, stagger: 0.1, duration: 0.6 }, 1.3);

    gsap.to('.hero-chevron', { y: 8, duration: 1, repeat: -1, yoyo: true, ease: 'power1.inOut' });

    // Navbar scroll
    ScrollTrigger.create({
      start: 'top -100',
      onEnter: () => gsap.to('.fixed-nav', { opacity: 1, y: 0, duration: 0.3 }),
      onLeaveBack: () => gsap.to('.fixed-nav', { opacity: 0, y: -20, duration: 0.3 })
    });

    // Metrics Strip
    const metrics = gsap.utils.toArray('.metric-val');
    metrics.forEach((m: any) => {
      ScrollTrigger.create({
        trigger: '.metrics-strip',
        start: 'top 80%',
        onEnter: () => {
          gsap.from(m, { textContent: 0, duration: 1.2, ease: "power2.out", snap: { textContent: 1 } });
          // Note: textContent animation with standard GSAP just interpolates numbers if it can
        }
      });
    });

    // Architecture Pinned Sequence
    const archTl = gsap.timeline({
      scrollTrigger: {
        trigger: '.arch-section',
        pin: true,
        start: 'top top',
        end: '+=200%',
        scrub: 1
      }
    });

    archTl.from('.arch-node-1', { scale: 0.8, opacity: 0, duration: 1 })
          .from('.arch-line-1', { strokeDashoffset: 100, duration: 1 }, "-=0.5")
          .from('.arch-node-2', { scale: 0.8, opacity: 0, duration: 1 })
          .from('.arch-line-2', { strokeDashoffset: 100, duration: 1 }, "-=0.5")
          .from('.arch-node-3', { scale: 0.8, opacity: 0, duration: 1 })
          .from('.arch-line-3', { strokeDashoffset: 100, duration: 1 }, "-=0.5")
          .from('.arch-node-4', { scale: 0.8, opacity: 0, duration: 1 })
          .from('.arch-line-4', { strokeDashoffset: 100, duration: 1 }, "-=0.5")
          .from('.arch-node-5', { scale: 0.8, opacity: 0, duration: 1 });

    // Privacy Model
    const privTl = gsap.timeline({
      scrollTrigger: { trigger: '.privacy-section', start: 'top 60%' }
    });
    privTl.from('.priv-text', { x: -30, opacity: 0, stagger: 0.15, duration: 0.8 })
          .from('.priv-box-1', { x: 40, opacity: 0, duration: 0.8 }, "-=0.4")
          .from('.priv-box-2', { y: 40, opacity: 0, duration: 0.8 }, "-=0.4")
          .to('.priv-blur', { filter: 'blur(8px)', duration: 0.5 }, "+=0.2");

    // Tenderly Section
    gsap.from('.tend-card', {
      scrollTrigger: { trigger: '.tenderly-section', start: 'top 70%' },
      y: 60, opacity: 0, stagger: 0.2, duration: 0.8, ease: 'power3.out'
    });

    // Security Section
    gsap.from('.sec-card', {
      scrollTrigger: { trigger: '.security-section', start: 'top 70%' },
      rotateY: -15, rotateX: 5, z: -100, opacity: 0,
      stagger: 0.12, duration: 0.8, ease: 'power3.out'
    });

    // Demo Section
    gsap.from('.demo-window', {
      scrollTrigger: { trigger: '.demo-section', start: 'top 60%' },
      scale: 0.85, opacity: 0, y: 60, duration: 1, ease: 'power3.out'
    });

    // Ambient Gradients
    gsap.to('.ambient-blob-1', { y: 100, x: -50, duration: 20, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.ambient-blob-2', { y: -100, x: 50, duration: 20, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="bg-[#0a0c10] text-gray-100 min-h-screen relative overflow-x-hidden selection:bg-[#F5C45E]/30 selection:text-[#F5C45E] font-sans">
      
      {/* Noise Overlay */}
      <svg className="fixed inset-0 w-full h-full opacity-[0.03] pointer-events-none z-50">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Custom Cursor */}
      <div id="custom-cursor" className="hidden lg:block fixed w-2 h-2 border border-[#F5C45E]/40 rounded-full pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-150" />

      {/* Ambient Gradients */}
      <div className="ambient-blob-1 fixed top-0 right-0 w-[800px] h-[800px] rounded-full bg-[#F5C45E]/[0.04] blur-[120px] pointer-events-none" />
      <div className="ambient-blob-2 fixed bottom-0 left-0 w-[800px] h-[800px] rounded-full bg-[#4C1D95]/[0.04] blur-[120px] pointer-events-none" />

      {/* Scroll-Linked Navbar */}
      <nav className="fixed-nav fixed top-0 w-full h-14 z-[90] backdrop-blur-md bg-[#0a0c10]/80 border-b border-[#1c1f26] flex items-center justify-between px-10 opacity-0 -translate-y-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#f5c45e]/15 border border-[#f5c45e]/30">
            <span className="text-[#f5c45e] text-xs font-bold">Ψ</span>
          </div>
          <span className="font-bold text-sm text-white">Attestara</span>
        </div>
        <button onClick={() => navigate('/app')} className="px-4 py-1.5 rounded-lg bg-[#F5C45E] text-[#0a0c10] font-semibold text-xs hover:shadow-[0_0_20px_rgba(245,196,94,0.3)] transition-all">
          Launch App
        </button>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="min-h-screen flex flex-col items-center justify-center px-8 py-[140px] relative">
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F5C45E]/20 bg-[#F5C45E]/[0.06] font-mono text-[12px] tracking-[0.15em] uppercase text-[#F5C45E]/70 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F5C45E] animate-pulse" />
          Zero-Knowledge Compliance Proxy
        </div>

        <h1 className="text-center max-w-[900px]">
          <div className="font-serif text-[clamp(48px,7vw,96px)] text-[#f2f4f7] font-normal leading-[1.05] tracking-[-0.03em] flex flex-wrap justify-center overflow-hidden">
            {"Institutional DeFi,".split(' ').map((word, i) => (
              <span key={i} className="hero-word-1 mr-4">{word}</span>
            ))}
          </div>
          <div className="font-serif text-[clamp(48px,7vw,96px)] text-[#f2f4f7] font-normal leading-[1.05] tracking-[-0.03em] flex flex-wrap justify-center relative mt-2 overflow-hidden">
            {"without the ".split(' ').map((word, i) => (
              <span key={i} className="hero-word-2 mr-4">{word}</span>
            ))}
            <span className="relative inline-block hero-word-2">
              liability.
              <div className="liability-underline absolute bottom-2 left-0 w-full h-[2px] bg-[#F5C45E]" />
            </span>
          </div>
        </h1>

        <p className="hero-sub font-sans text-[18px] leading-[1.7] text-[#818b98] max-w-[560px] text-center mt-7">
          Attestara is a CRE-powered compliance middleware that screens every deposit against real-world AML providers, signs cryptographic attestations, and settles on-chain — with zero personal data on the ledger.
        </p>

        <div className="flex gap-4 items-center mt-12 hero-btn-group">
          <button onClick={() => navigate('/app')} className="px-9 py-3.5 rounded-2xl bg-[#F5C45E] text-[#0a0c10] font-semibold text-[15px] hover:shadow-[0_0_40px_rgba(245,196,94,0.3)] hover:-translate-y-[1px] transition-all duration-300">
            Launch App →
          </button>
          <button className="px-9 py-3.5 rounded-2xl border border-[#1c1f26] bg-transparent text-[#818b98] font-medium hover:border-[#272b36] hover:text-[#d0d6e0] transition-colors">
            Read Docs
          </button>
        </div>

        <div className="hero-chevron absolute bottom-10 opacity-30">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </section>

      {/* Section Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1c1f26] to-transparent" />

      {/* ── Section 2: Metrics Strip ── */}
      <section className="metrics-strip py-8 px-8 md:px-20 border-y border-[#1c1f26] grid grid-cols-2 md:grid-cols-4 gap-y-8">
        {[
          { v: "< 3s", l: "Average screening time" },
          { v: "0 bytes", l: "PII on-chain" },
          { v: "EIP-712", l: "Cryptographic attestation" },
          { v: "15 min", l: "Attestation TTL" }
        ].map((m, i) => (
          <div key={i} className={`flex flex-col items-center justify-center text-center ${i !== 3 ? 'md:border-r border-[#1c1f26]' : ''}`}>
            <div className="metric-val font-serif text-4xl text-[#F5C45E]">{m.v}</div>
            <div className="font-sans text-[13px] text-[#6b7280] mt-1 tracking-wider uppercase">{m.l}</div>
          </div>
        ))}
      </section>

      {/* ── Section 3: Architecture Flow ── */}
      <section className="arch-section min-h-screen flex flex-col items-center justify-center py-[140px] px-8">
        <div className="text-center mb-20">
          <div className="font-mono text-[12px] tracking-[0.2em] uppercase text-[#F5C45E]/50 mb-5">HOW IT WORKS</div>
          <h2 className="font-serif text-[clamp(32px,4.5vw,56px)] text-[#f2f4f7] max-w-[700px] leading-tight">From deposit intent to on-chain settlement.</h2>
        </div>

        <div className="relative w-full max-w-[1000px] flex flex-col md:flex-row items-center justify-between gap-4">
          {['Institution', 'CRE Engine', 'AML Provider', 'Attestation', 'Vault'].map((node, i) => (
            <div key={i} className={`arch-node-${i+1} w-[160px] md:w-[200px] p-6 rounded-2xl bg-[#0e1015] border border-[#1c1f26] flex flex-col items-center text-center relative z-10`}>
              <div className="w-10 h-10 rounded-full border border-[#F5C45E]/30 flex items-center justify-center mb-3 text-[#F5C45E]">0{i+1}</div>
              <div className="text-sm font-semibold text-white">{node}</div>
            </div>
          ))}
          {/* Mock lines for simplified visual */}
          <div className="absolute top-1/2 left-[10%] right-[10%] h-[2px] bg-[#1c1f26] -translate-y-1/2 -z-0 hidden md:block" />
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1c1f26] to-transparent" />

      {/* ── Section 4: Privacy Model ── */}
      <section className="privacy-section py-[140px] px-8 md:px-20 grid grid-cols-1 md:grid-cols-2 gap-20 items-center max-w-[1200px] mx-auto">
        <div>
          <div className="font-mono text-[12px] tracking-[0.2em] uppercase text-[#F5C45E]/50 mb-5">PRIVACY MODEL</div>
          <h2 className="font-serif text-[clamp(28px,3.5vw,44px)] text-[#f2f4f7] mb-8 leading-tight">The AML report never touches the chain.</h2>
          <div className="space-y-4 text-[15px] text-[#818b98] leading-relaxed">
            <p className="priv-text">The CRE queries the AML provider off-chain. The full report (name, alerts, risk score) stays in the CRE's secure memory enclave.</p>
            <p className="priv-text">The CRE computes <code className="font-mono text-[#F5C45E]/80 text-sm">keccak256(reportJSON)</code> and includes only this hash in the cryptographic attestation.</p>
            <p className="priv-text">The smart contract verifies the CRE's signature. It never sees, stores, or emits any personal data.</p>
          </div>
          <div className="priv-text mt-8 p-5 border-l-2 border-[#F5C45E] bg-[#F5C45E]/[0.03] font-mono text-[13px] text-[#d0d6e0]">
            0 bytes of PII on-chain. Ever.
          </div>
        </div>

        <div className="relative flex flex-col gap-6">
          <div className="priv-box-1 p-6 rounded-2xl bg-[#0e1015] border border-[#1c1f26] relative">
            <div className="absolute top-4 right-4 text-[10px] font-mono font-bold px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">PRIVATE</div>
            <div className="text-xs text-[#818b98] mb-3 font-mono">Off-Chain (CRE Memory)</div>
            <pre className="font-mono text-[12px] text-[#d0d6e0] overflow-hidden">
{`{
  "subject": "0x42...8f9a",
  `}
<span className="priv-blur transition-all duration-700">{`  "name": "Alice Corp",
  "risk_score": 12,
  "alerts": [],`}</span>
{`
}`}
            </pre>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1c1f26] border border-[#F5C45E]/30 flex items-center justify-center z-10 text-[#F5C45E]">↓</div>

          <div className="priv-box-2 p-6 rounded-2xl bg-[#0e1015] border border-[#F5C45E]/20 relative shadow-[0_0_30px_rgba(245,196,94,0.05)]">
            <div className="absolute top-4 right-4 text-[10px] font-mono font-bold px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">PUBLIC</div>
            <div className="text-xs text-[#818b98] mb-3 font-mono">On-Chain (Smart Contract)</div>
            <pre className="font-mono text-[12px] text-[#d0d6e0] overflow-hidden">
{`struct Attestation {
  address subject;
  bytes32 amlHash;
  uint256 expiry;
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Section 5: Tenderly Integration ── */}
      <section className="tenderly-section py-[140px] px-8 max-w-[1000px] mx-auto text-center">
        <div className="font-mono text-[12px] tracking-[0.2em] uppercase text-[#F5C45E]/50 mb-5">INFRASTRUCTURE</div>
        <h2 className="font-serif text-[clamp(28px,4vw,48px)] text-[#f2f4f7] mb-6">Mainnet fidelity. Sandbox safety.</h2>
        <p className="text-[16px] text-[#818b98] max-w-[600px] mx-auto mb-16">Attestara runs on a Tenderly Virtual TestNet fork of Ethereum mainnet — real USDC, real contract state, real gas costs. No testnet tokens. No pretending.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { t: "State Manipulation", d: "tenderly_setBalance, evm_increaseTime — we control time and money for adversarial testing." },
            { t: "Transaction Simulation", d: "Dry-run every deposit before committing. Decoded reverts, gas estimates, state diffs." },
            { t: "Execution Replay", d: "Fork at any historical block. Re-run compliance checks against past state." }
          ].map((c, i) => (
            <div key={i} className="tend-card p-8 rounded-[20px] bg-[#0e1015] border border-[#1c1f26]">
              <div className="w-8 h-8 rounded-lg bg-[#F5C45E]/10 flex items-center justify-center mb-5 text-[#F5C45E]">⚡</div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{c.t}</h3>
              <p className="text-[13px] text-[#818b98] leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 6: Security Playground ── */}
      <section className="security-section py-[140px] px-8 bg-gradient-to-b from-[#0a0c10] to-[#08090b]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-[12px] tracking-[0.2em] uppercase text-[#F5C45E]/50 mb-5">SECURITY</div>
            <h2 className="font-serif text-[clamp(28px,4vw,48px)] text-[#f2f4f7] mb-6">Five attacks. Five defenses. Zero compromises.</h2>
            <p className="text-[16px] text-[#818b98] max-w-[600px] mx-auto">Every security property is demonstrated live. Watch the system defend itself in real-time against common exploits.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 [perspective:1200px]">
            {[
              { n: "Sanctioned Address", e: "Attestation__SubjectSanctioned()", class: "lg:col-span-1 lg:row-span-2" },
              { n: "Signature Replay", e: "Attestation__NonceUsed()", class: "" },
              { n: "Expired TTL", e: "Attestation__Expired()", class: "" },
              { n: "No DID Profile", e: "Attestation__MissingIdentity()", class: "" },
              { n: "Emergency Pause", e: "Pausable: paused", class: "" }
            ].map((s, i) => (
              <div key={i} className={`sec-card p-6 rounded-[20px] bg-[#0e1015] border border-[#1c1f26] flex flex-col justify-between min-h-[160px] relative overflow-hidden group ${s.class}`}>
                <div>
                  <div className="font-mono text-[14px] font-semibold text-white uppercase tracking-wider mb-2">{s.n}</div>
                  <div className="font-mono text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-1.5 inline-block mt-3">
                    Revert: {s.e}
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-[#F5C45E] text-[12px] font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C45E] animate-pulse" /> DEFENDED
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Demo Preview ── */}
      <section className="demo-section py-[140px] px-8 max-w-[1200px] mx-auto text-center">
        <h2 className="font-serif text-[clamp(28px,4vw,48px)] text-[#f2f4f7] mb-4">One flow. Complete compliance.</h2>
        <p className="text-[16px] text-[#818b98] mb-12">Watch a deposit go from intent to settlement in under 10 seconds.</p>
        
        <div className="demo-window rounded-[24px] border border-[#1c1f26] bg-[#0b0d12] overflow-hidden shadow-[0_0_80px_rgba(245,196,94,0.06)] max-w-[1100px] mx-auto relative" style={{ aspectRatio: '1878 / 865' }}>
          <div className="h-10 border-b border-[#1c1f26] bg-[#0e1015] flex items-center px-4 gap-2 relative z-10">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <div className="mx-auto font-mono text-[11px] text-[#6b7280] bg-[#1c1f26] px-4 py-1 rounded-md">localhost:3000</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 top-10 bg-[url('/Dashboard.png')] bg-contain bg-no-repeat bg-top opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center z-20">
             <button onClick={() => navigate('/app')} className="px-6 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium hover:bg-white/20 transition-all">
               Open Dashboard
             </button>
          </div>
        </div>
        <div className="font-mono text-[12px] text-[#6b7280] mt-6">Dashboard → AML Screen → EIP-712 Attestation → Vault Deposit → Settled</div>
      </section>

      {/* ── Section 8: CTA / Footer ── */}
      <section className="py-[160px] px-8 text-center flex flex-col items-center">
        <h2 className="font-serif text-[clamp(36px,5vw,64px)] text-[#f2f4f7] max-w-[700px] leading-tight">Compliance should be invisible.</h2>
        <p className="font-sans text-[17px] text-[#818b98] max-w-[520px] mt-6">Deploy Attestara as your compliance middleware. No protocol changes. No PII exposure. No compromises.</p>
        <button onClick={() => navigate('/app')} className="mt-12 px-9 py-3.5 rounded-2xl bg-[#F5C45E] text-[#0a0c10] font-semibold text-[15px] hover:shadow-[0_0_40px_rgba(245,196,94,0.3)] hover:-translate-y-[1px] transition-all duration-300">
          Launch App →
        </button>

        <div className="w-full max-w-[1200px] mt-32 border-t border-[#1c1f26] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
             <span className="text-[#f5c45e] font-bold">Ψ</span>
             <span className="font-mono text-[12px] text-[#6b7280]">© 2026 Attestara. Built for the Chainlink Convergence Hackathon.</span>
          </div>
          <div className="flex gap-6 font-mono text-[12px] text-[#818b98]">
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">API Reference</a>
          </div>
        </div>
      </section>
      
    </div>
  );
}

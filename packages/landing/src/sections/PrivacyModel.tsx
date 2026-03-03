import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function PrivacyModel() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: ref.current, start: "top 60%" },
    });
    tl.from(".priv-p",    { x: -30, opacity: 0, stagger: 0.15, duration: 0.8 })
      .from(".box-private",{ x: 40,  opacity: 0, duration: 0.6 }, "-=0.4")
      .from(".box-public", { y: 40,  opacity: 0, duration: 0.6 }, "-=0.2")
      .from(".hash-label", { opacity: 0, scale: 0.8, duration: 0.4 })
      .add(() => {
        document.querySelectorAll(".pii-blur").forEach(el => el.classList.add("blurred"));
      }, "+=0.2");
  }, []);

  return (
    <section ref={ref}>
      <div className="privacy-grid">
        {/* Left: text */}
        <div>
          <span className="section-label">PRIVACY MODEL</span>
          <h2 className="privacy-heading">The AML report never touches the chain.</h2>
          <div>
            <p className="priv-p">The CRE queries the AML provider off-chain. The full report stays securely in the CRE's isolated memory enclave.</p>
            <p className="priv-p">The CRE computes <code>keccak256(reportJSON)</code> and includes only this cryptographic hash in the signed EIP-712 attestation payload.</p>
            <p className="priv-p">The smart contract verifies the CRE's signature and the hash. It never sees, stores, or emits any personal data to the public ledger.</p>
          </div>
          <div className="key-stat">0 bytes of PII on-chain. Ever.</div>
        </div>

        {/* Right: code boxes */}
        <div className="code-comparison">
          {/* Off-chain box */}
          <div className="code-box box-private">
            <div className="status-badge badge-private">PRIVATE</div>
            <pre><code>
<span className="key">"subject"</span>{': {\n'}
{'  '}<span className="key">"address"</span>{': '}<span className="str">"0x71C...976F"</span>{',\n'}
{'  '}<span className="key">"name"</span>{': '}<span className="str">"Acme Institutional"</span><span className="pii-blur">{' // PII'}</span>{'\n'}
{'  '}<span className="key">"risk_score"</span>{': '}<span className="num">12</span><span className="pii-blur">{' // Sensitive'}</span>{'\n'}
{'  '}<span className="key">"sanctions_match"</span>{': '}<span className="typ">false</span><span className="pii-blur">{' // Sensitive'}</span>{'\n'}
{'  '}<span className="key">"alerts"</span>{': []'}<span className="pii-blur">{' // Sensitive'}</span>{'\n}'}
            </code></pre>
          </div>

          {/* Transform label */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="hash-label">keccak256( report ) → bytes32</div>
          </div>

          {/* On-chain box */}
          <div className="code-box box-public">
            <div className="status-badge badge-public">PUBLIC</div>
            <pre><code>
<span className="typ">struct</span>{' ComplianceAttestation {\n'}
{'  '}<span className="typ">address</span>{' subject;    '}<span className="str">// 0x71C...976F</span>{'\n'}
{'  '}<span className="typ">bytes32</span>{' reportHash; '}<span className="str">// 0x8f2a9b...</span>{'\n'}
{'  '}<span className="typ">uint256</span>{' expiry;     '}<span className="str">// 1718294400</span>{'\n'}
{'  '}<span className="typ">uint256</span>{' nonce;      '}<span className="str">// 42</span>{'\n}'}
            </code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}

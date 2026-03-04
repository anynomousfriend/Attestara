import { Check, X, Search, Link, PartyPopper } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api, ScreenResponse, DepositResponse } from "../api";
import { SimulationPreview } from "./SimulationPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type StepId = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  { id: 0, label: "Address", short: "Input" },
  { id: 1, label: "AML Screen", short: "Screen" },
  { id: 2, label: "Attestation", short: "Review" },
  { id: 3, label: "Deposit", short: "Execute" },
  { id: 4, label: "Settled", short: "Done" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
      className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
    />
  );
}

function MonoField({ label, value, dim, copyable }: { label: string; value: string; dim?: boolean; copyable?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 group">
      <div className="flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-widest text-muted-foreground">{label}</span>
        {copyable && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
            className="text-[12px] text-muted-foreground/30 hover:text-[#f5c45e] transition-colors opacity-0 group-hover:opacity-100"
          >copy</button>
        )}
      </div>
      <span className={cn("text-xs font-mono break-all leading-relaxed", dim ? "text-muted-foreground/50" : "text-white/85")}>
        {value}
      </span>
    </div>
  );
}

// ── Expiry Countdown ──────────────────────────────────────────────────────────
function ExpiryCountdown({ expiryTimestamp }: { expiryTimestamp: number }) {
  const [remaining, setRemaining] = useState(expiryTimestamp - Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setRemaining(expiryTimestamp - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [expiryTimestamp]);

  const total = 15 * 60; // 15 min TTL
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const expired = remaining <= 0;
  const urgent = remaining < 120;

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.max(0, remaining) % 60;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground uppercase tracking-widest">Attestation Expiry</span>
        <span className={cn("font-mono font-bold tabular-nums", expired ? "text-red-400" : urgent ? "text-orange-400" : "text-[#f5c45e]")}>
          {expired ? "EXPIRED" : `${mm}:${ss.toString().padStart(2, "0")}`}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full transition-colors duration-1000", expired ? "bg-red-500" : urgent ? "bg-orange-400" : "bg-[#f5c45e]")}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "linear" }}
        />
      </div>
      {urgent && !expired && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-[12px] text-orange-400/80"
        >
          ⚠ Attestation expiring soon — deposit now
        </motion.p>
      )}
    </div>
  );
}

// ── Step Progress Chips ───────────────────────────────────────────────────────
function StepProgress({ current, failed, snapshots, onChipClick }: {
  current: StepId;
  failed?: boolean;
  snapshots: Record<number, string>;
  onChipClick: (i: number) => void;
}) {
  const [popover, setPopover] = useState<number | null>(null);

  return (
    <div className="mb-6">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const isLast = i === STEPS.length - 1;

          const chipColor = done
            ? "bg-[#f5c45e]/15 border-[#f5c45e]/40 text-[#f5c45e]"
            : active && failed
              ? "bg-red-500/10 border-red-500/40 text-red-400"
              : active
                ? "bg-white/8 border-[#f5c45e]/50 text-white"
                : "bg-white/3 border-white/10 text-white/25";

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none relative">
              {/* Chip */}
              <div className="relative">
                <motion.button
                  onClick={() => {
                    if (done) {
                      setPopover(popover === i ? null : i);
                      onChipClick(i);
                    }
                  }}
                  animate={{ scale: active ? 1.05 : 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium whitespace-nowrap transition-colors duration-200",
                    chipColor,
                    done && "cursor-pointer hover:bg-[#f5c45e]/25 hover:border-[#f5c45e]/60",
                    !done && !active && "cursor-default"
                  )}
                >
                  {/* Icon */}
                  {done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                      <Check className="w-3 h-3" />
                    </motion.span>
                  ) : active && failed ? (
                    <X className="w-3 h-3" />
                  ) : active ? (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 rounded-full bg-[#f5c45e] inline-block"
                    />
                  ) : null}
                  {step.short}
                </motion.button>

                {/* Popover summary for completed steps */}
                <AnimatePresence>
                  {popover === i && done && snapshots[i] && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full left-0 mt-2 z-50 min-w-[180px] max-w-[240px] rounded-2xl bg-card border border-[#f5c45e]/20 shadow-xl p-3"
                    >
                      <p className="text-[11px] font-mono text-[#f5c45e]/70 uppercase tracking-widest mb-1">{step.label}</p>
                      <p className="text-[12px] font-mono text-white/70 break-all leading-relaxed">{snapshots[i]}</p>
                      <button
                        onClick={() => setPopover(null)}
                        className="mt-2 text-[11px] text-muted-foreground hover:text-white transition-colors"
                      >dismiss ×</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-px mx-1.5 overflow-hidden rounded-full bg-white/7">
                  <motion.div
                    className="h-full rounded-full bg-[#f5c45e]/50"
                    initial={{ width: "0%" }}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide variants ────────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -30, scale: 0.97, transition: { duration: 0.2 } }),
};

// ── Main Component ────────────────────────────────────────────────────────────
export function TransactionStepper() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StepId>(0);
  const [dir, setDir] = useState(1);
  const [failed, setFailed] = useState(false);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [privKey, setPrivKey] = useState("");
  const [screenResult, setScreenResult] = useState<ScreenResponse | undefined>();
  const [depositResult, setDepositResult] = useState<DepositResponse | undefined>();
  const [snapshots, setSnapshots] = useState<Record<number, string>>({});

  function goTo(next: StepId) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function saveSnapshot(i: number, text: string) {
    setSnapshots(prev => ({ ...prev, [i]: text }));
  }

  function reset() {
    setDir(1); setStep(0); setFailed(false);
    setAddress(""); setAmount(""); setPrivKey("");
    setScreenResult(undefined); setDepositResult(undefined);
    setSnapshots({});
    screenMutation.reset(); depositMutation.reset();
  }

  const screenMutation = useMutation({
    mutationFn: () => api.screen({ address, amount: Number(amount) }),
    onMutate: () => { setFailed(false); goTo(1); },
    onSuccess: (d) => {
      setScreenResult(d);
      saveSnapshot(0, `${address.slice(0, 10)}… · ${Number(amount).toLocaleString()} USDC`);
      if (d.status === "CLEARED") {
        saveSnapshot(1, `CLEARED · risk ${d.riskScore ?? 0} · ${d.amlProvider ?? "mock-aml"}`);
        toast.success("Address cleared — attestation ready");
        goTo(2);
      } else {
        saveSnapshot(1, `${d.status} · ${(d.alerts ?? []).join(", ") || "no alerts"}`);
        setFailed(true);
        toast.error(d.status === "BLOCKED" ? "Address blocked — sanctions match" : "High risk — manual review required");
      }
    },
    onError: () => { setFailed(true); toast.error("Screening failed"); },
  });

  const depositMutation = useMutation({
    mutationFn: () => api.deposit({ address, amount: Number(amount), institutionPrivateKey: privKey }),
    onMutate: () => { setFailed(false); goTo(3); toast.loading("Simulating + submitting…", { id: "dep" }); },
    onSuccess: (d) => {
      setDepositResult(d);
      toast.dismiss("dep");
      if (d.status === "SETTLED") {
        saveSnapshot(2, `EIP-712 signed · expires in 15m · nonce consumed`);
        saveSnapshot(3, `SETTLED · block #${d.blockNumber} · gas ${Number(d.gasUsed ?? 0).toLocaleString()}`);
        goTo(4);
        toast.success("Deposit settled on-chain!");
        queryClient.invalidateQueries({ queryKey: ["vault-stats"] });
        queryClient.invalidateQueries({ queryKey: ["logs"] });
      } else if (d.status === "SIMULATION_FAILED") {
        setFailed(true);
        toast.error(`Simulation failed: ${d.message ?? "Deposit would revert"}`);
      } else {
        setFailed(true);
        toast.error(`Deposit failed: ${d.message ?? d.error}`);
      }
    },
    onError: (e: any) => {
      toast.dismiss("dep");
      // Surface simulation failure from 422 response
      const data = e?.response?.data;
      if (data?.status === "SIMULATION_FAILED") {
        setDepositResult(data as any);
        setFailed(true);
        toast.error(`Simulation failed: ${data?.message ?? "Deposit would revert"}`);
      } else {
        setFailed(true);
        toast.error(`Deposit failed: ${data?.message ?? e?.message}`);
      }
    },
  });

  const expiryTs = screenResult?.attestation ? Number(screenResult.attestation.expiry) : 0;
  const isExpired = expiryTs > 0 && Math.floor(Date.now() / 1000) > expiryTs;

  const HINTS = [
    { label: "0x000… → BLOCKED", addr: "0x0000000000000000000000000000000000000001" },
    { label: "…dead… → HIGH RISK", addr: "" },
  ];

  return (
    <div className="bg-card shadow-sm border border-border border border-border rounded-3xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">New Transaction</h2>
            <p className="text-xs text-muted-foreground">EIP-712 compliance screening + on-chain deposit</p>
          </div>
          {step > 0 && (
            <button onClick={reset} className="text-[12px] font-mono text-muted-foreground hover:text-white border border-border rounded-xl px-2.5 py-1 transition-colors">
              ↺ Reset
            </button>
          )}
        </div>
        <StepProgress current={step} failed={failed} snapshots={snapshots} onChipClick={() => { }} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto styled-scroll relative">
        <AnimatePresence mode="wait" custom={dir}>
          {/* Step 0 — Input */}
          {step === 0 && (
            <motion.div key="s0" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Institution Address</label>
                <Input
                  placeholder="0x..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Deposit Amount (USDC)</label>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {HINTS.map(h => (
                  <motion.button
                    key={h.label} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    onClick={() => h.addr && setAddress(h.addr)}
                    className={cn(
                      "pill inline-flex items-center px-3 py-1 border text-[12px] font-mono transition-colors",
                      "bg-[#f5c45e]/6 border-[#f5c45e]/20 text-[#f5c45e]/70",
                      h.addr && "hover:bg-[#f5c45e]/12 cursor-pointer"
                    )}
                  >{h.label}</motion.button>
                ))}
              </div>
              <Button
                onClick={() => screenMutation.mutate()}
                disabled={!address || !amount}
                className=" active:scale-95 w-full h-12 rounded-2xl font-semibold text-sm border-none"
                style={{ background: (!address || !amount) ? "rgba(33,114,229,0.2)" : "#f5c45e", color: (!address || !amount) ? "rgba(77,159,255,0.5)" : "white" }}
              >
                Run Compliance Screen →
              </Button>
            </motion.div>
          )}

          {/* Step 1 — Screening */}
          {step === 1 && (
            <motion.div key="s1" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="p-6 flex flex-col items-center justify-center gap-6 min-h-[300px]">
              {!failed ? (
                <>
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="w-16 h-16 rounded-full border-2 border-[#f5c45e]/20 border-t-[#f5c45e]"
                    />
                    <span className="absolute inset-0 flex items-center justify-center"><Search className="w-6 h-6" /></span>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-base font-semibold text-white">Screening Address</p>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[260px]">{address}</p>
                    <p className="text-xs text-muted-foreground">Querying AML provider…</p>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-3xl mx-auto"><X className="w-5 h-5" /></div>
                  <div>
                    <p className="text-base font-semibold text-red-400">
                      {screenResult?.status === "BLOCKED" ? "Address Blocked" : "High Risk Detected"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {screenResult?.status === "BLOCKED" ? "OFAC/sanctions match — deposit rejected" : "Risk score exceeds threshold"}
                    </p>
                    {(screenResult?.alerts ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                        {screenResult!.alerts!.map((a, i) => (
                          <Badge key={i} variant="outline" className="pill text-[12px] font-mono border-red-500/25 text-red-400 bg-red-500/8">{a}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={reset} className="text-xs text-[#f5c45e] hover:text-white transition-colors underline underline-offset-4">Try different address</button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2 — Attestation review */}
          {step === 2 && screenResult && (
            <motion.div key="s2" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Attestation Ready</p>
                  <p className="text-xs text-muted-foreground">Review and confirm before depositing</p>
                </div>
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="pill inline-flex items-center px-3 py-1 text-xs font-mono font-bold border bg-[#f5c45e]/15 text-[#f5c45e] border-[#f5c45e]/30 "
                ><Check className="w-5 h-5" /> CLEARED</motion.span>
              </div>

              {/* Expiry countdown */}
              {expiryTs > 0 && <ExpiryCountdown expiryTimestamp={expiryTs} />}

              {/* AML summary */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f5c45e]/5 border border-[#f5c45e]/15 p-3">
                <MonoField label="DID" value={screenResult.did ?? "—"} />
                <MonoField label="AML Provider" value={screenResult.amlProvider ?? "—"} />
                <MonoField label="Risk Score" value={String(screenResult.riskScore ?? 0)} />
                <MonoField label="Amount" value={`${Number(amount).toLocaleString()} USDC`} />
              </div>

              {/* AI Risk Analysis */}
              {screenResult.aiNarrative && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                  <div className="rounded-2xl bg-purple-500/5 border border-purple-500/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🧠</span>
                        <span className="text-[12px] uppercase tracking-widest text-purple-300 font-semibold">AI Risk Analysis</span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300">
                        Gemini AI + Etherscan
                      </span>
                    </div>
                    <p className="text-[13px] text-white/70 leading-relaxed">
                      {screenResult.aiNarrative}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* EIP-712 */}
              <div>
                <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                  <span className="w-4 h-px bg-[#f5c45e]/40 inline-block" />EIP-712 Attestation
                </p>
                <div className="space-y-2.5 rounded-2xl bg-black/30 border border-[#f5c45e]/12 p-3">
                  <MonoField label="Subject" value={screenResult.attestation.subject} copyable />
                  <MonoField label="AML Report Hash" value={screenResult.attestation.amlReportHash} dim />
                  <MonoField label="Nonce" value={screenResult.attestation.nonce} dim />
                  <MonoField label="Signer" value={screenResult.signer ?? screenResult.signerAddress ?? "—"} copyable />
                  <div>
                    <span className="text-[12px] uppercase tracking-widest text-muted-foreground">Signature</span>
                    <p className="text-[12px] font-mono text-[#f5c45e]/40 break-all mt-0.5 leading-relaxed">{screenResult.signature}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => goTo(3)}
                disabled={isExpired}
                className=" active:scale-95 w-full h-12 rounded-2xl font-semibold text-sm border-none"
                style={{ background: isExpired ? "rgba(33,114,229,0.2)" : "#f5c45e", color: isExpired ? "rgba(77,159,255,0.5)" : "white" }}
              >
                {isExpired ? "Attestation Expired — Reset" : "Confirm & Enter Private Key →"}
              </Button>
            </motion.div>
          )}

          {/* Step 3 — Execute deposit */}
          {step === 3 && (
            <motion.div key="s3" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="p-6 space-y-4">
              {!failed ? (
                depositMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center gap-5 min-h-[240px]">
                    <div className="relative">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className="w-14 h-14 rounded-full border-2 border-[#f5c45e]/20 border-t-[#f5c45e]" />
                      <span className="absolute inset-0 flex items-center justify-center"><Link className="w-5 h-5" /></span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Submitting On-Chain</p>
                      <p className="text-xs text-muted-foreground mt-1">Calling PermissionedVault.deposit()…</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-[#f5c45e]/5 border border-[#f5c45e]/15 p-3 space-y-1">
                      <p className="text-xs font-semibold text-white mb-1">Ready to deposit</p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        The CRE will relay your deposit to <span className="font-mono text-white/60">PermissionedVault</span> using the signed attestation.
                        Your private key signs the tx locally — never leaves your browser.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Institution Private Key</label>
                      <Input
                        type="password"
                        placeholder="0x..."
                        value={privKey}
                        onChange={e => setPrivKey(e.target.value)}
                        className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e]"
                      />
                      <p className="text-[12px] text-muted-foreground/40">Used only to sign vault.deposit(). Never sent to any server.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => goTo(2)}
                        variant="outline"
                        className="h-11 rounded-2xl border-border text-muted-foreground hover:text-white hover:border-white/20 font-mono text-xs"
                      >← Back</Button>
                      <Button
                        onClick={() => depositMutation.mutate()}
                        disabled={!privKey}
                        className=" active:scale-95 h-11 rounded-2xl font-semibold text-sm border-none"
                        style={{ background: !privKey ? "rgba(33,114,229,0.2)" : "#f5c45e", color: !privKey ? "rgba(77,159,255,0.5)" : "white" }}
                      >Execute →</Button>
                    </div>
                  </>
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-2xl"><X className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-semibold text-red-400">
                      {depositResult?.status === "SIMULATION_FAILED" ? "Simulation Failed" : "Deposit Failed"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{depositResult?.message ?? depositResult?.error ?? "Transaction reverted"}</p>
                  </div>
                  {/* Feature 1: Show simulation preview on failure */}
                  {depositResult?.simulation && (
                    <div className="w-full text-left">
                      <SimulationPreview result={depositResult.simulation} />
                    </div>
                  )}
                  <button onClick={reset} className="text-xs text-[#f5c45e] hover:text-white transition-colors underline underline-offset-4">Start over</button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4 — Settled */}
          {step === 4 && depositResult && (
            <motion.div key="s4" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="flex items-center justify-center w-16 h-16 rounded-full bg-[#f5c45e]/15 border border-[#f5c45e]/30 text-3xl"
                ><PartyPopper className="w-8 h-8 text-primary" /></motion.div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">Deposit Settled!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Transaction confirmed on-chain</p>
                </div>
              </div>

              {/* Feature 1: Show passed simulation preview */}
              {depositResult.simulation?.success && (
                <SimulationPreview result={depositResult.simulation} />
              )}

              <div className="rounded-2xl bg-[#f5c45e]/8 border border-[#f5c45e]/20 p-4 space-y-3">
                {depositResult.txHash && (
                  <div>
                    <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-0.5">Transaction Hash</p>
                    <a href={`https://dashboard.tenderly.co/tx/${depositResult.txHash}`} target="_blank" rel="noreferrer"
                      className="text-xs font-mono text-[#f5c45e] hover:text-white transition-colors break-all">
                      {depositResult.txHash} ↗
                    </a>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {depositResult.blockNumber && (
                    <div>
                      <p className="text-[12px] uppercase tracking-widest text-muted-foreground">Block</p>
                      <p className="text-xs font-mono text-white/80">#{depositResult.blockNumber}</p>
                    </div>
                  )}
                  {depositResult.gasUsed && (
                    <div>
                      <p className="text-[12px] uppercase tracking-widest text-muted-foreground">Gas</p>
                      <p className="text-xs font-mono text-white/80">{Number(depositResult.gasUsed).toLocaleString()}</p>
                    </div>
                  )}
                  {depositResult.vaultBalance && (
                    <div>
                      <p className="text-[12px] uppercase tracking-widest text-muted-foreground">Vault Bal.</p>
                      <p className="text-xs font-mono text-[#f5c45e]">{Number(depositResult.vaultBalance).toLocaleString()} USDC</p>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={reset}
                className="active:scale-95 w-full h-11 rounded-2xl font-semibold text-sm border-none"
                style={{ background: "#f5c45e", color: "white" }}
              >
                New Transaction →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

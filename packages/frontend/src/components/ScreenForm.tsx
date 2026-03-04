import { Check, X, Link, Zap, PartyPopper } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api, ScreenResponse, DepositResponse } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const BLUE = "#f5c45e";
const BLUE_DIM = "rgba(33,114,229,0.12)";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    CLEARED: { cls: "bg-[#f5c45e]/15 text-[#f5c45e] border-[#f5c45e]/30 ", label: "CLEARED" },
    BLOCKED: { cls: "bg-red-500/10 text-red-400 border-red-500/25", label: "BLOCKED" },
    HIGH_RISK: { cls: "bg-orange-500/10 text-orange-400 border-orange-500/25", label: "⚠ HIGH RISK" },
    SETTLED: { cls: "bg-[#f5c45e]/20 text-[#f5c45e] border-[#f5c45e]/40 ", label: "SETTLED" },
    SUBMITTING: { cls: "bg-white/5 text-white/60 border-white/15", label: "⏳ SUBMITTING" },
  };
  const s = map[status] ?? { cls: "bg-muted text-muted-foreground border-border", label: status };
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold border", s.cls)}
    >
      {s.label}
    </motion.span>
  );
}

function MonoRow({ label, value, dim, delay = 0, copyable }: {
  label: string; value: string; dim?: boolean; delay?: number; copyable?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.22 }}
      className="flex flex-col gap-0.5 group"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-widest text-muted-foreground">{label}</span>
        {copyable && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
            className="text-[12px] text-muted-foreground/40 hover:text-[#f5c45e] transition-colors opacity-0 group-hover:opacity-100"
          >
            copy
          </button>
        )}
      </div>
      <span className={cn("text-xs font-mono break-all leading-relaxed", dim ? "text-muted-foreground/60" : "text-white/90")}>
        {value}
      </span>
    </motion.div>
  );
}

type Step = "idle" | "screening" | "cleared" | "depositing" | "settled" | "failed" | "blocked";

const HINTS = [
  { label: "0x000…", hint: "BLOCKED", addr: "0x0000000000000000000000000000000000000001" },
  { label: "…dead…", hint: "HIGH RISK", addr: "" },
  { label: "> 10M USDC", hint: "HIGH RISK", addr: "" },
];

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
      className="w-4 h-4" viewBox="0 0 24 24" fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </motion.svg>
  );
}

export function ScreenForm() {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [privateKey, setPrivKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [screenResult, setScreenResult] = useState<ScreenResponse | undefined>();
  const [depositResult, setDepositResult] = useState<DepositResponse | undefined>();

  const screenMutation = useMutation({
    mutationFn: () => api.screen({ address, amount: Number(amount) }),
    onMutate: () => setStep("screening"),
    onSuccess: (d) => {
      setScreenResult(d);
      if (d.status === "CLEARED") { setStep("cleared"); toast.success("Address cleared — attestation ready"); }
      else if (d.status === "BLOCKED") { setStep("blocked"); toast.error("Address blocked — sanctions match"); }
      else { setStep("blocked"); toast.warning("High risk — manual review required"); }
    },
    onError: () => { setStep("idle"); toast.error("Screening failed"); },
  });

  const depositMutation = useMutation({
    mutationFn: () => api.deposit({ address, amount: Number(amount), institutionPrivateKey: privateKey }),
    onMutate: () => { setStep("depositing"); toast.loading("Submitting to PermissionedVault…", { id: "dep" }); },
    onSuccess: (d) => {
      setDepositResult(d);
      toast.dismiss("dep");
      if (d.status === "SETTLED") {
        setStep("settled");
        toast.success("Deposit settled on-chain!");
        queryClient.invalidateQueries({ queryKey: ["vault-stats"] });
        queryClient.invalidateQueries({ queryKey: ["logs"] });
      } else {
        setStep("failed");
        toast.error(`Deposit failed: ${d.message ?? d.error}`);
      }
    },
    onError: (e: any) => {
      toast.dismiss("dep");
      setStep("failed");
      toast.error(`Deposit failed: ${e?.response?.data?.message ?? e?.message}`);
    },
  });

  function reset() {
    setStep("idle"); setScreenResult(undefined); setDepositResult(undefined);
    setShowKey(false); screenMutation.reset(); depositMutation.reset();
  }

  const isCleared = screenResult?.status === "CLEARED";
  const isBlocked = screenResult?.status === "BLOCKED" || screenResult?.status === "HIGH_RISK";
  const isSettled = step === "settled";
  const isDepositing = step === "depositing";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* ── Input card ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
        <Card className="bg-card shadow-sm border border-border border-border rounded-3xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ repeat: Infinity, repeatDelay: 5, duration: 0.4 }}
                  className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#f5c45e]/12 border border-[#f5c45e]/25"
                >
                  <Zap className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <CardTitle className="text-base text-white font-semibold">Compliance Screen</CardTitle>
                  <CardDescription className="text-xs">AML/KYC clearance + on-chain deposit relay</CardDescription>
                </div>
              </div>
              {step !== "idle" && (
                <button onClick={reset} className="text-[12px] font-mono text-muted-foreground hover:text-white border border-border rounded-xl px-2.5 py-1 transition-colors">
                  ↺ Reset
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Institution Address</label>
              <Input
                placeholder="0x..."
                value={address}
                onChange={e => { setAddress(e.target.value); if (step !== "idle") reset(); }}
                disabled={isDepositing || isSettled}
                className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e] transition-all disabled:opacity-50"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Deposit Amount (USDC)</label>
              <Input
                type="number"
                placeholder="1000000"
                value={amount}
                onChange={e => { setAmount(e.target.value); if (step !== "idle") reset(); }}
                disabled={isDepositing || isSettled}
                className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e] transition-all disabled:opacity-50"
              />
            </div>

            {/* Hint pills */}
            <div className="flex flex-wrap gap-2">
              {HINTS.map(h => (
                <motion.button
                  key={h.label}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => h.addr && setAddress(h.addr)}
                  className={cn(
                    "pill inline-flex items-center gap-1.5 px-3 py-1 border text-[12px] font-mono",
                    "bg-[#f5c45e]/6 border-[#f5c45e]/20 text-[#f5c45e]/70",
                    h.addr ? "cursor-pointer hover:bg-[#f5c45e]/12 transition-colors" : "cursor-default"
                  )}
                >
                  {h.label} → {h.hint}
                </motion.button>
              ))}
            </div>

            {/* Screen button */}
            <AnimatePresence mode="wait">
              {(step === "idle" || step === "screening") && (
                <motion.div key="screen-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button
                    onClick={() => screenMutation.mutate()}
                    disabled={step === "screening" || !address || !amount}
                    className=" active:scale-95 w-full h-12 rounded-2xl font-semibold text-sm transition-all duration-150"
                    style={{
                      background: (!address || !amount) ? "rgba(33,114,229,0.2)" : BLUE,
                      color: (!address || !amount) ? "rgba(33,114,229,0.5)" : "white",
                      border: "none",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {step === "screening"
                        ? <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2"><Spinner /> Screening via AML engine…</motion.span>
                        : <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Run Compliance Screen →</motion.span>
                      }
                    </AnimatePresence>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Result card ── */}
      <AnimatePresence>
        {screenResult && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
          >
            <Card className={cn(
              "border rounded-3xl overflow-hidden",
              isCleared && !isSettled ? "border-[#f5c45e]/25 bg-[#f5c45e]/4 " :
                isBlocked ? "border-red-500/20 bg-red-500/3" :
                  isSettled ? "border-[#f5c45e]/35 bg-[#f5c45e]/6 " :
                    "border-orange-500/20 bg-orange-500/3"
            )}>
              <CardHeader className="pb-3 pt-5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-white font-semibold">Screening Result</CardTitle>
                  <StatusBadge status={isSettled ? "SETTLED" : isDepositing ? "SUBMITTING" : screenResult.status} />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {screenResult.did && <MonoRow label="Resolved DID" value={screenResult.did} delay={0.05} />}
                  {screenResult.amlProvider && <MonoRow label="AML Provider" value={screenResult.amlProvider} delay={0.10} />}
                  {screenResult.riskScore !== undefined && <MonoRow label="Risk Score" value={String(screenResult.riskScore)} delay={0.12} />}
                </div>

                {/* Alerts */}
                {(screenResult.alerts ?? []).length > 0 && (
                  <div>
                    <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-2">Alerts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {screenResult.alerts!.map((a, i) => (
                        <Badge key={i} variant="outline" className="pill text-[12px] font-mono border-red-500/25 text-red-400 bg-red-500/8">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Risk Analysis */}
                {screenResult.aiNarrative && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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

                {/* Attestation */}
                {isCleared && screenResult.attestation && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
                    <Separator className="my-3" />
                    <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="w-4 h-px bg-[#f5c45e]/40 inline-block" />EIP-712 Attestation<span className="w-4 h-px bg-[#f5c45e]/40 inline-block" />
                    </p>
                    <div className="space-y-3 rounded-2xl bg-black/30 border border-[#f5c45e]/15 p-4">
                      <MonoRow label="Subject" value={screenResult.attestation.subject} delay={0.22} copyable />
                      <MonoRow label="AML Report Hash" value={screenResult.attestation.amlReportHash} delay={0.26} dim />
                      <MonoRow label="Expiry" value={new Date(Number(screenResult.attestation.expiry) * 1000).toISOString()} delay={0.30} />
                      <MonoRow label="Nonce" value={screenResult.attestation.nonce} delay={0.34} dim />
                      <MonoRow label="Signer" value={screenResult.signer ?? screenResult.signerAddress ?? "—"} delay={0.38} copyable />
                      <div className="pt-1">
                        <span className="text-[12px] uppercase tracking-widest text-muted-foreground">Signature</span>
                        <p className="text-[12px] font-mono text-[#f5c45e]/50 break-all mt-0.5 leading-relaxed">{screenResult.signature}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Deposit panel */}
                <AnimatePresence>
                  {isCleared && !isSettled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: 0.25, duration: 0.35 }}
                    >
                      <Separator className="my-3" />
                      <div className="space-y-3">
                        <p className="text-[12px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <span className="w-4 h-px bg-[#f5c45e]/40 inline-block" />Execute On-Chain Deposit<span className="w-4 h-px bg-[#f5c45e]/40 inline-block" />
                        </p>
                        <div className="rounded-2xl bg-[#f5c45e]/6 border border-[#f5c45e]/15 p-3">
                          <p className="text-[13px] text-[#f5c45e]/70 leading-relaxed">
                            CRE relays your deposit to <span className="font-mono text-white/60">PermissionedVault</span> using the signed attestation.
                            Your private key signs the transaction locally — never leaves your browser.
                          </p>
                        </div>
                        <AnimatePresence>
                          {!showKey ? (
                            <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <Button
                                onClick={() => setShowKey(true)}
                                variant="outline"
                                className="active:scale-95 w-full h-11 rounded-2xl border-[#f5c45e]/25 text-[#f5c45e] hover:bg-[#f5c45e]/8 hover:border-[#f5c45e]/40 font-mono text-xs transition-all"
                              >
                                🔑 Enter private key to deposit →
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div key="key" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                              <div className="space-y-1.5">
                                <label className="text-[13px] uppercase tracking-widest text-muted-foreground">Institution Private Key</label>
                                <Input
                                  type="password"
                                  placeholder="0x..."
                                  value={privateKey}
                                  onChange={e => setPrivKey(e.target.value)}
                                  disabled={isDepositing}
                                  className="font-mono text-sm bg-input border-border rounded-2xl h-12 text-white placeholder:text-muted-foreground/30 focus-visible:ring-[#f5c45e] focus-visible:border-[#f5c45e] disabled:opacity-50"
                                />
                                <p className="text-[12px] text-muted-foreground/40">Used only to sign vault.deposit(). Never sent to any server.</p>
                              </div>
                              <Button
                                onClick={() => depositMutation.mutate()}
                                disabled={isDepositing || !privateKey}
                                className=" active:scale-95 w-full h-12 rounded-2xl font-semibold text-sm text-white transition-all"
                                style={{ background: !privateKey ? "rgba(33,114,229,0.2)" : BLUE, border: "none" }}
                              >
                                <AnimatePresence mode="wait">
                                  {isDepositing
                                    ? <motion.span key="dl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2"><Spinner /> Submitting to PermissionedVault…</motion.span>
                                    : <motion.span key="di" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Execute On-Chain Deposit →</motion.span>
                                  }
                                </AnimatePresence>
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Settlement result */}
                <AnimatePresence>
                  {isSettled && depositResult && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                      <Separator className="my-3" />
                      <div className="rounded-2xl bg-[#f5c45e]/8 border border-[#f5c45e]/25 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }} ><PartyPopper className="w-6 h-6 text-primary" /></motion.span>
                          <p className="text-sm font-semibold text-[#f5c45e]">Deposit Settled On-Chain</p>
                        </div>
                        {depositResult.txHash && (
                          <div>
                            <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-0.5">Transaction Hash</p>
                            <a href={`https://dashboard.tenderly.co/tx/${depositResult.txHash}`} target="_blank" rel="noreferrer"
                              className="text-xs font-mono text-[#f5c45e] hover:text-white transition-colors break-all">
                              {depositResult.txHash} ↗
                            </a>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                          {depositResult.blockNumber && <div><p className="text-[12px] uppercase tracking-widest text-muted-foreground">Block</p><p className="text-xs font-mono text-white/80">#{depositResult.blockNumber}</p></div>}
                          {depositResult.gasUsed && <div><p className="text-[12px] uppercase tracking-widest text-muted-foreground">Gas Used</p><p className="text-xs font-mono text-white/80">{Number(depositResult.gasUsed).toLocaleString()}</p></div>}
                          {depositResult.vaultBalance && <div><p className="text-[12px] uppercase tracking-widest text-muted-foreground">Vault Bal.</p><p className="text-xs font-mono text-[#f5c45e]">{Number(depositResult.vaultBalance).toLocaleString()} USDC</p></div>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

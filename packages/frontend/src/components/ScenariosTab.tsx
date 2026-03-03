/**
 * ScenariosTab.tsx — Feature 4: Adversarial Scenario Playground
 *
 * Interaction model per spec:
 *  - User clicks "Run" on a scenario card
 *  - That card shows a spinner; ALL other cards become disabled
 *  - On response, steps animate in sequentially with staggered delay
 *  - expected-revert steps show decoded error in a red-tinted code box
 *  - Success steps show tx hash linked to Tenderly dashboard
 *  - Overall result banner at the bottom: green ✅ or red ❌
 *  - After completion, all cards re-enable
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  Play, CheckCircle, XCircle, AlertTriangle, Info,
  ChevronDown, ChevronUp, ExternalLink, Shield
} from "lucide-react";
import { toast } from "sonner";
import { api, ScenarioId, ScenarioResult, ScenarioStep } from "../api";
import { cn } from "@/lib/utils";

// ── Scenario metadata ──────────────────────────────────────────────────────────
const SCENARIOS: {
  id:          ScenarioId;
  icon:        string;
  title:       string;
  tagline:     string;
  description: string;
  property:    string;
  propertyColor: string;
}[] = [
  {
    id:          "sanctioned",
    icon:        "🚫",
    title:       "Sanctioned Address",
    tagline:     "OFAC-listed address attempts deposit",
    description: "Generates an address starting with 0x000 (OFAC pattern) and attempts to screen it. The CRE's AML gate should block issuance of any attestation — no on-chain interaction occurs.",
    property:    "AML Gate",
    propertyColor: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  {
    id:          "replay",
    icon:        "🔁",
    title:       "Replay Attack",
    tagline:     "Reusing a signed attestation twice",
    description: "Performs a successful deposit to consume a nonce, then resubmits the identical attestation. The second attempt must revert with Attestation__NonceUsed.",
    property:    "Nonce Protection",
    propertyColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    id:          "expired",
    icon:        "⏰",
    title:       "Expired Attestation",
    tagline:     "Fast-forwarding past the 15-minute TTL",
    description: "Signs an attestation with a 60-second TTL, then uses evm_increaseTime to advance the fork clock by 16 minutes. The vault must reject the stale attestation with Attestation__Expired.",
    property:    "Time Expiry",
    propertyColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    id:          "no-did",
    icon:        "🪪",
    title:       "Unregistered DID",
    tagline:     "AML clears — but DID is missing",
    description: "Funds a fresh wallet, skips DID registration, then obtains a valid attestation (AML passes). The vault must reject the deposit with Vault__DIDNotRegistered — proving defense-in-depth.",
    property:    "DID Gate",
    propertyColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    id:          "pause",
    icon:        "⏸️",
    title:       "Emergency Vault Pause",
    tagline:     "Owner kill-switch → blocked → unpaused → success",
    description: "Owner pauses the vault; a compliant deposit reverts with Vault__Paused. Owner unpauses; the same deposit succeeds. Full emergency lifecycle in one scenario.",
    property:    "Emergency Pause",
    propertyColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
];

// ── Step icon ──────────────────────────────────────────────────────────────────
function StepStatusIcon({ status }: { status: ScenarioStep["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
    case "expected-revert":
      return <AlertTriangle className="w-4 h-4 text-[#f5c45e] shrink-0 mt-0.5" />;
    case "info":
      return <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
  }
}

// ── Individual step row ────────────────────────────────────────────────────────
function StepRow({ step, index }: { step: ScenarioStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasData      = step.data && Object.keys(step.data).length > 0;
  const isRevert     = step.status === "expected-revert";
  const isFailed     = step.status === "failed";
  const revertReason = step.data?.revertReason as string | undefined;
  const txHash       = step.data?.txHash as string | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25 }}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs space-y-1.5",
        step.status === "success"         && "bg-emerald-500/5 border-emerald-500/15",
        step.status === "failed"          && "bg-red-500/5 border-red-500/15",
        step.status === "expected-revert" && "bg-[#f5c45e]/5 border-[#f5c45e]/20",
        step.status === "info"            && "bg-blue-500/5 border-blue-500/15",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className="font-mono text-muted-foreground/60 shrink-0 tabular-nums w-4">
          {step.step}.
        </span>
        <StepStatusIcon status={step.status} />
        <div className="flex-1 min-w-0 space-y-1">
          <span className={cn("font-medium",
            step.status === "success"         && "text-white/90",
            step.status === "failed"          && "text-red-300",
            step.status === "expected-revert" && "text-[#f5c45e]/90",
            step.status === "info"            && "text-blue-300",
          )}>
            {step.label}
          </span>
          <p className="text-muted-foreground leading-relaxed break-words">{step.detail}</p>
        </div>
        {hasData && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-white transition-colors shrink-0"
          >
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Decoded revert reason — shown inline for expected-revert */}
      {(isRevert || isFailed) && revertReason && (
        <div className={cn(
          "ml-7 rounded-lg px-3 py-2 font-mono text-[11px] break-all leading-relaxed",
          isRevert
            ? "bg-[#f5c45e]/8 border border-[#f5c45e]/20 text-[#f5c45e]/80"
            : "bg-red-500/8 border border-red-500/20 text-red-300/80",
        )}>
          {revertReason}
        </div>
      )}

      {/* Tx hash link */}
      {txHash && step.status === "success" && (
        <div className="ml-7">
          <a
            href={`https://dashboard.tenderly.co/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#f5c45e]/60 hover:text-[#f5c45e] transition-colors"
          >
            {txHash.slice(0, 18)}… <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Expanded raw data */}
      <AnimatePresence>
        {expanded && hasData && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-7 mt-1 text-[11px] font-mono text-muted-foreground bg-black/20 rounded-lg p-2.5 overflow-x-auto"
          >
            {JSON.stringify(step.data, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Scenario result summary banner ────────────────────────────────────────────
function ResultBanner({ result }: { result: ScenarioResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: result.steps.length * 0.08 + 0.1 }}
      className={cn(
        "rounded-xl border px-4 py-3 text-xs font-medium flex items-start gap-2",
        result.passed
          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
          : "bg-red-500/10 border-red-500/25 text-red-300",
      )}
    >
      {result.passed
        ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
        : <XCircle    className="w-4 h-4 shrink-0 mt-0.5" />}
      <span className="leading-relaxed">{result.summary}</span>
    </motion.div>
  );
}

// ── Individual scenario card ───────────────────────────────────────────────────
function ScenarioCard({
  scenario,
  disabled,
  onRunStart,
  onRunEnd,
}: {
  scenario:   typeof SCENARIOS[number];
  disabled:   boolean;
  onRunStart: () => void;
  onRunEnd:   () => void;
}) {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.runScenario(scenario.id),
    onMutate: () => {
      setResult(null);
      setShowSteps(false);
      onRunStart();
      toast.loading(`Running "${scenario.title}"…`, { id: scenario.id });
    },
    onSuccess: (data) => {
      setResult(data);
      setShowSteps(true);
      toast.dismiss(scenario.id);
      data.passed
        ? toast.success(`${scenario.title} — security property verified ✅`)
        : toast.error(`${scenario.title} — scenario failed unexpectedly`);
      onRunEnd();
    },
    onError: (e: unknown) => {
      toast.dismiss(scenario.id);
      const msg = (e as any)?.response?.data?.message ?? (e as any)?.message ?? "Unknown error";
      toast.error(`${scenario.title}: ${msg}`);
      onRunEnd();
    },
  });

  const isRunning = mutation.isPending;

  return (
    <div className={cn(
      "bg-card border border-border rounded-3xl p-5 flex flex-col gap-4 transition-opacity duration-200",
      disabled && !isRunning && "opacity-40 pointer-events-none",
    )}>
      {/* Card header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{scenario.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{scenario.title}</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{scenario.tagline}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>

      {/* Security property badge */}
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className={cn(
          "text-[11px] font-mono px-2 py-0.5 rounded-full border",
          scenario.propertyColor,
        )}>
          {scenario.property}
        </span>
      </div>

      {/* Run button */}
      <button
        onClick={() => mutation.mutate()}
        disabled={disabled || isRunning}
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-medium transition-all",
          "bg-[#f5c45e]/10 border border-[#f5c45e]/30 text-[#f5c45e]",
          "hover:bg-[#f5c45e]/20 hover:border-[#f5c45e]/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isRunning ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
              className="w-3.5 h-3.5 border-2 border-[#f5c45e]/30 border-t-[#f5c45e] rounded-full"
            />
            Running…
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            {result ? "Run Again" : "Run Scenario"}
          </>
        )}
      </button>

      {/* Steps timeline */}
      <AnimatePresence>
        {showSteps && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-2"
          >
            <div className="border-t border-border pt-3 space-y-1.5">
              {result.steps.map((step, i) => (
                <StepRow key={step.step} step={step} index={i} />
              ))}
            </div>
            <ResultBanner result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export function ScenariosTab() {
  const [running, setRunning] = useState<ScenarioId | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#f5c45e]" />
          Adversarial Scenario Playground
        </h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          One-click security proof scenarios. Each one scripts a specific attack vector against the
          Attestara stack and proves the system defends against it — using Tenderly state manipulation
          to craft conditions impossible to reproduce on a real network.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {(["tenderly_setBalance", "tenderly_setErc20Balance", "evm_increaseTime", "evm_mine", "tenderly_setStorageAt"] as const).map(m => (
            <span key={m} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-muted-foreground">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Scenario grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {SCENARIOS.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            disabled={running !== null && running !== scenario.id}
            onRunStart={() => setRunning(scenario.id)}
            onRunEnd={() => setRunning(null)}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/40 text-center italic">
        Scenarios run against the live Tenderly Virtual TestNet — all state changes are isolated to the fork
      </p>
    </div>
  );
}

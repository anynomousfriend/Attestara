/**
 * ScenariosTab.tsx — Feature 4: Adversarial Scenario Playground
 * One-click adversarial scenarios using Tenderly state manipulation.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Play, CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api, ScenarioId, ScenarioResult, ScenarioStep } from "../api";
import { cn } from "@/lib/utils";

const SCENARIOS: { id: ScenarioId; title: string; description: string; icon: string; tags: string[] }[] = [
  {
    id:          "sanctioned",
    title:       "Sanctioned Address",
    description: "Attempts to deposit from an OFAC-sanctioned address. The CRE's AML gate should block issuance of any attestation.",
    icon:        "🚫",
    tags:        ["AML", "OFAC", "Pre-chain"],
  },
  {
    id:          "replay",
    title:       "Replay Attack",
    description: "Uses a valid attestation twice. The second deposit should revert with Attestation__NonceUsed.",
    icon:        "🔁",
    tags:        ["Nonce", "Replay", "On-chain"],
  },
  {
    id:          "expired",
    title:       "Expired Attestation",
    description: "Fast-forwards the fork clock 2 minutes past expiry using evm_increaseTime, then attempts deposit.",
    icon:        "⏰",
    tags:        ["Expiry", "evm_increaseTime", "On-chain"],
  },
  {
    id:          "no-did",
    title:       "Unregistered DID",
    description: "AML clears the address but it has no DID. Vault should revert with Vault__DIDNotRegistered.",
    icon:        "🪪",
    tags:        ["DID", "Vault gate", "On-chain"],
  },
  {
    id:          "pause",
    title:       "Emergency Vault Pause",
    description: "Owner pauses the vault, deposit reverts with Vault__Paused. Owner unpauses, deposit succeeds.",
    icon:        "⏸️",
    tags:        ["Kill-switch", "Admin", "On-chain"],
  },
];

function StepIcon({ status }: { status: ScenarioStep["status"] }) {
  switch (status) {
    case "success":         return <CheckCircle  className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case "failed":          return <XCircle      className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    case "expected-revert": return <AlertTriangle className="w-3.5 h-3.5 text-[#f5c45e] shrink-0" />;
    case "info":            return <Info          className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
}

function StepRow({ step }: { step: ScenarioStep }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = step.data && Object.keys(step.data).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: step.step * 0.05 }}
      className={cn(
        "rounded-xl border px-3 py-2 text-xs",
        step.status === "success"         && "bg-emerald-500/5  border-emerald-500/15",
        step.status === "failed"          && "bg-red-500/5      border-red-500/15",
        step.status === "expected-revert" && "bg-[#f5c45e]/5   border-[#f5c45e]/20",
        step.status === "info"            && "bg-blue-500/5    border-blue-500/15",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground font-mono w-4 shrink-0">{step.step}.</span>
        <StepIcon status={step.status} />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-white/80">{step.label}</span>
          <p className="text-muted-foreground mt-0.5 leading-relaxed break-words">{step.detail}</p>
        </div>
        {hasData && (
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-white">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {expanded && hasData && (
        <pre className="mt-2 text-[11px] font-mono text-muted-foreground bg-black/20 rounded-lg p-2 overflow-x-auto">
          {JSON.stringify(step.data, null, 2)}
        </pre>
      )}
    </motion.div>
  );
}

function ScenarioCard({ scenario }: { scenario: typeof SCENARIOS[number] }) {
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const runMutation = useMutation({
    mutationFn:  () => api.runScenario(scenario.id),
    onMutate:    () => { setResult(null); toast.loading(`Running ${scenario.title}…`, { id: scenario.id }); },
    onSuccess:   (d) => {
      setResult(d);
      toast.dismiss(scenario.id);
      d.passed
        ? toast.success(`${scenario.title} — all checks passed`)
        : toast.error(`${scenario.title} — scenario failed unexpectedly`);
    },
    onError: (e: any) => {
      toast.dismiss(scenario.id);
      toast.error(`${scenario.title}: ${e?.response?.data?.message ?? e?.message}`);
    },
  });

  return (
    <div className="bg-card border border-border rounded-3xl p-5 flex flex-col gap-4">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{scenario.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{scenario.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{scenario.description}</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {scenario.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-muted-foreground font-mono">
            {tag}
          </span>
        ))}
      </div>

      {/* Run button */}
      <button
        onClick={() => runMutation.mutate()}
        disabled={runMutation.isPending}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f5c45e]/10 border border-[#f5c45e]/30 text-[#f5c45e] text-xs font-mono font-medium hover:bg-[#f5c45e]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {runMutation.isPending ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
            className="w-3.5 h-3.5 border-2 border-[#f5c45e]/30 border-t-[#f5c45e] rounded-full"
          />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {runMutation.isPending ? "Running…" : "Run Scenario"}
      </button>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div className={cn(
              "rounded-xl px-3 py-2 text-xs font-mono font-medium flex items-center gap-2",
              result.passed ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                           : "bg-red-500/10 border border-red-500/20 text-red-400"
            )}>
              {result.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {result.summary}
            </div>

            <div className="space-y-1.5">
              {result.steps.map((step) => (
                <StepRow key={step.step} step={step} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ScenariosTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Adversarial Scenario Playground</h2>
        <p className="text-sm text-muted-foreground mt-1">
          One-click security scenarios powered by Tenderly state manipulation — <span className="font-mono text-[#f5c45e]/70">evm_increaseTime</span>, <span className="font-mono text-[#f5c45e]/70">tenderly_setBalance</span>, <span className="font-mono text-[#f5c45e]/70">tenderly_setStorageAt</span>.
          Each scenario demonstrates a different protection layer of the compliance stack.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {SCENARIOS.map(scenario => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}

/**
 * GasAnalysis.tsx — Feature 5: Gas Optimization Dashboard
 * Visualizes the gas breakdown of a deposit transaction from Tenderly traces.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Zap, ChevronDown, ChevronRight, TrendingDown, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { api, GasBreakdown, GasNode } from "../api";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  verification:  "bg-purple-500",
  didCheck:      "bg-blue-500",
  tokenTransfer: "bg-emerald-500",
  storage:       "bg-amber-500",
  other:         "bg-white/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  verification:  "Attestation Verification",
  didCheck:      "DID Registry",
  tokenTransfer: "Token Transfer",
  storage:       "Storage Writes",
  other:         "Overhead",
};

function GasBar({ label, gas, total, color }: { label: string; gas: number; total: number; color: string }) {
  const pct = total > 0 ? (gas / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-white/70">{gas.toLocaleString()} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CallTreeNode({ node, depth = 0 }: { node: GasNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="text-xs font-mono">
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-white/3 cursor-pointer group",
          node.error && "text-red-400"
        )}
        style={{ paddingLeft: `${(depth * 16) + 8}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
               : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-3 h-3 shrink-0 inline-block" />
        )}
        <span className={cn("flex-1 truncate", depth === 0 ? "text-white font-semibold" : "text-white/70")}>
          {node.label}
        </span>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {node.gasUsed.toLocaleString()} gas
        </span>
        <span className={cn("shrink-0 tabular-nums ml-2 px-1.5 py-0.5 rounded-full text-[10px]",
          node.pct > 20 ? "bg-amber-500/20 text-amber-300"
          : node.pct > 5 ? "bg-white/10 text-white/50"
          : "text-muted-foreground/40"
        )}>
          {node.pct.toFixed(1)}%
        </span>
      </div>

      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children.map((child, i) => (
              <CallTreeNode key={i} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GasWidget({ breakdown }: { breakdown: GasBreakdown }) {
  const { totalGas, gasEstimateUsd, categories, callTree, hints, sessionAvg } = breakdown;

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Total Gas</p>
          <p className="text-lg font-mono font-bold text-white">{totalGas.toLocaleString()}</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Est. Cost</p>
          <p className="text-lg font-mono font-bold text-[#f5c45e]">${gasEstimateUsd}</p>
          <p className="text-[10px] text-muted-foreground">@ 30 gwei, ETH $3000</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Session Avg</p>
          <p className="text-lg font-mono font-bold text-white/70">{sessionAvg?.toLocaleString() ?? "—"}</p>
          {sessionAvg && sessionAvg > 0 && totalGas < sessionAvg && (
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> cheaper than avg
            </p>
          )}
        </div>
      </div>

      {/* Category breakdown bars */}
      <div className="bg-white/2 border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Gas by Category</p>
        {Object.entries(categories).map(([key, gas]) => (
          <GasBar
            key={key}
            label={CATEGORY_LABELS[key] ?? key}
            gas={gas}
            total={totalGas}
            color={CATEGORY_COLORS[key] ?? "bg-white/20"}
          />
        ))}
      </div>

      {/* Call tree */}
      <div className="bg-white/2 border border-white/8 rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Call Tree</p>
        <CallTreeNode node={callTree} depth={0} />
      </div>

      {/* Optimization hints */}
      {hints.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-[#f5c45e]" /> Optimization Hints
          </p>
          {hints.map((hint, i) => (
            <div key={i} className="rounded-xl bg-[#f5c45e]/5 border border-[#f5c45e]/15 px-3 py-2 text-xs text-[#f5c45e]/80 leading-relaxed">
              {hint}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50 italic">
        Powered by Tenderly Transaction Trace API
      </p>
    </div>
  );
}

interface Props {
  txHash?: string;
}

export function GasAnalysis({ txHash: initialTxHash }: Props) {
  const [txHash, setTxHash] = useState(initialTxHash ?? "");
  const [queried, setQueried] = useState(!!initialTxHash);

  const traceQuery = useQuery({
    queryKey:  ["trace", txHash],
    queryFn:   () => api.trace(txHash),
    enabled:   queried && !!txHash,
    retry:     false,
    staleTime: 60_000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHash.trim()) { toast.error("Enter a transaction hash"); return; }
    setQueried(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#f5c45e]" /> Gas Analysis
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Opcode-level gas breakdown for any settled deposit transaction.
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={txHash}
          onChange={e => { setTxHash(e.target.value); setQueried(false); }}
          placeholder="0x transaction hash…"
          className="flex-1 h-10 px-4 rounded-2xl bg-input border border-border text-xs font-mono text-white placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#f5c45e]/50"
        />
        <button
          type="submit"
          className="px-4 h-10 rounded-2xl bg-[#f5c45e]/10 border border-[#f5c45e]/30 text-[#f5c45e] text-xs font-mono hover:bg-[#f5c45e]/20 transition-colors"
        >
          Analyze
        </button>
      </form>

      {/* Loading */}
      {traceQuery.isFetching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
            className="w-4 h-4 border-2 border-white/20 border-t-[#f5c45e] rounded-full"
          />
          Fetching Tenderly trace…
        </div>
      )}

      {/* Error */}
      {traceQuery.isError && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-300">
          {(traceQuery.error as any)?.response?.data?.message ?? (traceQuery.error as any)?.message ?? "Trace fetch failed"}
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {traceQuery.data && !traceQuery.isFetching && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <GasWidget breakdown={traceQuery.data} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * SimulationPreview.tsx — Feature 1: Tenderly Simulation Pre-Flight
 * Shows the outcome of a dry-run simulation before the deposit is committed.
 */
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Zap, Activity, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimulationResult } from "../api";

interface Props {
  result: SimulationResult;
}

export function SimulationPreview({ result }: Props) {
  const { success, preview, logs, stateDiff, gasUsed, gasEstimateUsd } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl border p-4 space-y-3 text-sm",
        success
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {success ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <span className={cn("font-semibold font-mono text-xs uppercase tracking-widest",
          success ? "text-emerald-400" : "text-red-400"
        )}>
          {success ? "Simulation Passed — Safe to Execute" : "Simulation Failed — Deposit Would Revert"}
        </span>
      </div>

      {/* Error */}
      {!success && preview.errorSummary && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-xs font-mono text-red-300 break-all">{preview.errorSummary}</p>
        </div>
      )}

      {/* Gas estimate */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5 text-[#f5c45e]" />
        <span className="font-mono">{preview.gasLabel}</span>
        {gasEstimateUsd && (
          <span className="text-white/40">≈ ${gasEstimateUsd} at 30 gwei</span>
        )}
      </div>

      {/* Events */}
      {success && preview.events.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" /> Events
          </p>
          {preview.events.map((ev, i) => (
            <div key={i} className="text-xs font-mono text-emerald-300/80">{ev}</div>
          ))}
        </div>
      )}

      {/* State changes */}
      {success && preview.stateChanges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Database className="w-3 h-3" /> State Changes
          </p>
          {preview.stateChanges.map((sc, i) => (
            <div key={i} className="text-xs font-mono text-white/60">{sc}</div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50 italic">
        Powered by Tenderly Simulation API — no gas spent
      </p>
    </motion.div>
  );
}

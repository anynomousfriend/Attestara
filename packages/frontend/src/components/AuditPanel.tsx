/**
 * AuditPanel.tsx — Feature 2: Time-Travel Compliance Auditing
 * Shows a side-by-side comparison of on-chain state at deposit time vs now.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, AlertTriangle, Loader } from "lucide-react";
import { toast } from "sonner";
import { api, AuditComparison, TimeTravelSnapshot } from "../api";
import { cn } from "@/lib/utils";

interface Props {
  txHash:   string;
  subject?: string;
  nonce?:   string;
  onClose:  () => void;
}

function SnapshotCell({ value, check }: { value: string | boolean | null | undefined; check?: boolean }) {
  if (typeof value === "boolean") {
    return check !== undefined
      ? (value === check
          ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {String(value)}</span>
          : <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {String(value)}</span>)
      : <span className={value ? "text-emerald-400" : "text-red-400"}>{String(value)}</span>;
  }
  return <span className="font-mono text-xs text-white/80 break-all">{value ?? "—"}</span>;
}

function Row({ label, atDeposit, now, checkValue }: {
  label:      string;
  atDeposit:  string | boolean | null | undefined;
  now:        string | boolean | null | undefined;
  checkValue?: boolean;
}) {
  const changed = String(atDeposit) !== String(now);
  return (
    <tr className={cn("border-b border-white/5 text-xs", changed && "bg-amber-500/5")}>
      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{label}</td>
      <td className="py-2 pr-4"><SnapshotCell value={atDeposit} check={checkValue} /></td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <SnapshotCell value={now} check={checkValue} />
          {changed && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
        </div>
      </td>
    </tr>
  );
}

export function AuditPanel({ txHash, subject, nonce, onClose }: Props) {
  const [result, setResult] = useState<AuditComparison | null>(null);

  const auditMutation = useMutation({
    mutationFn: () => api.audit(txHash, subject, nonce),
    onSuccess:  (d) => { setResult(d); toast.success("Time-travel audit complete"); },
    onError:    (e: any) => toast.error(`Audit failed: ${e?.response?.data?.message ?? e?.message}`),
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="bg-card border border-border rounded-3xl p-6 space-y-4 max-w-2xl w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#f5c45e]" />
          <span className="text-sm font-semibold text-white">Time-Travel Audit</span>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-white transition-colors">✕ Close</button>
      </div>

      <div className="text-xs font-mono text-muted-foreground break-all">
        tx: {txHash}
      </div>

      {/* Run button */}
      {!result && (
        <button
          onClick={() => auditMutation.mutate()}
          disabled={auditMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f5c45e]/10 border border-[#f5c45e]/30 text-[#f5c45e] text-xs font-mono hover:bg-[#f5c45e]/20 transition-colors disabled:opacity-50"
        >
          {auditMutation.isPending
            ? <><Loader className="w-3 h-3 animate-spin" /> Creating historical fork…</>
            : <><Clock className="w-3 h-3" /> Run Time-Travel Audit</>}
        </button>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-xs text-muted-foreground">
              Comparing state at block <span className="text-white font-mono">#{result.blockNumber}</span> vs current
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Field</th>
                    <th className="text-left py-2 pr-4 font-medium">At Deposit (#{result.blockNumber})</th>
                    <th className="text-left py-2 font-medium">Now</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="DID Registered"   atDeposit={result.atDeposit.didRegistered} now={result.now.didRegistered} checkValue={true} />
                  <Row label="DID"              atDeposit={result.atDeposit.didString}     now={result.now.didString} />
                  <Row label="Vault Balance"    atDeposit={`${result.atDeposit.vaultBalance} USDC`} now={`${result.now.vaultBalance} USDC`} />
                  <Row label="Nonce Consumed"   atDeposit={result.atDeposit.nonceConsumed} now={result.now.nonceConsumed} checkValue={true} />
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-2">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {result.warnings.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle className="w-3.5 h-3.5" />
                All compliance checks consistent — deposit was valid at time of execution
              </div>
            )}

            <p className="text-[11px] text-muted-foreground/50 italic">
              Powered by Tenderly Virtual TestNet — ephemeral fork pinned to block #{result.blockNumber}
            </p>

            <button
              onClick={() => { setResult(null); auditMutation.reset(); }}
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              ↺ Run again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, AuditLog } from "../api";
import { AuditPanel } from "./AuditPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function truncate(s: string, n = 8) {
  if (!s || s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

function AmlBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    CLEARED: "bg-[#f5c45e]/12 text-[#f5c45e] border-[#f5c45e]/25",
    BLOCKED: "bg-red-500/10 text-red-400 border-red-500/20",
    HIGH_RISK: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    PENDING: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <Badge variant="outline" className={cn(
      "pill text-[12px] font-mono px-2 py-0.5 border whitespace-nowrap",
      styles[status] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {status}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SETTLED: "bg-[#f5c45e]/15 text-[#f5c45e] border-[#f5c45e]/30",
    CLEARED: "bg-[#f5c45e]/10 text-[#f5c45e]/80 border-[#f5c45e]/20",
    BLOCKED: "bg-red-500/10 text-red-400 border-red-500/20",
    SUBMITTED: "bg-white/6 text-white/60 border-white/12",
    PENDING: "bg-white/4 text-white/40 border-white/8",
    FAILED: "bg-white/3 text-white/25 border-white/6",
    REVOKED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <Badge variant="outline" className={cn(
      "pill text-[12px] font-mono px-2 py-0.5 border whitespace-nowrap",
      styles[status] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {status}
    </Badge>
  );
}

function RiskScore({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-muted-foreground/30 text-xs">—</span>;
  const cls = score < 30
    ? "text-[#f5c45e] bg-[#f5c45e]/10"
    : score < 60
      ? "text-orange-400 bg-orange-500/10"
      : "text-red-400 bg-red-500/10";
  return (
    <span className={cn("inline-flex items-center justify-center w-8 h-6 rounded-lg text-[13px] font-mono font-bold", cls)}>
      {score}
    </span>
  );
}

const COLS = ["Time", "Subject / DID", "Amount", "AML", "Risk", "Alerts", "Status", "Tx", "Audit"];

export function AMLLogs() {
  const [auditTarget, setAuditTarget] = useState<{ txHash: string; subject: string; nonce?: string } | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: () => api.logs(100, 0),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      {/* Feature 2: Time-Travel Audit Panel overlay */}
      <AnimatePresence>
        {auditTarget && (
          <motion.div
            key="audit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <AuditPanel
              txHash={auditTarget.txHash}
              subject={auditTarget.subject}
              nonce={auditTarget.nonce}
              onClose={() => setAuditTarget(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            key={logs.length}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-sm font-mono text-white font-semibold"
          >
            {logs.length}
          </motion.span>
          <span className="text-sm text-muted-foreground">compliance records</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5c45e] " />
          <Badge variant="outline" className="pill text-[12px] font-mono text-[#f5c45e] border-[#f5c45e]/25 bg-[#f5c45e]/8">
            LIVE · 3s
          </Badge>
        </div>
      </motion.div>

      <Card className="bg-card shadow-sm border border-border border-border rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-2xl bg-white/4 animate-pulse bg-primary/10" />)}
            </div>
          ) : logs.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-4">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }} ><ClipboardList className="w-10 h-10 text-muted-foreground/50" /></motion.div>
              <p className="text-sm text-muted-foreground">No compliance records yet.</p>
            </motion.div>
          ) : (
            <ScrollArea className="h-[calc(100vh-230px)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-background/95 backdrop-blur-md">
                    {COLS.map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[12px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {logs.map((log: AuditLog, i: number) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.025, 0.35), duration: 0.22 }}
                        className={cn("tr-hover border-b border-border/50 group", i % 2 === 0 ? "" : "bg-white/[0.01]")}
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground/60 whitespace-nowrap tabular-nums">
                          {format(new Date(log.timestamp), "MMM dd HH:mm:ss")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-white/80 group-hover:text-white transition-colors">{truncate(log.subject, 6)}</div>
                          {log.did && <div className="font-mono text-[#f5c45e]/50 text-[12px] mt-0.5">{truncate(log.did, 6)}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-white/70 whitespace-nowrap tabular-nums">
                          {Number(log.amount).toLocaleString()}
                          <span className="text-muted-foreground/40 text-[12px] ml-1">USDC</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <AmlBadge status={log.amlStatus} />
                            {log.aiNarrative && (
                              <span title={log.aiNarrative} className="cursor-help text-purple-400 text-xs">🧠</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><RiskScore score={log.riskScore} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(log.alerts ?? []).slice(0, 2).map((a: string, j: number) => (
                              <span key={j} className="px-1.5 py-0.5 rounded-lg bg-red-500/8 text-red-400/70 text-[12px] font-mono whitespace-nowrap">{a}</span>
                            ))}
                            {(log.alerts ?? []).length > 2 && (
                              <span className="text-muted-foreground/40 text-[12px]">+{log.alerts.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-3">
                          {log.txHash ? (
                            <motion.a
                              whileHover={{ scale: 1.05 }}
                              href={`https://dashboard.tenderly.co/tx/${log.txHash}`}
                              target="_blank" rel="noreferrer"
                              className="font-mono text-[#f5c45e]/60 hover:text-[#f5c45e] transition-colors whitespace-nowrap"
                            >
                              {truncate(log.txHash, 4)} ↗
                            </motion.a>
                          ) : <span className="text-muted-foreground/20">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {log.txHash && log.status === "SETTLED" ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setAuditTarget({ txHash: log.txHash!, subject: log.subject, nonce: log.nonce })}
                              className="text-[11px] font-mono px-2 py-1 rounded-lg bg-[#f5c45e]/8 border border-[#f5c45e]/20 text-[#f5c45e]/70 hover:text-[#f5c45e] hover:bg-[#f5c45e]/15 transition-colors whitespace-nowrap"
                            >
                              ⏱ Audit
                            </motion.button>
                          ) : <span className="text-muted-foreground/20">—</span>}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

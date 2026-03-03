import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, AuditLog } from "../api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

function truncate(s: string, n = 6) {
  if (!s || s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

function statusStyle(amlStatus: string, status: string) {
  if (amlStatus === "BLOCKED" || status === "BLOCKED")
    return { bar: "bg-red-500", badge: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-400" };
  if (amlStatus === "HIGH_RISK")
    return { bar: "bg-orange-500", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-400" };
  if (status === "SETTLED")
    return { bar: "bg-[#f5c45e]", badge: "bg-[#f5c45e]/15 text-[#f5c45e] border-[#f5c45e]/30", dot: "bg-[#f5c45e]" };
  if (amlStatus === "CLEARED")
    return { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" };
  return { bar: "bg-white/20", badge: "bg-white/5 text-white/40 border-white/10", dot: "bg-white/30" };
}

function FeedEntry({ log, index }: { log: AuditLog; index: number }) {
  const s = statusStyle(log.amlStatus, log.status);
  const age = formatDistanceToNow(new Date(log.timestamp), { addSuffix: true });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex items-start gap-3 px-4 py-3 group hover:bg-white/[0.02] transition-colors duration-150 cursor-default"
    >
      {/* Left status bar */}
      <div className={cn("absolute left-0 top-3 bottom-3 w-0.5 rounded-full", s.bar)} />

      {/* Dot */}
      <div className={cn("mt-0.5 w-2 h-2 rounded-full shrink-0 ml-1", s.dot)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-mono text-white/80 truncate">{truncate(log.subject)}</span>
          <span className="text-[12px] text-muted-foreground/50 shrink-0 tabular-nums">{age}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("pill text-[12px] font-mono px-2 py-0 border h-4", s.badge)}>
            {log.amlStatus}
          </Badge>
          <span className="text-[12px] font-mono text-muted-foreground/60">
            {Number(log.amount).toLocaleString()} USDC
          </span>
          {log.riskScore !== undefined && (
            <span className={cn("text-[12px] font-mono",
              log.riskScore < 30 ? "text-emerald-400/60" : log.riskScore < 60 ? "text-orange-400/60" : "text-red-400/60"
            )}>
              risk {log.riskScore}
            </span>
          )}
        </div>
        {log.txHash && (
          <a
            href={`https://dashboard.tenderly.co/tx/${log.txHash}`}
            target="_blank" rel="noreferrer"
            className="text-[12px] font-mono text-[#f5c45e]/50 hover:text-[#f5c45e] transition-colors mt-0.5 block"
            onClick={e => e.stopPropagation()}
          >
            {truncate(log.txHash, 8)} ↗
          </a>
        )}
      </div>
    </motion.div>
  );
}

export function LiveFeed() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: () => api.logs(50, 0),
    refetchInterval: 8000,
  });

  return (
    <div className="flex flex-col h-full bg-card shadow-sm border border-border border border-border rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5c45e] " />
          <span className="text-sm font-medium text-white">Live Compliance Feed</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            key={logs.length}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[13px] font-mono text-muted-foreground"
          >
            {logs.length} records
          </motion.span>
          <Badge variant="outline" className="pill text-[12px] font-mono text-[#f5c45e] border-[#f5c45e]/25 bg-[#f5c45e]/8">
            2s
          </Badge>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-[#f5c45e]/30 border-t-[#f5c45e] rounded-full"
            />
            <span className="text-xs text-muted-foreground">Loading records…</span>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="text-3xl"
          >
            <Search className="w-8 h-8" />
          </motion.div>
          <p className="text-sm text-white font-medium">No records yet</p>
          <p className="text-xs text-muted-foreground">Submit a transaction to see live compliance data appear here.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/40">
            <AnimatePresence initial={false}>
              {logs.map((log, i) => (
                <FeedEntry key={log.id} log={log} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

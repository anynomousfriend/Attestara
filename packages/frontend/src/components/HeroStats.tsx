import { Wallet, Check, X, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api";
import { cn } from "@/lib/utils";

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  delay?: number;
  accent?: "blue" | "green" | "red" | "orange";
}

function StatCard({ label, value, sub, icon, delay = 0, accent = "blue" }: StatProps) {
  const colors = {
    blue:   { bg: "bg-[#f5c45e]/8",   border: "border-[#f5c45e]/20 hover:border-[#f5c45e]/40", icon: "bg-[#f5c45e]/12 border-[#f5c45e]/25", text: "text-[#f5c45e]" },
    green:  { bg: "bg-emerald-500/6", border: "border-emerald-500/15 hover:border-emerald-500/35", icon: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
    red:    { bg: "bg-red-500/6",     border: "border-red-500/15 hover:border-red-500/35",     icon: "bg-red-500/10 border-red-500/20",     text: "text-red-400"     },
    orange: { bg: "bg-orange-500/6",  border: "border-orange-500/15 hover:border-orange-500/35", icon: "bg-orange-500/10 border-orange-500/20", text: "text-orange-400" },
  };
  const c = colors[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -2 }}
      className={cn("rounded-2xl border bg-card shadow-sm border border-border p-4 cursor-default transition-all duration-200 stat-card", c.bg, c.border)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={cn("flex items-center justify-center w-8 h-8 rounded-xl border text-base", c.icon)}>{icon}</span>
        <span className={cn("text-[12px] font-mono uppercase tracking-widest", c.text)}>{sub}</span>
      </div>
      <p className="text-xl font-bold text-white font-mono tabular-nums">{value}</p>
      <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

export function HeroStats() {
  const { data: vaultData } = useQuery({ queryKey: ["vault-stats"], queryFn: api.vaultStats, refetchInterval: 60000 });
  const { data: logs = [] } = useQuery({ queryKey: ["logs"], queryFn: () => api.logs(100, 0), refetchInterval: 10000 });
  const { data: queue = [] } = useQuery({ queryKey: ["queue"], queryFn: api.queue, refetchInterval: 5000 });

  const totalDeposits  = useCountUp(Number(vaultData?.totalDeposits ?? 0));
  const clearedToday   = logs.filter(l => l.amlStatus === "CLEARED").length;
  const blockedToday   = logs.filter(l => l.amlStatus === "BLOCKED").length;
  const pending        = queue.length;

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard icon=<Wallet className="w-4 h-4" /> label="Total Vault Deposits"  value={`${totalDeposits.toLocaleString()}`} sub="USDC" accent="blue"   delay={0}    />
      <StatCard icon=<Check className="w-4 h-4" />  label="Screened & Cleared"   value={String(clearedToday)}                sub="today"  accent="green"  delay={0.07} />
      <StatCard icon="⏳" label="In AML Queue"          value={String(pending)}                     sub="live"   accent="orange" delay={0.14} />
      <StatCard icon=<X className="w-4 h-4" />  label="Blocked / Flagged"    value={String(blockedToday)}                sub="today"  accent="red"    delay={0.21} />
    </div>
  );
}

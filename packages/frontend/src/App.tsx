import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { api } from "./api";
import { TransactionStepper } from "./components/TransactionStepper";
import { LiveFeed } from "./components/LiveFeed";
import { HeroStats } from "./components/HeroStats";
import { AMLLogs } from "./components/AMLLogs";
import { VaultStats } from "./components/VaultStats";
import { PendingQueue } from "./components/PendingQueue";
import { ScenariosTab } from "./components/ScenariosTab";
import { GasAnalysis } from "./components/GasAnalysis";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type View = "dashboard" | "logs" | "vault" | "queue" | "scenarios";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⚡" },
  { id: "logs",      label: "AML Logs",  icon: "🔍" },
  { id: "vault",     label: "Vault",     icon: "🏛"  },
  { id: "scenarios", label: "Scenarios", icon: "🧪"  },
  { id: "queue",     label: "Queue",     icon: "⏳"  },
];

const PAGE_VARIANTS = {
  enter:  { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number,number,number,number] } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function Clock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
      {time.toLocaleTimeString("en-GB", { hour12: false })} UTC
    </span>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });

  const isOnline = !!health;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background mesh-bg">

      {/* ── Top Navbar ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="flex items-center justify-between px-6 py-0 h-14 border-b border-border bg-card shadow-sm border border-border shrink-0 z-20"
      >
        {/* Left — Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className=" flex items-center justify-center w-8 h-8 rounded-xl bg-[#f5c45e]/15 border border-[#f5c45e]/30">
              <span className="text-[#f5c45e] text-sm font-bold select-none">Ψ</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-none">Attestara</p>
              <p className="text-[11px] text-muted-foreground tracking-[0.15em] uppercase leading-none mt-0.5">Compliance Layer</p>
            </div>
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            {NAV.map(item => (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setView(item.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150",
                  view === item.id
                    ? "bg-[#f5c45e]/15 text-[#f5c45e] border border-[#f5c45e]/25"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </motion.button>
            ))}
          </nav>
        </div>

        {/* Right — Status */}
        <div className="flex items-center gap-3">
          <Clock />
          {health?.chainId && (
            <Badge variant="outline" className="pill font-mono text-[12px] text-muted-foreground border-border">
              Chain {health.chainId}
            </Badge>
          )}
          {health?.amlProvider && (
            <Badge variant="outline" className="pill font-mono text-[12px] text-[#f5c45e]/70 border-[#f5c45e]/20 hidden md:flex">
              {health.amlProvider}
            </Badge>
          )}
          <motion.div
            animate={isOnline
              ? { boxShadow: ["0 0 0 0 rgba(33,114,229,0.4)", "0 0 0 5px rgba(33,114,229,0)", "0 0 0 0 rgba(33,114,229,0)"] }
              : {}
            }
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-mono font-medium border",
              isOnline
                ? "bg-[#f5c45e]/10 border-[#f5c45e]/25 text-[#f5c45e]"
                : "bg-white/3 border-white/8 text-white/30"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-[#f5c45e] " : "bg-white/20")} />
            {isOnline ? "Live" : "Offline"}
          </motion.div>
        </div>
      </motion.header>

      {/* ── Page content ── */}
      <div className="flex-1 overflow-hidden relative">
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#f5c45e]/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#4C1D95]/5 rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">

          {/* ── Dashboard view ── */}
          {view === "dashboard" && (
            <motion.div
              key="dashboard"
              variants={PAGE_VARIANTS}
              initial="enter" animate="center" exit="exit"
              className="h-full flex flex-col overflow-hidden"
            >
              {/* Hero stats row */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="px-6 pt-5 pb-4 shrink-0"
              >
                <HeroStats />
              </motion.div>

              {/* Two-column split */}
              <div className="flex-1 overflow-hidden px-6 pb-5 grid grid-cols-[minmax(0,480px)_1fr] gap-4 min-h-0">
                {/* Left — Stepper widget */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-y-auto"
                >
                  <TransactionStepper />
                </motion.div>

                {/* Right — Live feed */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                  className="min-h-0"
                >
                  <LiveFeed />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── AML Logs view ── */}
          {view === "logs" && (
            <motion.div
              key="logs"
              variants={PAGE_VARIANTS}
              initial="enter" animate="center" exit="exit"
              className="h-full overflow-auto p-6 relative z-10"
            >
              <AMLLogs />
            </motion.div>
          )}

          {/* ── Vault view ── */}
          {view === "vault" && (
            <motion.div
              key="vault"
              variants={PAGE_VARIANTS}
              initial="enter" animate="center" exit="exit"
              className="h-full overflow-auto p-6 relative z-10 space-y-6"
            >
              <VaultStats />
              <div className="border-t border-border pt-6">
                <GasAnalysis />
              </div>
            </motion.div>
          )}

          {/* ── Scenarios view ── */}
          {view === "scenarios" && (
            <motion.div
              key="scenarios"
              variants={PAGE_VARIANTS}
              initial="enter" animate="center" exit="exit"
              className="h-full overflow-auto p-6 relative z-10"
            >
              <ScenariosTab />
            </motion.div>
          )}

          {/* ── Queue view ── */}
          {view === "queue" && (
            <motion.div
              key="queue"
              variants={PAGE_VARIANTS}
              initial="enter" animate="center" exit="exit"
              className="h-full overflow-auto p-6 relative z-10"
            >
              <PendingQueue />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "hsl(220 20% 9%)",
            border: "1px solid hsl(220 20% 14%)",
            color: "hsl(210 20% 95%)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            borderRadius: "16px",
          },
        }}
      />
    </div>
  );
}

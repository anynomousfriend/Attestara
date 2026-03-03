import { Building2, Zap, Search, PenTool, Lock, Link, Wallet, Network } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function truncate(s: string, n = 8) {
  if (!s || s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(target * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function StatCard({ icon, label, value, sub, delay = 0 }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity:0, y:20, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      transition={{ delay: delay * 0.1, duration:0.4, ease:[0.32,0.72,0,1] }}
      whileHover={{ y:-3 }}
    >
      <Card className="bg-card shadow-sm border border-border border-border rounded-3xl stat-card overflow-hidden">
        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-start gap-3">
            <motion.div
              whileHover={{ rotate:[0,-10,10,0] }}
              transition={{ duration:0.4 }}
              className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#f5c45e]/10 border border-[#f5c45e]/20 text-xl shrink-0"
            >
              {icon}
            </motion.div>
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
              <p className="text-base font-bold font-mono text-white truncate">{value}</p>
              {sub && <p className="text-[12px] font-mono text-muted-foreground/40 mt-0.5 truncate">{sub}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const FLOW = [
  { icon: <Building2 className="w-5 h-5" />,  label: "Institution"       },
  { icon: <Zap className="w-5 h-5" />,  label: "CRE Engine"        },
  { icon: <Search className="w-5 h-5" />,  label: "AML Provider"      },
  { icon: <PenTool className="w-5 h-5" />,  label: "EIP-712 Attest."   },
  { icon: <Lock className="w-5 h-5" />,  label: "Perm. Vault"       },
  { icon: <Network className="w-5 h-5" />,  label: "Tenderly Fork"     },
];

export function VaultStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["vault-stats"],
    queryFn: api.vaultStats,
    refetchInterval: 60000,
  });
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 60000,
  });

  const rawDeposits = Number(data?.totalDeposits ?? 0);
  const animated    = useCountUp(rawDeposits);
  const contracts   = health?.contracts ?? { didRegistry: "", verifier: "", vault: "" };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-3xl bg-white/4 animate-pulse bg-primary/10" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Live indicator */}
      <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f5c45e] " />
        <span className="text-xs text-muted-foreground">Live on-chain data · refreshing every 5s</span>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="Total Vault Deposits" delay={0}
          value={`${animated.toLocaleString()} USDC`}
          sub="Cumulative settled deposits"
        />
        <StatCard icon={<Link className="w-5 h-5" />} label="DID Registry" delay={1}
          value={truncate(contracts.didRegistry || "Not deployed", 8)}
          sub={contracts.didRegistry || undefined}
        />
        <StatCard icon={<PenTool className="w-5 h-5" />} label="Attestation Verifier" delay={2}
          value={truncate(contracts.verifier || "Not deployed", 8)}
          sub={contracts.verifier || undefined}
        />
        <StatCard icon={<Lock className="w-5 h-5" />} label="Permissioned Vault" delay={3}
          value={truncate(contracts.vault || "Not deployed", 8)}
          sub={contracts.vault || undefined}
        />
      </div>

      <Separator className="bg-border" />

      {/* Architecture flow */}
      <div>
        <motion.p
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
          className="text-[12px] uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2"
        >
          <span className="w-6 h-px bg-[#f5c45e]/30 inline-block" />
          Transaction Architecture
          <span className="w-6 h-px bg-[#f5c45e]/30 inline-block" />
        </motion.p>
        <div className="flex items-center overflow-x-auto pb-2 gap-0">
          {FLOW.map((step, i) => (
            <div key={i} className="flex items-center shrink-0">
              <motion.div
                initial={{ opacity:0, y:12 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay: 0.45 + i * 0.07, duration:0.3 }}
                whileHover={{ y:-4, scale:1.06 }}
                className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border border-[#f5c45e]/20 bg-[#f5c45e]/5 cursor-default transition-all duration-200 hover:border-[#f5c45e]/35 hover:bg-[#f5c45e]/8"
              >
                <motion.span
                  animate={{ rotate:[0,5,-5,0] }}
                  transition={{ repeat:Infinity, repeatDelay: 3 + i, duration:0.5 }}
                  className="text-xl"
                >
                  {step.icon}
                </motion.span>
                <span className="text-[12px] font-mono text-center whitespace-nowrap text-muted-foreground">
                  {step.label}
                </span>
              </motion.div>
              {i < FLOW.length - 1 && (
                <motion.div
                  initial={{ opacity:0, scaleX:0 }}
                  animate={{ opacity:1, scaleX:1 }}
                  transition={{ delay: 0.5 + i * 0.07 }}
                  className="flex items-center mx-1 shrink-0"
                >
                  <div className="w-4 h-px bg-[#f5c45e]/25" />
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-[#f5c45e]/40">
                    <path d="M0 4h6M4 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy callout */}
      <motion.div
        initial={{ opacity:0, y:16 }}
        animate={{ opacity:1, y:0 }}
        transition={{ delay:0.9, duration:0.4 }}
      >
        <Card className="bg-card shadow-sm border border-border border-[#f5c45e]/20 bg-[#f5c45e]/4 rounded-3xl ">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start gap-4">
              <motion.div
                animate={{ scale:[1,1.08,1] }}
                transition={{ repeat:Infinity, duration:3, ease:"easeInOut" }}
                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#f5c45e]/12 border border-[#f5c45e]/25 text-xl shrink-0"
              >
                <Lock className="w-5 h-5" />
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Zero-Knowledge Privacy Model</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No PII is stored on-chain. AML reports are hashed with{" "}
                  <span className="font-mono text-white/70">keccak256</span> before commitment.
                  EIP-712 signatures prove compliance without revealing results.
                  15-minute TTL + nonce replay protection enforced at contract level.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["EIP-712","keccak256","Nonce Replay Guard","15-min TTL","Zero PII"].map(tag => (
                    <motion.div key={tag} whileHover={{ scale:1.06 }}>
                      <Badge variant="outline" className="pill text-[12px] font-mono text-[#f5c45e]/70 border-[#f5c45e]/25 cursor-default">
                        {tag}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

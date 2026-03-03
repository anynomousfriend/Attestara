import { CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function ProgressBar() {
  return (
    <div className="relative h-1 w-full rounded-full bg-[#f5c45e]/10 overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: "#f5c45e", width: "50%" }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      />
    </div>
  );
}

export function PendingQueue() {
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["queue"],
    queryFn: api.queue,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-3xl bg-white/4 animate-pulse bg-primary/10" />)}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {queue.length > 0 && (
              <motion.span
                key="count"
                initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
                className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f5c45e]/20 text-[#f5c45e] text-[12px] font-bold font-mono"
              >
                {queue.length}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-sm text-muted-foreground">
            {queue.length === 0 ? "Queue empty" : `${queue.length} transaction${queue.length !== 1 ? "s" : ""} in progress`}
          </span>
        </div>
        <Badge variant="outline" className={cn(
          "pill text-[12px] font-mono border",
          queue.length > 0
            ? "text-[#f5c45e] border-[#f5c45e]/25 bg-[#f5c45e]/8"
            : "text-muted-foreground border-border bg-transparent"
        )}>
          {queue.length > 0 ? "● PROCESSING" : "● IDLE"}
        </Badge>
      </motion.div>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {queue.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity:0, scale:0.97 }}
            animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:0.97 }}
            transition={{ duration:0.3 }}
          >
            <Card className="bg-card shadow-sm border border-border border-border rounded-3xl">
              <CardContent className="flex flex-col items-center justify-center py-24 gap-5">
                <motion.div
                  animate={{ y:[0,-6,0] }}
                  transition={{ repeat:Infinity, duration:3, ease:"easeInOut" }}
                  className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f5c45e]/8 border border-[#f5c45e]/20 text-3xl"
                >
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-base font-medium text-white">All clear</p>
                  <p className="text-sm text-muted-foreground">No transactions pending.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f5c45e]/40 " />
                  Polling every 1.5s
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items */}
      <AnimatePresence>
        {queue.map((item, idx) => {
          const age = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });
          return (
            <motion.div
              key={item.id}
              initial={{ opacity:0, x:-20, scale:0.97 }}
              animate={{ opacity:1, x:0, scale:1 }}
              exit={{ opacity:0, x:20, scale:0.97, transition:{ duration:0.2 } }}
              transition={{ delay: idx * 0.06, duration:0.32, ease:[0.32,0.72,0,1] }}
              layout
            >
              <Card className="bg-card shadow-sm border border-border border-[#f5c45e]/15 bg-[#f5c45e]/3 hover:border-[#f5c45e]/25 transition-colors duration-300 rounded-3xl">
                <CardHeader className="pb-2 pt-5 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white truncate">{item.subject}</p>
                      {item.did && <p className="text-[12px] font-mono text-[#f5c45e]/60 truncate mt-0.5">{item.did}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white font-mono">
                        {Number(item.amount).toLocaleString()}
                        <span className="text-muted-foreground text-xs font-normal ml-1">USDC</span>
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{age}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-5 px-5 space-y-2">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <motion.span
                        animate={{ opacity:[1,0.2,1] }}
                        transition={{ repeat:Infinity, duration:1.2 }}
                        className="w-1 h-1 rounded-full bg-[#f5c45e] inline-block"
                      />
                      AML screening in progress
                    </span>
                    <span className="font-mono opacity-40">{item.id.slice(0,8)}…</span>
                  </div>
                  <ProgressBar />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

import type { HealthResponse } from "../api";
import clsx from "clsx";

interface Props { health?: HealthResponse; }

export function Header({ health }: Props) {
  const online = health?.status === "ok";

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-lg">
            Ψ
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-none">Attestara</h1>
            <p className="text-xs text-gray-400 mt-0.5">Institutional DeFi Compliance Engine</p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-6">
          {health && (
            <>
              <div className="text-xs text-gray-400">
                AML: <span className="text-brand-400 font-medium">{health.amlProvider}</span>
              </div>
              <div className="text-xs text-gray-400 font-mono truncate max-w-[180px]">
                RPC: <span className="text-gray-300">{health.rpcUrl?.slice(0, 30)}…</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className={clsx(
              "w-2 h-2 rounded-full",
              online ? "bg-green-500 status-pulse" : "bg-red-500"
            )} />
            <span className="text-xs text-gray-400">{online ? "CRE Online" : "CRE Offline"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

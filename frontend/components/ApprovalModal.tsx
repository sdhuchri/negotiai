"use client";

import { useState } from "react";

export interface InterruptData {
  type: "approval" | "escalation";
  deal_price?: number;
  vendor_price?: number;
  user_price?: number;
  round_no?: number;
  lead_time_days?: number;
}

interface Props {
  interrupt: InterruptData;
  seat?: string | null; // "user" | "vendor" | null(unknown)
  busy: boolean;
  onDecide: (decision: string, amount?: number) => void;
  rp: (n?: number) => string;
}

const FIELD =
  "flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white";
const GHOST =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50";

export default function ApprovalModal({ interrupt, seat, busy, onDecide, rp }: Props) {
  const [newMax, setNewMax] = useState("");
  const [newFloor, setNewFloor] = useState("");
  const [minimized, setMinimized] = useState(false);
  const isApproval = interrupt.type === "approval";
  const showBuyer = seat !== "vendor"; // buyer can raise budget (user / unknown)
  const showSeller = seat !== "user"; // seller can lower offer (vendor / unknown)

  // Minimized: a small floating chip (no backdrop) so the transcript stays readable.
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border bg-white px-4 py-3 shadow-xl transition hover:scale-105 ${
          isApproval ? "border-amber-300 shadow-amber-500/20" : "border-red-300 shadow-red-500/20"
        }`}
      >
        <span className="animate-pulse">{isApproval ? "🟡" : "🔴"}</span>
        <span className="text-sm font-semibold text-slate-800">
          {isApproval ? "Persetujuan diperlukan" : "Eskalasi"}
        </span>
        <span className="text-xs text-slate-400">· Tinjau & putuskan</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={() => setMinimized(true)}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">
            {isApproval ? "🟡 Persetujuan diperlukan" : "🔴 Eskalasi"}
          </h3>
          <button
            onClick={() => setMinimized(true)}
            title="Minimize (baca chat dulu)"
            aria-label="Minimize"
            className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            &#x2013;
          </button>
        </div>

        {isApproval ? (
          <p className="mt-2 text-sm text-slate-600">
            Agent mencapai titik kesepakatan di{" "}
            <b className="text-slate-900">{rp(interrupt.deal_price)}</b>
            {interrupt.lead_time_days ? ` · ${interrupt.lead_time_days} hari` : ""}. Setujui
            kesepakatan ini?
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Negosiasi buntu — penjual di <b className="text-slate-900">{rp(interrupt.vendor_price)}</b>{" "}
            vs pembeli di <b className="text-slate-900">{rp(interrupt.user_price)}</b>. Salah satu
            pihak bisa bergerak untuk memecah kebuntuan, atau tolak.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {isApproval ? (
            <>
              <button
                disabled={busy}
                onClick={() => onDecide("approve")}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-105 disabled:opacity-50"
              >
                Setujui Deal
              </button>
              <button disabled={busy} onClick={() => onDecide("reject")} className={GHOST}>
                Tolak
              </button>
            </>
          ) : (
            <>
              {showBuyer && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-sky-600">
                    Sisi Pembeli — naikkan budget
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newMax}
                      onChange={(e) => setNewMax(e.target.value)}
                      inputMode="numeric"
                      placeholder="Budget baru (mis. 950000000)"
                      className={`${FIELD} focus:border-sky-400`}
                    />
                    <button
                      disabled={busy || !newMax}
                      onClick={() => onDecide("raise_limit", Number(newMax))}
                      className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition hover:brightness-105 disabled:opacity-50"
                    >
                      Naikkan
                    </button>
                  </div>
                </div>
              )}

              {showSeller && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                    Sisi Penjual — turunkan penawaran
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newFloor}
                      onChange={(e) => setNewFloor(e.target.value)}
                      inputMode="numeric"
                      placeholder="Harga baru (lebih rendah)"
                      className={`${FIELD} focus:border-amber-400`}
                    />
                    <button
                      disabled={busy || !newFloor}
                      onClick={() => onDecide("lower_floor", Number(newFloor))}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-amber-500/30 transition hover:brightness-105 disabled:opacity-50"
                    >
                      Turunkan
                    </button>
                  </div>
                </div>
              )}

              <button disabled={busy} onClick={() => onDecide("reject")} className={GHOST}>
                Tolak / Walk away
              </button>
            </>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          Klik di luar kartu untuk minimize &amp; baca chat
        </p>
      </div>
    </div>
  );
}

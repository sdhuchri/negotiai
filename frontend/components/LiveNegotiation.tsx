"use client";

import { useEffect, useRef, useState } from "react";
import Stage from "./Stage";
import ApprovalModal, { type InterruptData } from "./ApprovalModal";
import { agreementUrl, approveDecision, streamUrl, type ApproveBody, type RoomView } from "@/lib/api";
import type { NegotiationState } from "@/lib/characters";

interface RoundMsg {
  round_no: number;
  actor: "vendor" | "user";
  public_message: string;
  internal_reasoning: string;
  price: number;
  lead_time: number;
  action: string;
}

interface ResultData {
  status: string;
  price?: number;
  lead_time_days?: number;
  reason?: string;
}

function actionToState(action: string): NegotiationState {
  if (action === "accept") return "deal";
  if (action === "walk_away") return "walkaway";
  return "counter";
}

const rp = (n?: number) => (n == null ? "-" : `Rp${Math.round(n).toLocaleString("id-ID")}`);

export default function LiveNegotiation({ room }: { room: RoomView }) {
  const [transcript, setTranscript] = useState<RoundMsg[]>([]);
  const [vendorState, setVendorState] = useState<NegotiationState>("idle");
  const [userState, setUserState] = useState<NegotiationState>("idle");
  const [phase, setPhase] = useState("");
  const [interrupt, setInterrupt] = useState<InterruptData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seat, setSeat] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeat(localStorage.getItem(`negotiai:room:${room.id}:seat`));
    } catch {}
  }, [room.id]);

  useEffect(() => {
    const es = new EventSource(streamUrl(room.id));
    es.onmessage = (ev) => {
      let m: { type: string; [k: string]: unknown };
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (m.type) {
        case "phase":
          setPhase(String(m.phase));
          break;
        case "round": {
          const r = m.round as RoundMsg;
          setTranscript((t) => [...t, r]);
          setInterrupt(null); // a new round means the negotiation resumed past any interrupt
          if (r.actor === "vendor") {
            setVendorState(actionToState(r.action));
            setUserState("idle");
          } else {
            setUserState(actionToState(r.action));
            setVendorState("idle");
          }
          break;
        }
        case "interrupt":
          setInterrupt(m.interrupt as InterruptData);
          break;
        case "settled": {
          const res = m.result as ResultData;
          setResult(res);
          setInterrupt(null);
          const st: NegotiationState = res?.status === "deal" ? "deal" : "walkaway";
          setVendorState(st);
          setUserState(st);
          break;
        }
        case "error":
          setError(String(m.message));
          break;
      }
    };
    return () => es.close();
  }, [room.id]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript.length]);

  async function decide(decision: string, amount?: number) {
    setBusy(true);
    try {
      const body: ApproveBody = { decision, by: seat ?? "user" };
      if (amount) {
        if (decision === "lower_floor") body.new_floor_price = amount;
        else body.new_max_price = amount; // raise_limit / adjust
      }
      await approveDecision(room.id, body);
      setInterrupt(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim keputusan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Stage
        backgroundKey={room.background_key}
        vendor={{ charKey: room.vendor.avatar_id, state: vendorState, name: room.vendor.name || "Vendor" }}
        user={{ charKey: room.user.avatar_id, state: userState, name: room.user.name || "User" }}
      />

      {phase === "analyzing" && transcript.length === 0 && (
        <p className="mt-4 animate-pulse text-center text-sm text-slate-500">
          🧠 AI sedang menganalisa input kedua pihak…
        </p>
      )}

      <div
        ref={feedRef}
        className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-inner"
      >
        {transcript.length === 0 && (
          <p className="text-center text-sm text-slate-400">Menunggu ronde pertama…</p>
        )}
        {transcript.map((r, i) => (
          <div key={i} className={`flex ${r.actor === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl border px-4 py-2.5 ${
                r.actor === "user"
                  ? "border-sky-200 bg-sky-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={r.actor === "user" ? "text-sky-700" : "text-amber-700"}>
                  {r.actor === "user" ? room.user.name : room.vendor.name}
                </span>
                <span className="text-slate-400">· {rp(r.price)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-800">{r.public_message}</p>
              {r.internal_reasoning && r.round_no > 0 && (
                <p className="mt-1 text-[11px] italic text-slate-400">💭 {r.internal_reasoning}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {result && (
        <div
          className={`mt-4 rounded-2xl border p-4 shadow-lg ${
            result.status === "deal"
              ? "border-emerald-200 bg-emerald-50 shadow-emerald-900/5"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          {result.status === "deal" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-emerald-800">
                ✅ Deal tercapai di <b>{rp(result.price)}</b>
                {result.lead_time_days ? ` · ${result.lead_time_days} hari` : ""}.
              </p>
              <a
                href={agreementUrl(room.id)}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-105"
              >
                Unduh PDF Kesepakatan
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              ⚫ Negosiasi berakhir tanpa kesepakatan ({result.reason || "walked away"}).
            </p>
          )}
        </div>
      )}

      {interrupt && !result && (
        <ApprovalModal
          key={`${interrupt.type}-${interrupt.round_no}`}
          interrupt={interrupt}
          seat={seat}
          busy={busy}
          onDecide={decide}
          rp={rp}
        />
      )}
    </div>
  );
}

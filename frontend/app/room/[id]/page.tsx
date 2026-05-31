"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LobbyStage from "@/components/LobbyStage";
import LiveNegotiation from "@/components/LiveNegotiation";
import { getRoom, startNegotiation, type RoomView } from "@/lib/api";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "🟡 Menunggu vendor", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  ready: { text: "🟢 Kedua pihak siap", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  negotiating: { text: "🟢 Negotiating", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  awaiting_approval: { text: "🟡 Menunggu approval", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  escalated: { text: "🔴 Eskalasi", cls: "border-red-200 bg-red-50 text-red-700" },
  deal: { text: "✅ Deal", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  walked_away: { text: "⚫ Walked away", cls: "border-slate-200 bg-slate-100 text-slate-500" },
};

const LIVE = new Set(["negotiating", "awaiting_approval", "escalated", "deal", "walked_away"]);

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await getRoom(id);
        if (alive) setRoom(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat room");
      }
    };
    tick();
    const iv = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  useEffect(() => {
    if (room) setShareUrl(`${window.location.origin}/join/${room.share_token}`);
  }, [room]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function start() {
    setStarting(true);
    setStartErr(null);
    try {
      await startNegotiation(id);
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Gagal memulai");
    } finally {
      setStarting(false);
    }
  }

  if (error)
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline">
            ← Buat room baru
          </Link>
        </div>
      </main>
    );

  if (!room)
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="animate-pulse text-slate-400">Memuat ruang…</p>
      </main>
    );

  const status = STATUS_LABEL[room.status] ?? { text: room.status, cls: "border-slate-200 bg-slate-100 text-slate-500" };
  const bothReady = room.user.ready && room.vendor.ready;
  const isLive = LIVE.has(room.status);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="text-xs font-medium text-slate-400 transition hover:text-sky-600">
              ← NegotiAI
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{room.title}</h1>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.cls}`}>
            {status.text}
          </span>
        </header>

        {isLive ? (
          <LiveNegotiation room={room} />
        ) : (
          <>
            <LobbyStage backgroundKey={room.background_key} user={room.user} vendor={room.vendor} />

            {!room.vendor.ready && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-sky-900/5">
                <p className="text-sm font-semibold text-slate-700">🔗 Bagikan link ini ke pihak lawan:</p>
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                  />
                  <button
                    onClick={copy}
                    className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-105"
                  >
                    {copied ? "Tersalin ✓" : "Salin"}
                  </button>
                </div>
              </div>
            )}

            {bothReady && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-lg shadow-emerald-900/5">
                <p className="text-sm font-medium text-emerald-800">
                  ✨ Kedua pihak sudah di ruang. AI akan menganalisa input lalu menegosiasikannya.
                </p>
                <button
                  onClick={start}
                  disabled={starting}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-105 disabled:opacity-50"
                >
                  {starting ? "Memulai…" : "Mulai Negosiasi 🚀"}
                </button>
              </div>
            )}
            {startErr && <p className="mt-2 text-sm text-red-600">{startErr}</p>}
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RoomForm, { type RoomFormData } from "@/components/RoomForm";
import { createRoom } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(data: RoomFormData) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("title", data.title);
      fd.set("name", data.name);
      fd.set("avatar_id", data.avatar);
      fd.set("raw_text", data.rawText);
      if (data.file) fd.set("file", data.file);
      const { room, user_token } = await createRoom(fd);
      try {
        localStorage.setItem(`negotiai:room:${room.id}:seat`, "user");
        localStorage.setItem(`negotiai:room:${room.id}:token`, user_token);
      } catch {}
      router.push(`/room/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat room");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-600 shadow-sm ring-1 ring-sky-100">
              🤝 NegotiAI
            </span>
            <Link
              href="/stage"
              className="text-xs font-medium text-slate-400 transition hover:text-sky-600"
            >
              Stage playground →
            </Link>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
            Buat Ruang{" "}
            <span className="bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">
              Negosiasi
            </span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Pilih karakter &amp; nama kamu, jelaskan kebutuhanmu, lalu bagikan link ke pihak lawan.
            AI akan menganalisa input kedua pihak dan menegosiasikannya untukmu.
          </p>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-sky-900/5 sm:p-8">
          <RoomForm
            tone="sky"
            submitLabel="Buat Room & Dapatkan Link"
            showTitle
            defaultAvatar="capybara"
            intakePlaceholder="mis. Butuh 10 unit server, budget sekitar 900jt, prioritas harga, lead time maks 45 hari, termin NET30."
            busy={busy}
            error={error}
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </main>
  );
}

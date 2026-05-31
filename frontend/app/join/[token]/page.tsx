"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import RoomForm, { type RoomFormData } from "@/components/RoomForm";
import { getRoomByToken, joinRoom, type RoomView } from "@/lib/api";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRoomByToken(token)
      .then(setRoom)
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Room tidak ditemukan"));
  }, [token]);

  async function handleJoin(data: RoomFormData) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("name", data.name);
      fd.set("avatar_id", data.avatar);
      fd.set("raw_text", data.rawText);
      if (data.file) fd.set("file", data.file);
      const { room: joined, vendor_token } = await joinRoom(token, fd);
      try {
        localStorage.setItem(`negotiai:room:${joined.id}:seat`, "vendor");
        localStorage.setItem(`negotiai:room:${joined.id}:token`, vendor_token);
      } catch {}
      router.push(`/room/${joined.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal bergabung");
      setBusy(false);
    }
  }

  if (loadErr)
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-red-600">{loadErr}</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline">
            ← Ke beranda
          </Link>
        </div>
      </main>
    );

  if (!room)
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="animate-pulse text-slate-400">Memuat undangan…</p>
      </main>
    );

  if (room.vendor.ready)
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-slate-600">Ruang ini sudah memiliki pihak vendor.</p>
          <Link
            href={`/room/${room.id}`}
            className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline"
          >
            Lihat ruang →
          </Link>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 shadow-sm ring-1 ring-amber-100">
            ✉️ Undangan Negosiasi
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">{room.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">{room.user.name}</span> mengundangmu
            bernegosiasi. Pilih karaktermu, isi nama, dan jelaskan penawaranmu.
          </p>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-amber-900/5 sm:p-8">
          <RoomForm
            tone="amber"
            submitLabel="Gabung & Kirim Penawaran"
            defaultAvatar="penguin"
            intakePlaceholder="mis. Penawaran 10 server @95jt (total 950jt), garansi 1 tahun, termin NET30, lead time 30 hari."
            busy={busy}
            error={error}
            onSubmit={handleJoin}
          />
        </div>
      </div>
    </main>
  );
}

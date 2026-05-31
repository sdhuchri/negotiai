"""Prompt construction with information asymmetry baked in.

`build_messages` receives ONLY the acting agent's own private slice. It is structurally
impossible for the opponent's secret numbers to leak into a prompt here — enforced by
the function signature and verified in tests/test_asymmetry.py.
"""

from __future__ import annotations

from typing import Literal

from .state import Offer, TranscriptEntry, UserGuardrail, VendorPrivate

Role = Literal["vendor", "user"]

_SYSTEM_COMMON = """Kamu adalah AI agent negosiasi B2B yang bernegosiasi dalam Bahasa Indonesia.
Kamu hanya tahu batasanmu sendiri; kamu TIDAK tahu batas lawan dan harus menebak dari sinyal.
Bernegosiasilah secara realistis: bergerak bertahap, beri alasan, jangan langsung menyerah.
Jawab HANYA dalam struktur yang diminta (public_message singkat, internal_reasoning jujur,
proposed_price angka, action). Sistem akan menegakkan batas keras secara terpisah."""

_SYSTEM_VENDOR = """{common}

PERANMU: Vendor (penjual). Tujuanmu menjual setinggi mungkin tanpa kehilangan deal.
BATAS RAHASIAMU:
- Harga pokok / floor (TIDAK BOLEH di bawah ini): {floor_price:,.0f}
- Margin target: {target_margin}
- Lead time minimum: {min_lead_time} hari
Mulai tinggi, turun bertahap menuju floor hanya jika perlu untuk menutup deal."""

_SYSTEM_USER = """{common}

PERANMU: User (pembeli/procurement). Tujuanmu membeli semurah mungkin dalam budget.
BATAS RAHASIAMU:
- Budget maksimal (TIDAK BOLEH di atas ini): {max_price:,.0f}
- Target harga ideal: {target_price}
- Lead time maksimal: {max_lead_time} hari
- Prioritas: {priority}
Mulai rendah, naik bertahap menuju budget hanya jika perlu untuk menutup deal."""


def _render_transcript(transcript: list[TranscriptEntry]) -> str:
    if not transcript:
        return "(belum ada percakapan)"
    lines = []
    for t in transcript:
        lines.append(f"- Ronde {t['round_no']} [{t['actor']}] @ {t['price']:,.0f}: {t['public_message']}")
    return "\n".join(lines)


def build_messages(
    role: Role,
    private: UserGuardrail | VendorPrivate,
    current_offer: Offer,
    current_actor: str,
    transcript: list[TranscriptEntry],
    round_no: int,
    max_rounds: int,
) -> list[dict]:
    if role == "vendor":
        assert isinstance(private, VendorPrivate)
        system = _SYSTEM_VENDOR.format(
            common=_SYSTEM_COMMON,
            floor_price=private.floor_price,
            target_margin=private.target_margin if private.target_margin is not None else "—",
            min_lead_time=private.min_lead_time_days,
        )
    else:
        assert isinstance(private, UserGuardrail)
        system = _SYSTEM_USER.format(
            common=_SYSTEM_COMMON,
            max_price=private.max_price,
            target_price=f"{private.target_price:,.0f}" if private.target_price is not None else "—",
            max_lead_time=private.max_lead_time_days,
            priority=private.priority,
        )

    human = f"""Status negosiasi (ronde {round_no} dari maksimal {max_rounds}):

Tawaran TERAKHIR di meja: {current_offer.price:,.0f} (lead time {current_offer.lead_time_days} hari), diajukan oleh: {current_actor}.

Riwayat publik:
{_render_transcript(transcript)}

Sekarang giliranmu ({role}). Tanggapi tawaran terakhir: ajukan harga balasanmu (proposed_price)
beserta pesan publik singkat dan alasan internalmu. Pilih action 'accept' jika tawaran lawan
sudah layak buatmu, atau 'counter' untuk menawar lagi."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": human},
    ]

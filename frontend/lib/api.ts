// Client for the Go backend (room/lobby API).
export const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8090";
const BASE = BACKEND_BASE;

export const streamUrl = (id: string) => `${BASE}/api/rooms/${id}/stream`;
export const agreementUrl = (id: string) => `${BASE}/api/rooms/${id}/agreement.pdf`;

export interface Seat {
  name: string;
  avatar_id: string;
  ready: boolean;
}

export interface RoomView {
  id: string;
  title: string;
  status: string;
  background_key?: string;
  share_token: string;
  user: Seat;
  vendor: Seat;
}

export interface CreateResponse {
  room: RoomView;
  user_token: string;
}

export interface JoinResponse {
  room: RoomView;
  vendor_token: string;
}

async function asError(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    return new Error(body.error || `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

export async function createRoom(form: FormData): Promise<CreateResponse> {
  const res = await fetch(`${BASE}/api/rooms`, { method: "POST", body: form });
  if (!res.ok) throw await asError(res);
  return res.json();
}

export async function getRoom(id: string): Promise<RoomView> {
  const res = await fetch(`${BASE}/api/rooms/${id}`, { cache: "no-store" });
  if (!res.ok) throw await asError(res);
  return res.json();
}

export async function getRoomByToken(token: string): Promise<RoomView> {
  const res = await fetch(`${BASE}/api/rooms/by-token/${token}`, { cache: "no-store" });
  if (!res.ok) throw await asError(res);
  return res.json();
}

export async function joinRoom(token: string, form: FormData): Promise<JoinResponse> {
  const res = await fetch(`${BASE}/api/rooms/${token}/join`, { method: "POST", body: form });
  if (!res.ok) throw await asError(res);
  return res.json();
}

export async function startNegotiation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/rooms/${id}/start`, { method: "POST" });
  if (!res.ok) throw await asError(res);
}

export interface ApproveBody {
  decision: string; // approve | reject | adjust | raise_limit | lower_floor
  by?: string;
  new_max_price?: number; // for raise_limit / adjust (buyer)
  new_floor_price?: number; // for lower_floor (seller)
}

export async function approveDecision(id: string, body: ApproveBody): Promise<void> {
  const res = await fetch(`${BASE}/api/rooms/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await asError(res);
}

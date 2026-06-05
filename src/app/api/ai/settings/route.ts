export const runtime = "nodejs";

// Thin proxy to the collection server's /ai-settings endpoint.
// Passes the bearer token through so the Rust handler can identify the user.

const API_URL = process.env.API_URL ?? "http://localhost:8082";

function forwardHeaders(req: Request): HeadersInit {
  const auth = req.headers.get("authorization");
  return {
    "Content-Type": "application/json",
    ...(auth ? { Authorization: auth } : {}),
  };
}

export async function GET(req: Request) {
  const res = await fetch(`${API_URL}/ai-settings`, {
    headers: forwardHeaders(req),
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${API_URL}/ai-settings`, {
    method: "POST",
    headers: forwardHeaders(req),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function DELETE(req: Request) {
  const res = await fetch(`${API_URL}/ai-settings`, {
    method: "DELETE",
    headers: forwardHeaders(req),
  });
  return new Response(null, { status: res.status });
}

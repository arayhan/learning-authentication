import type { Flow } from "@/components/flow/types";
import { m1Flows } from "./m1";
import { m2Flows } from "./m2";
import { m3Flows } from "./m3";

const demo: Flow = {
  id: "demo",
  title: "Login dengan session cookie",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    {
      from: "browser",
      to: "server",
      label: "POST /login",
      http: "POST /login HTTP/1.1\nHost: app.example.com\nContent-Type: application/json\n\n{\"email\":\"sam@example.com\",\"password\":\"correct horse\"}",
      note: "Browser mengirim credential lewat HTTPS.",
    },
    { from: "server", to: "db", label: "SELECT user", note: "Server mencari user berdasarkan email." },
    { from: "server", to: "server", label: "verify hash", note: "Dia mengecek password terhadap hash argon2id yang tersimpan." },
    { from: "server", to: "db", label: "INSERT session", note: "Hanya hash dari session token yang disimpan." },
    {
      from: "server",
      to: "browser",
      label: "200 + Set-Cookie",
      http: "HTTP/1.1 200 OK\nSet-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Lax; Path=/",
      note: "Cookie itu HttpOnly, jadi script di halaman nggak bisa membacanya.",
    },
  ],
};

export const flows = { demo, ...m1Flows, ...m2Flows, ...m3Flows } satisfies Record<string, Flow>;

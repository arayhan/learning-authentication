import type { Flow } from "@/components/flow/types";
import { m1Flows } from "./m1";
import { m2Flows } from "./m2";
import { m3Flows } from "./m3";

const demo: Flow = {
  id: "demo",
  title: "Login with a session cookie",
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
      note: "The browser sends the credentials over HTTPS.",
    },
    { from: "server", to: "db", label: "SELECT user", note: "The server looks the user up by email." },
    { from: "server", to: "server", label: "verify hash", note: "It checks the password against the stored argon2id hash." },
    { from: "server", to: "db", label: "INSERT session", note: "Only the hash of the session token is stored." },
    {
      from: "server",
      to: "browser",
      label: "200 + Set-Cookie",
      http: "HTTP/1.1 200 OK\nSet-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Lax; Path=/",
      note: "The cookie is HttpOnly, so page scripts cannot read it.",
    },
  ],
};

export const flows = { demo, ...m1Flows, ...m2Flows, ...m3Flows } satisfies Record<string, Flow>;

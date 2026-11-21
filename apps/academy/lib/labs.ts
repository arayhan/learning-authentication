import type { LabId } from "./course/types";

export type Impl = "go" | "ts";

type Lab = {
  title: string;
  ports: { go: number; ts: number };
  traceUrl(impl: Impl): string;
  startCmd(impl: Impl): string;
};

// lab03's trace stream and console traffic go to the authorization server port.
const lab = (title: string, ports: Lab["ports"], id: LabId): Lab => ({
  title,
  ports,
  traceUrl: (impl) => `http://127.0.0.1:${ports[impl]}/__trace`,
  startCmd: (impl) => `pnpm lab ${id} --${impl}`,
});

export const labs: Record<LabId, Lab> = {
  "01": lab("Sessions", { go: 4101, ts: 4201 }, "01"),
  "02": lab("JWT", { go: 4102, ts: 4202 }, "02"),
  "03": lab("OAuth + PKCE", { go: 4103, ts: 4203 }, "03"),
};

export const labBase = (id: LabId, impl: Impl) => `http://127.0.0.1:${labs[id].ports[impl]}`;

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/auth/origin";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { resolveRef } from "@/lib/course/registry";
import type { XpEvent } from "@/lib/course/types";
import { award, getProgress, QuizFailed, safeTz } from "@/lib/game/award";

const ref = z.string().max(128);
const answers = z.array(z.number().int().min(0)).max(50);
const Body = z.object({
  event: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("step"), ref }),
    z.object({ kind: z.literal("quiz"), ref, answers }),
    z.object({ kind: z.literal("lab-task"), ref }),
    z.object({ kind: z.literal("attack"), ref }),
    z.object({ kind: z.literal("boss"), ref, answers, elapsedMs: z.number().int().min(0) }),
  ]),
  tz: z.string().max(64).optional(),
});

const userOf = (req: NextRequest) => getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(req: NextRequest) {
  const user = await userOf(req);
  if (!user) return unauthorized();
  return NextResponse.json(await getProgress(user.id, safeTz(req.nextUrl.searchParams.get("tz") ?? undefined)));
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const user = await userOf(req);
  if (!user) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const event = parsed.data.event as XpEvent;
  if (resolveRef(event.ref)?.kind !== event.kind) return NextResponse.json({ error: "Unknown ref" }, { status: 400 });

  try {
    return NextResponse.json(await award(user.id, event, safeTz(parsed.data.tz)));
  } catch (e) {
    if (e instanceof QuizFailed) return NextResponse.json({ score: e.score, total: e.total, passed: false }, { status: 422 });
    throw e;
  }
}

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l4",
  module: "m3",
  slug: "pkce",
  title: "PKCE",
  minutes: 35,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "generator", title: "Bikin challenge" },
    { id: "check", title: "Cek" },
    { id: "lab", title: "Lab" },
    { id: "breakit", title: "Break it" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Dengan PKCE dan S256, apa yang dikirim client di request /authorize?",
          choices: [
            "code_verifier itu sendiri",
            "code_challenge = BASE64URL(SHA-256(code_verifier)) with code_challenge_method=S256",
            "client_secret, untuk membuktikan siapa dia",
            "Signature dari verifier yang dibuat dengan private key",
          ],
          answer: 1,
          why: "Verifier adalah secret acak yang tetap di client. Hanya hash SHA-256-nya, yang di-encode base64url, yang keluar lewat front channel. Karena hash itu satu arah, melihat challenge nggak membuat siapa pun bisa menghasilkan verifier.",
        },
        {
          prompt: "Attacker mencuri authorization code dari URL redirect, tapi nggak pernah melihat verifier. Apa yang terjadi saat dia memanggil /token?",
          choices: [
            "Token diterbitkan, karena code-nya valid",
            "Token diterbitkan, tapi dengan scope lebih sedikit",
            "Server meminta user menyetujui lagi",
            "Server menjawab invalid_grant, karena verifier yang hilang nggak di-hash menjadi challenge yang tersimpan",
          ],
          answer: 3,
          why: "Code terikat ke challenge yang dikirim bersama authorization request. Tanpa verifier yang di-hash menjadi challenge itu, penukaran gagal. Di lab percobaan yang gagal nggak menghanguskan code, jadi pencuri juga nggak bisa mengunci app asli.",
        },
        {
          prompt: "Kenapa code_challenge_method=plain tidak dianjurkan?",
          choices: [
            "Server nggak bisa menyimpannya",
            "Lebih lambat dari S256",
            "Challenge sama dengan verifier, jadi siapa pun yang bisa melihat authorization request, paparan yang sama yang dijaga PKCE, bisa menukar code",
            "Verifier plain harus lebih pendek dari 43 karakter",
          ],
          answer: 2,
          why: "PKCE ada karena front channel bisa diamati. Dengan plain, secret lewat channel yang sama itu. RFC 7636 mengizinkan plain hanya untuk client yang secara teknis nggak bisa hash, dan RFC 9700 bilang pakai S256.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "token-400-bad-verifier",
      label: "Tukar dengan verifier yang salah dan dapat invalid_grant (POST /token mengembalikan 400)",
      lab: "03",
      hint: "Klik Tes verifier yang salah di generator. Untuk menguji dengan code asli, tempel code ke generator dulu, atau pakai perintah curl di langkah Lab.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 400 && (e.req.body ?? "").includes("grant_type=authorization_code") && (e.req.body ?? "").includes("code_verifier=") && (e.res.body ?? "").includes("invalid_grant"),
    },
  ],
  attacks: [{ id: "code-interception", title: "Intersepsi authorization code", kind: "live" }],
};

export default lesson;

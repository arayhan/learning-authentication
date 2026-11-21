import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l2",
  module: "m2",
  slug: "signing-jwks",
  title: "Signing & JWKS",
  minutes: 25,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "algorithms", title: "Algoritma" },
    { id: "jwks", title: "Mempublikasikan key" },
    { id: "check", title: "Cek pemahaman" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Ada lima service yang harus memverifikasi token dari satu identity provider. Setup mana yang membuat kekuatan untuk men-sign paling terbatas?",
          choices: [
            "HS256 dengan secret yang sama disalin ke kelima service",
            "RS256 atau ES256: hanya identity provider yang memegang private key, kelima service cuma memegang public key",
            "RS256 dengan private key disalin ke kelima service",
            "Tanpa signature, dan mengandalkan TLS antar service",
          ],
          answer: 1,
          why: "Dengan shared secret HMAC, setiap verifier juga bisa membuat token, jadi satu service yang bobol menjebol semuanya. Dengan pasangan asimetris, verifikasi cukup butuh public key, dan hanya issuer yang bisa men-sign.",
        },
        {
          prompt: "Kenapa aman menyajikan JWKS ke siapa saja, tanpa authentication?",
          choices: [
            "Karena key di dalamnya terenkripsi",
            "Karena browser menolak membacanya kecuali origin-nya diizinkan",
            "Karena isinya hanya public key, yang bisa memverifikasi signature tapi nggak bisa membuatnya",
            "Karena endpoint JWKS kena rate limit",
          ],
          answer: 2,
          why: "JWKS berisi daftar public key. Tahu public key nggak membuat siapa pun bisa men-sign. Justru itu tujuan dipublikasikan: verifier mana pun bisa mengambilnya tanpa secret.",
        },
        {
          prompt: "Issuer berganti ke signing key baru (rotate). Apa yang harus dilakukan verifier saat melihat token dengan kid yang belum dikenal?",
          choices: [
            "Tolak token itu selamanya",
            "Terima token karena algoritma signature-nya valid",
            "Ambil ulang JWKS (dengan rate limit) lalu cari kid itu lagi",
            "Ambil key sembarang dari cache dan coba satu per satu sampai ada yang cocok",
          ],
          answer: 2,
          why: "kid ada supaya verifier bisa menemukan key yang tepat, dan kid baru biasanya berarti ada rotation. JWKS yang di-cache dengan refetch saat ketemu kid asing membuat key bisa dirotasi tanpa restart service. Rate limit pada refetch mencegah attacker memicu banjir request dengan kid acak.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "jwks-fetched",
      label: "Ambil public key: GET /.well-known/jwks.json mengembalikan 200",
      lab: "02",
      hint: "Klik Ambil JWKS. Cek response-nya: satu key RSA dengan kid, alg RS256, dan use sig.",
      match: (e) => e.req.method === "GET" && e.req.path === "/.well-known/jwks.json" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;

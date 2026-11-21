import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l5",
  module: "m2",
  slug: "jwt-attacks",
  title: "Menyerang Verifikasi JWT",
  minutes: 30,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "flaws", title: "Katalog serangan" },
    { id: "check", title: "Cek pemahaman" },
    { id: "breakit", title: "Bobol sendiri" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Kenapa verifier harus menentukan sendiri algoritma yang diizinkan, bukan membaca alg dari token?",
          choices: [
            "Header alg dipilih oleh siapa pun yang membuat token, jadi attacker bisa meminta none atau algoritma yang lebih lemah",
            "Membaca header lebih lambat daripada konfigurasi tetap",
            "Header alg terenkripsi dan nggak bisa dibaca sebelum verifikasi",
            "Kebanyakan library nggak mendukung lebih dari satu algoritma",
          ],
          answer: 0,
          why: "Header adalah bagian dari input yang nggak dipercaya. Verifier yang menurutinya membiarkan attacker memilih pengecekan yang akan diterapkan ke token buatannya sendiri. RFC 8725 bilang verifier harus mem-pin algoritma yang dia terima.",
        },
        {
          prompt: "Bagaimana serangan key confusion RS256 ke HS256 bekerja?",
          choices: [
            "Attacker menjebol RSA dengan memfaktorkan public key",
            "Attacker mencuri private key dari endpoint JWKS",
            "Attacker mengganti signature dengan byte acak",
            "Attacker men-sign token dengan HS256, memakai public key server sebagai secret HMAC, lalu men-set alg ke HS256 supaya verifier yang ceroboh melakukan hal yang sama",
          ],
          answer: 3,
          why: "Public key itu publik, jadi attacker bisa memakainya sebagai secret HMAC. Verifier yang memilih algoritma dari header, dan menyerahkan satu variabel 'key'-nya ke algoritma apa pun yang diminta, akan memeriksa pemalsuan itu dengan byte yang sama lalu menerimanya.",
        },
        {
          prompt: "Sebuah token punya signature RS256 yang valid dari issuer kamu sendiri, tapi exp-nya sudah lewat satu jam lalu. API kamu hanya memverifikasi signature. Apa yang salah?",
          choices: [
            "Nggak ada: signature valid sudah cukup",
            "Token expired diterima, jadi token curian nggak pernah berhenti berfungsi, dan token yang dibuat untuk audience lain ikut diterima",
            "API crash karena exp-nya sudah lewat",
            "Signature berhenti lolos verifikasi begitu exp lewat",
          ],
          answer: 1,
          why: "Signature cuma membuktikan issuer pernah membuat token itu. Apakah token masih valid, dan apakah memang untuk API ini, dibawa oleh exp, aud, dan iss, dan verifier harus mengeceknya. Kalau dilewati, setiap token lama atau token asing jadi token yang berfungsi.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [
    { id: "alg-none", title: "Pemalsuan alg: none", kind: "live" },
    { id: "key-confusion", title: "Key confusion RS256 ke HS256", kind: "live" },
    { id: "expired", title: "Token expired tetap diterima", kind: "live" },
  ],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l1",
  module: "m2",
  slug: "jwt-anatomy",
  title: "Anatomi JWT",
  minutes: 20,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "claims", title: "Claims" },
    { id: "tradeoff", title: "Session atau token?" },
    { id: "check", title: "Cek pemahaman" },
    { id: "decode", title: "Decode sebuah token" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Payload JWT itu di-encode pakai base64url. Artinya apa buat data di dalamnya?",
          choices: [
            "Terenkripsi, jadi cuma server yang bisa baca",
            "Siapa pun yang pegang token bisa decode dan baca, jadi jangan taruh secret di dalamnya",
            "Di-hash, jadi nggak bisa dikembalikan jadi JSON",
            "Cuma bisa dibaca oleh browser yang menerimanya",
          ],
          answer: 1,
          why: "Base64url itu encoding, bukan enkripsi. Signature mencegah payload diubah orang, tapi nggak menyembunyikannya. Apa pun yang kamu taruh di JWT yang di-sign bisa dibaca semua pemegangnya. (JWT terenkripsi namanya JWE, formatnya beda.)",
        },
        {
          prompt: "Signature di JWT melindungi apa?",
          choices: [
            "Kerahasiaan claims",
            "Integritas dan asal header + payload: verifier bisa tahu isinya nggak diubah dan siapa yang menandatangani",
            "Token dari risiko disalin dan dipakai ulang orang lain",
            "Token supaya nggak pernah expire",
          ],
          answer: 1,
          why: "Signature dihitung dari header dan payload. Ubah satu byte saja, verifikasi gagal. Tapi signature nggak bilang apa-apa soal siapa yang menyodorkan token: token hasil salinan tetap valid, makanya JWT disebut bearer token.",
        },
        {
          prompt: "API menerima sebuah JWT. Fakta mana yang sendirian sudah menunjukkan bahwa token ini memang ditujukan untuk API ini?",
          choices: [
            "Token di-sign oleh key yang dipercaya API",
            "Claim sub berisi user id yang dikenal",
            "Claim aud menyebut API ini",
            "Claim exp masih di masa depan",
          ],
          answer: 2,
          why: "Signature valid cuma membuktikan issuer yang membuat token. aud yang bilang token itu dibuat untuk API mana. Tanpa pengecekan ini, token yang diterbitkan untuk satu service bisa dipakai ulang ke service lain dari issuer yang sama.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

/** Location header (string or list), as the trace records it with lowercase names. */
const location = (h: Record<string, string | string[]>) => [h.location ?? []].flat().join(" ");

const lesson: LessonMeta = {
  id: "m3-l2",
  module: "m3",
  slug: "auth-code-flow",
  title: "Authorization Code Flow",
  minutes: 30,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "check", title: "Cek" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Kenapa authorization server mengirim browser balik dengan code, bukan access token-nya langsung?",
          choices: [
            "Code lebih pendek dari token",
            "Redirect lewat URL browser, yang bocor ke history, log, dan app lain. Code adalah tiket pendek sekali pakai yang ditukar lewat back channel langsung",
            "HTTP tidak mengizinkan token di dalam redirect",
            "Kalau tidak, user harus login dua kali",
          ],
          answer: 1,
          why: "Semua yang ada di URL redirect terekspos ke browser dan apa pun di sekitarnya. Code yang berlaku semenit, hanya bisa dipakai sekali, dan terikat ke client dan redirect_uri membatasi nilai kebocoran, sementara token aslinya dikirim ke tempat yang hanya bisa dibaca client: response dari back-channel request miliknya sendiri.",
        },
        {
          prompt: "Sebuah request masuk ke /authorize dengan redirect_uri yang tidak terdaftar untuk client. Apa yang harus dilakukan server?",
          choices: [
            "Redirect ke URI itu dengan error=invalid_request",
            "Redirect ke URI pertama yang terdaftar milik client",
            "Tampilkan halaman error ke user dan jangan redirect ke mana pun",
            "Terima saja, karena client_id-nya valid",
          ],
          answer: 2,
          why: "RFC 6749 section 4.1.2.1: kalau client_id atau redirect_uri hilang, tidak valid, atau tidak cocok, server tidak boleh redirect. Me-redirect ke URI yang belum diverifikasi menjadikan authorization server sebuah open redirector. Hanya setelah dua pengecekan itu, error dikirim balik sebagai redirect ?error=...",
        },
        {
          prompt: "Sebuah authorization code diajukan ke /token untuk kedua kalinya. Apa yang diharapkan RFC 6749 dari server?",
          choices: [
            "Terbitkan token lagi, karena code boleh dipakai ulang selama 10 menit",
            "Abaikan request itu diam-diam",
            "Perpanjang umur code supaya client bisa mencoba lagi",
            "Tolak, dan kalau bisa cabut token yang sudah diterbitkan dari code itu",
          ],
          answer: 3,
          why: "Code harus sekali pakai. Pengajuan kedua berarti dua pihak sudah melihatnya, jadi server nggak bisa membedakan pencuri dari client dan sebaiknya memutus apa yang dihasilkan penukaran pertama. Lab melakukannya dalam satu transaction dan menjawab invalid_grant.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "authorize-302-code",
      label: "Setujui akses dan di-redirect dengan code (POST /consent mengembalikan 302 dengan ?code=)",
      lab: "03",
      hint: "Buka client SPA, klik Sign in with Demo AS, login sebagai alice@example.com lalu klik Approve. Baris POST /consent di Inspector punya code di header Location-nya.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/consent" && e.res.status === 302 && /[?&]code=[^&\s]+/.test(location(e.res.headers)),
    },
    {
      id: "token-200",
      label: "Tukar code dengan access token (POST /token mengembalikan 200)",
      lab: "03",
      hint: "SPA melakukannya sendiri saat kembali ke /callback. Cari POST /token di Inspector: request-nya punya grant_type=authorization_code, response-nya berisi access_token.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 200 && (e.req.body ?? "").includes("grant_type=authorization_code") && (e.res.body ?? "").includes("access_token"),
    },
    {
      id: "api-200-bearer",
      label: "Panggil API dengan token itu (GET /api/photos mengembalikan 200)",
      lab: "03",
      hint: "Langkah terakhir SPA. Request membawa Authorization: Bearer <access token> dan API menjawab dengan tiga foto.",
      match: (e) => e.role === "api" && e.req.method === "GET" && e.req.path === "/api/photos" && e.res.status === 200 && /^bearer\s+\S+/i.test(e.req.headers.authorization ?? ""),
    },
  ],
  attacks: [],
};

export default lesson;

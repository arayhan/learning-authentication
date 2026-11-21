import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l6",
  module: "m3",
  slug: "client-credentials",
  title: "Client Credentials",
  minutes: 25,
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
          prompt: "Grant mana yang cocok untuk job backend malam hari yang membaca data saat tidak ada user?",
          choices: [
            "Client credentials",
            "Authorization code with PKCE",
            "Implicit",
            "Resource owner password credentials",
          ],
          answer: 0,
          why: "Client credentials (RFC 6749 section 4.4) membuat confidential client bisa mendapat token untuk dirinya sendiri memakai secret-nya, tanpa browser dan tanpa consent. Authorization code flow butuh user di browser, dan grant implicit serta password sudah dihapus dari OAuth 2.1.",
        },
        {
          prompt: "RFC 6749 bilang response client credentials sebaiknya tidak menyertakan refresh token. Kenapa?",
          choices: [
            "Refresh token nggak bisa dikirim dengan HTTP Basic authentication",
            "Client bisa mengautentikasi lagi kapan saja, jadi refresh token berumur panjang menambah risiko tanpa kemudahan",
            "Access token dari grant ini nggak pernah kedaluwarsa",
            "Refresh token hanya jalan untuk access token JWT",
          ],
          answer: 1,
          why: "Refresh token ada supaya user nggak perlu login lagi. Di sini nggak ada user: client tinggal mengulang request dengan secret-nya saat access token kedaluwarsa. Credential tambahan berumur panjang cuma jadi satu hal lagi yang bisa dicuri.",
        },
        {
          prompt: "Sebuah service mau mengambil foto alice hanya dengan client credentials. Apa masalahnya?",
          choices: [
            "Token akan ditolak oleh semua API",
            "Client credentials hanya jalan lewat HTTP, bukan HTTPS",
            "Fotonya akan datang tanpa scope",
            "Token mengidentifikasi client itu sendiri (sub-nya adalah client id), bukan alice, jadi nggak bisa mewakilinya. Data user butuh flow di mana dia memberi consent",
          ],
          answer: 3,
          why: "Dengan client credentials nggak ada resource owner. Token bilang apa yang boleh dilakukan client sebagai dirinya sendiri. Kalau API memperlakukan token seperti itu sebagai token user, backend mana pun yang punya secret bisa membaca data user mana pun. Pakai authorization code flow kalau user-nya yang jadi intinya.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "client-credentials-200",
      label: "Ambil token untuk backend client (POST /token dengan grant_type=client_credentials mengembalikan 200)",
      lab: "03",
      hint: "Klik Ambil token di console. Dia mengirim id dan secret milik demo-backend lewat HTTP Basic.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 200 && (e.req.body ?? "").includes("grant_type=client_credentials") && (e.res.body ?? "").includes("access_token"),
    },
  ],
  attacks: [],
};

export default lesson;

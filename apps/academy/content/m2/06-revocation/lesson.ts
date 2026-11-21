import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l6",
  module: "m2",
  slug: "revocation",
  title: "Logout & Revocation",
  minutes: 25,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "strategies", title: "Strategi" },
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
          prompt: "User logout dan server me-revoke refresh token family-nya. Access token-nya masih punya sisa tiga menit. Apa yang terjadi pada API call yang membawanya?",
          choices: [
            "Langsung gagal, karena logout membatalkan semua token",
            "Gagal setelah percobaan refresh berikutnya",
            "Tetap jalan sampai exp, karena API memverifikasi token secara offline dan nggak pernah bertanya ke server",
            "Tetap jalan selama 14 hari, umur refresh token",
          ],
          answer: 2,
          why: "Memverifikasi JWT cuma butuh key dan claims, jadi apa pun yang dilakukan server saat logout nggak sampai ke API. Me-revoke refresh token hanya menghentikan penerbitan access token baru. Yang lama hidup sampai exp, makanya umurnya dibuat pendek.",
        },
        {
          prompt: "Apa harganya membuat access token bisa di-revoke seketika, misalnya dengan deny list berisi token id?",
          choices: [
            "Nggak ada: pengecekannya gratis",
            "Token yang jauh lebih panjang",
            "Algoritma signing yang berbeda",
            "State: setiap API call sekarang butuh lookup, yang mengembalikan shared store yang justru ingin dihindari token self-contained",
          ],
          answer: 3,
          why: "Deny list atau introspection call adalah pengecekan di sisi server pada setiap request. Itu session lookup yang menyamar. Sering sepadan untuk API sensitif, tapi ini trade-off, dan tuas yang lebih murah adalah umur pendek dan me-revoke refresh token.",
        },
        {
          prompt: "Kenapa banyak sistem memasangkan access token 5 menit dengan refresh token yang bisa di-revoke?",
          choices: [
            "Karena lima menit adalah batas maksimum yang diizinkan standar JWT",
            "Me-revoke refresh token menghentikan access token baru, jadi paling lama session yang dicuri atau sudah logout masih bisa dipakai dibatasi oleh sisa umur access token",
            "Karena refresh token membuat access token tak terlihat oleh attacker",
            "Karena token pendek nggak butuh signature",
          ],
          answer: 1,
          why: "Dua tuas ini digabung. Refresh token adalah bagian yang bisa di-revoke, dan umur pendek access token adalah batas seberapa lama revoke baru berlaku penuh. Bersama-sama mereka membatasi risiko tanpa lookup di setiap API call.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "logout-revokes",
      label: "Logout: POST /refresh/logout mengembalikan 204",
      lab: "02",
      hint: "Klik Login, lalu Logout, lalu Refresh untuk melihat 401, lalu Profile untuk melihat access token lama masih berfungsi.",
      match: (e) => e.req.method === "POST" && e.req.path === "/refresh/logout" && e.res.status === 204,
    },
  ],
  attacks: [],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l3",
  module: "m3",
  slug: "client-types",
  title: "Tipe Client",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "implicit", title: "Implicit flow" },
    { id: "check", title: "Cek" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Mana dari berikut ini yang merupakan public client menurut RFC 6749?",
          choices: [
            "Backend Go yang membaca secret-nya dari vault",
            "Single-page app yang berjalan sepenuhnya di browser user",
            "Web app server-rendered dengan session cookie",
            "Job terjadwal di server yang terkunci rapat",
          ],
          answer: 1,
          why: "RFC 6749 section 2.1 membagi client berdasarkan bisa-tidaknya menjaga credential tetap rahasia, bukan seberapa pentingnya. Kode yang dikirim ke perangkat user, seperti SPA atau mobile app, bisa dibaca user, jadi dia public. Proses server dengan secret yang terlindungi itu confidential.",
        },
        {
          prompt: "Kenapa OAuth 2.0 Security BCP (RFC 9700) dan OAuth 2.1 mempensiunkan implicit flow?",
          choices: [
            "Terlalu banyak round trip",
            "Nggak jalan di atas HTTPS",
            "Access token dikirim di URL redirect, tempat dia bocor, tanpa apa pun yang mengikatnya ke app, dan code flow dengan PKCE sekarang melayani app yang sama dengan lebih baik",
            "Nggak bisa membawa scope",
          ],
          answer: 2,
          why: "Di implicit flow, token itu sendiri kembali di URL fragment, terekspos ke history, extension, dan script yang disisipkan, dan pihak mana pun yang mendapatkannya bisa memakainya. Authorization code flow dengan PKCE menjaga token di back channel dan cocok untuk app browser, jadi implicit flow kehilangan alasan untuk ada.",
        },
        {
          prompt: "Sebuah tim SPA menyertakan client_secret di dalam bundle JavaScript supaya app-nya dianggap confidential client. Apa yang salah?",
          choices: [
            "Siapa pun yang membuka halaman bisa membaca secret itu, jadi dia nggak mengautentikasi apa-apa. App itu public client dan harus mengandalkan PKCE",
            "Secret hanya diizinkan untuk mobile app",
            "Secret kedaluwarsa saat bundle di-cache",
            "Nggak ada masalah: bundle yang di-minify cukup menyembunyikan secret",
          ],
          answer: 0,
          why: "Apa pun yang dikirim ke browser bisa dibaca. Secret di sana nggak mengidentifikasi siapa pun dan memberi rasa aman palsu. Nyatakan app itu public client, daftarkan redirect URI yang persis, dan lindungi code dengan PKCE.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l5",
  module: "m1",
  slug: "csrf",
  title: "CSRF",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "attack", title: "Serangannya" },
    { id: "defenses", title: "Pertahanan" },
    { id: "simulate", title: "Simulator" },
    { id: "check", title: "Cek" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Kode" },
    { id: "breakit", title: "Coba bobol" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Kenapa browser mengirim session cookie bank pada request palsu yang dipicu evil.example?",
          choices: [
            "Karena evil.example menebak nilai cookie-nya",
            "Karena server bank meminta browser mengirimnya",
            "Karena browser menempelkan cookie sebuah situs ke setiap request ke situs itu, apa pun halaman yang memulainya",
            "Karena cookie HttpOnly dibagi antar situs",
          ],
          answer: 2,
          why: "Cookie adalah ambient credentials: browser menambahkannya otomatis berdasarkan ke mana request pergi, bukan dari mana asalnya. Itulah seluruh kelemahan yang disalahgunakan CSRF.",
        },
        {
          prompt: "Kenapa evil.example tidak bisa begitu saja menyalin CSRF token bank ke form palsunya?",
          choices: [
            "Token di-encrypt dengan public key attacker",
            "Same-origin policy mencegah evil.example membaca halaman dan response bank, jadi ia tidak pernah melihat token",
            "Token hanya valid selama satu detik",
            "Browser memblokir semua form yang mengarah ke situs lain",
          ],
          answer: 1,
          why: "Halaman lintas situs bisa membuat browser mengirim request tapi tidak bisa membaca response-nya. Token ada di halaman atau response bank sendiri, jadi attacker tidak punya apa pun untuk disalin.",
        },
        {
          prompt: "API kamu sama sekali tidak mengirim header CORS. Apakah itu melindunginya dari CSRF?",
          choices: [
            "Ya, browser menolak mengirim request lintas origin tanpa header CORS",
            "Ya, tapi hanya untuk request POST",
            "Hanya kalau request juga memakai HTTPS",
            "Tidak: CORS mengatur siapa yang boleh membaca response. Simple request lintas situs tetap terkirim, dengan cookie",
          ],
          answer: 3,
          why: "CORS soal membaca response lintas origin. POST form atau fetch no-cors tetap sampai ke server dan tetap membawa cookie. Itulah kenapa CSRF butuh pertahanan tersendiri.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "transfer-403",
      label: "Kirim transfer tanpa CSRF token dan dapat 403",
      lab: "01",
      hint: "Klik Register, lalu Log in, lalu klik Transfer, tanpa token. Request-nya punya cookie yang valid dan tetap gagal.",
      match: (e) => e.req.method === "POST" && e.req.path === "/transfer" && e.res.status === 403 && !e.req.headers["x-csrf-token"],
    },
    {
      id: "transfer-200",
      label: "Kirim transfer dengan CSRF token dan dapat 200",
      lab: "01",
      hint: "Klik Transfer, dengan token. Console mengambil token dari response login terakhir dan mengirimnya sebagai X-CSRF-Token.",
      match: (e) => e.req.method === "POST" && e.req.path === "/transfer" && e.res.status === 200 && !!e.req.headers["x-csrf-token"],
    },
  ],
  attacks: [{ id: "csrf", title: "Cross-site request forgery", kind: "simulated" }],
};

export default lesson;

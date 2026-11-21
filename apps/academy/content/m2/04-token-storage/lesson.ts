import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l4",
  module: "m2",
  slug: "token-storage",
  title: "Menyimpan Token di Mana?",
  minutes: 25,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "options", title: "Pilihan yang ada" },
    { id: "check", title: "Cek pemahaman" },
    { id: "simulate", title: "Simulator" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Script yang disuntikkan lewat bug XSS jalan di halaman kamu. Token mana yang bisa langsung dibacanya?",
          choices: [
            "Refresh token di cookie HttpOnly",
            "Token yang dipegang di variabel dalam module aplikasi sendiri",
            "Nggak ada: browser mencegah script suntikan membaca storage",
            "Access token yang disimpan di localStorage",
          ],
          answer: 3,
          why: "localStorage dan sessionStorage bisa dibaca script apa pun yang jalan di origin itu, termasuk yang disuntikkan. Cookie HttpOnly disembunyikan dari JavaScript, dan variabel di dalam module nggak bisa dijangkau dari luar.",
        },
        {
          prompt: "Setup mana yang otomatis menyertakan access token di setiap request, sehingga CSRF jadi perhatian untuk API?",
          choices: [
            "Menyimpannya di memory dan mengirim header Authorization",
            "Menyimpannya di localStorage dan mengirim header Authorization",
            "Menyimpannya di cookie yang disertakan browser pada API call",
            "Menyimpannya di closure JavaScript",
          ],
          answer: 2,
          why: "Cookie itu ambient credential: browser menyertakannya di setiap request ke situs itu, halaman mana pun yang memicunya, dan itulah kelemahan CSRF dari Module 1. Header Authorization harus di-set oleh kode kamu sendiri, jadi request lintas situs yang dipalsukan nggak membawanya.",
        },
        {
          prompt: "Access token ada di memory dan refresh token di cookie HttpOnly. Apa yang masih bisa dilakukan XSS?",
          choices: [
            "Nggak ada: pola ini membuat XSS tidak berbahaya",
            "Membaca refresh token lewat document.cookie",
            "Mencuri token dari page load berikutnya",
            "Bertindak sebagai user selama halaman terbuka, dengan memanggil API dan /refresh dari dalamnya, walau nggak bisa membawa kabur refresh token",
          ],
          answer: 3,
          why: "Script berjalan dengan hak akses halaman, jadi dia bisa membuat request dan browser menyertakan cookie-nya. HttpOnly mencegah credential diambil, bukan dipakai. Pola ini membatasi berapa lama dan seberapa jauh kerusakan terjadi. XSS tetap ada di daftar ancaman.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [{ id: "xss-storage", title: "Pencurian token lewat XSS dari browser storage", kind: "simulated" }],
};

export default lesson;

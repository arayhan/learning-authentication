import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l2",
  module: "m1",
  slug: "password-storage",
  title: "Menyimpan Password",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "hash", title: "Hash, jangan disimpan" },
    { id: "salt", title: "Salt dan cost" },
    { id: "playground", title: "Playground" },
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
          prompt: "Kenapa SHA-256 polos adalah cara yang buruk untuk menyimpan password?",
          choices: [
            "Terlalu lambat untuk halaman login",
            "Dirancang untuk cepat, jadi attacker bisa mencoba miliaran tebakan per detik",
            "Outputnya terlalu pendek untuk jadi unik",
            "Bisa dibalik dengan key yang tepat",
          ],
          answer: 1,
          why: "SHA-256 dirancang untuk kecepatan. Itu kelebihan untuk integritas file dan kelemahan untuk password, karena satu GPU bisa mencoba miliaran kandidat per detik terhadap hash curian.",
        },
        {
          prompt: "Salt acak yang unik per password melindungi dari apa?",
          choices: [
            "Precomputed table (rainbow table), dan terbongkarnya user yang memakai password sama",
            "Attacker yang mencuri database lalu menebak satu password yang lemah",
            "Orang yang menyadap password di network",
            "Kebutuhan untuk memakai hash yang lambat",
          ],
          answer: 0,
          why: "Salt bikin setiap hash unik, jadi satu precomputed table tidak bisa menjebol semua user dan password yang sama tidak lagi kelihatan sama. Salt tidak menghentikan tebakan terarah ke password lemah, itu tugas hash yang lambat, dan salt bukan rahasia.",
        },
        {
          prompt: "PHC string kamu diawali $argon2id$v=19$m=19456,t=2,p=1. Tahun depan kamu menaikkan memory cost. Apa yang terjadi pada user yang sudah ada?",
          choices: [
            "Semua terkunci sampai mereka reset password",
            "Kamu harus migrasi seluruh tabel secara offline dulu",
            "Hash lama tetap bisa diverifikasi, karena tiap string membawa parameternya sendiri; rehash saat login berikutnya",
            "Hash mereka sekarang terverifikasi dengan cost baru, jadi tidak perlu melakukan apa-apa",
          ],
          answer: 2,
          why: "Verifikasi membaca parameter dari string yang tersimpan, jadi hash lama tetap jalan. Saat user login dengan password yang benar, kamu memegang plaintext-nya sebentar, dan itulah kesempatan untuk rehash dengan cost baru.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "register-201",
      label: "Daftarkan akun: POST /register mengembalikan 201",
      lab: "01",
      hint: "Klik Register di console. Tiap klik membuat akun acak yang baru, jadi selalu bisa dipakai.",
      match: (e) => e.req.method === "POST" && e.req.path === "/register" && e.res.status === 201,
    },
    {
      id: "login-200",
      label: "Log in: POST /login mengembalikan 200",
      lab: "01",
      hint: "Klik Log in. Ia memakai akun yang baru saja kamu daftarkan.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;

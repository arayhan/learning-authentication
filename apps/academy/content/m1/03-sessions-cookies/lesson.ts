import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l3",
  module: "m1",
  slug: "sessions-cookies",
  title: "Session & Cookie",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "cookie", title: "Anatomi cookie" },
    { id: "server", title: "Apa yang disimpan server" },
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
          prompt: "Kenapa server menyimpan sha256(token) dan bukan session token-nya langsung?",
          choices: [
            "Lookup jadi lebih cepat",
            "Cookie tetap kecil",
            "Dump database yang bocor jadi tidak berisi cookie session yang bisa dipakai",
            "Client bisa memverifikasi cookie tanpa bertanya ke server",
          ],
          answer: 2,
          why: "Siapa pun yang memegang token adalah user-nya. Kalau database hanya menyimpan hash, dump tidak memberi attacker apa pun yang bisa dimasukkan ke cookie. Meng-hash token acak 256 bit tidak butuh salt atau hash lambat, karena token itu tidak bisa ditebak.",
        },
        {
          prompt: "Apa fungsi atribut HttpOnly?",
          choices: [
            "Menyembunyikan cookie dari JavaScript, jadi bug XSS tidak bisa membaca dan mencurinya",
            "Mencegah browser mengirim cookie di request lintas situs",
            "Membatasi cookie hanya untuk koneksi HTTPS",
            "Meng-encrypt nilai cookie di browser",
          ],
          answer: 0,
          why: "HttpOnly menghapus cookie dari document.cookie. Mencegah request lintas situs adalah tugas SameSite, dan HTTPS-only adalah Secure. Catatan: bug XSS tetap bisa membuat request yang membawa cookie; HttpOnly hanya mencegahnya dicuri.",
        },
        {
          prompt: "Mana session identifier yang terbaik?",
          choices: [
            "User id plus timestamp",
            "32 byte dari generator acak yang aman secara kriptografi, tanpa makna",
            "md5 dari alamat email user",
            "Counter yang bertambah terus",
          ],
          answer: 1,
          why: "Session id adalah bearer secret, jadi harus tidak bisa ditebak: minimal 64 bit entropy menurut OWASP, di sini 256. Apa pun yang diturunkan dari data user atau counter bisa ditebak atau dipalsukan, dan id yang bagus tidak membawa informasi sama sekali.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "set-cookie-httponly",
      label: "Log in dan temukan Set-Cookie dengan HttpOnly dan SameSite=Lax",
      lab: "01",
      hint: "Klik Register, lalu Log in, lalu buka baris POST /login di Inspector dan lihat tab Cookies.",
      match: (e) => {
        const raw = e.res.headers["set-cookie"];
        return [raw ?? []].flat().some((c) => /^sid=[^;]+/.test(c) && /;\s*HttpOnly/i.test(c) && /;\s*SameSite=Lax/i.test(c));
      },
    },
    {
      id: "me-200",
      label: "Buktikan cookie-nya jalan: GET /me mengembalikan 200",
      lab: "01",
      hint: "Klik Whoami setelah login. Browser mengirim cookie sendiri.",
      match: (e) => e.req.method === "GET" && e.req.path === "/me" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;

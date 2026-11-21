import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l4",
  module: "m1",
  slug: "session-lifecycle",
  title: "Lifecycle Session",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "lifecycle", title: "Dari lahir sampai mati" },
    { id: "rotation", title: "Rotate saat login" },
    { id: "session-fixation", title: "Session fixation" },
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
          prompt: "Kapan server harus menerbitkan session id yang benar-benar baru?",
          choices: [
            "Hanya saat cookie kedaluwarsa",
            "Di setiap request, demi keamanan maksimal",
            "Tidak pernah, id harus tetap stabil selama seluruh kunjungan",
            "Saat login dan di perubahan privilege lain, seperti ganti password atau step-up",
          ],
          answer: 3,
          why: "Id apa pun yang ada sebelum perubahan privilege mungkin diketahui orang lain. Id baru saat login dan di setiap perubahan privilege membuat apa pun yang sudah dipelajari attacker sebelumnya jadi tidak berguna. Rotate di setiap request merusak tab paralel dan tidak ada gunanya.",
        },
        {
          prompt: "Dalam serangan session fixation, gimana attacker bisa masuk ke akun korban tanpa pernah melihat cookie atau password-nya?",
          choices: [
            "Attacker memilih session id, dan server yang rentan mempertahankannya setelah korban login",
            "Attacker menebak password korban dari id",
            "Attacker membaca id dari browser korban lewat XSS",
            "Attacker mencegat header Set-Cookie di jaringan",
          ],
          answer: 0,
          why: "Fixation membalik pencurian biasa. Attacker memilih id dan memasukkannya ke browser korban. Kalau login mempertahankan id itu, ia jadi session terautentikasi yang sudah dipegang attacker.",
        },
        {
          prompt: "User mengklik Logout. Perilaku mana yang aman?",
          choices: [
            "Hapus cookie di browser saja",
            "Redirect ke halaman login dan pertahankan session sampai kedaluwarsa",
            "Tandai user sebagai logged out di state JavaScript halaman",
            "Hapus session di server dan bersihkan cookie",
          ],
          answer: 3,
          why: "Cookie yang disalin tetap jalan sampai server melupakannya. Logout harus menghancurkan session di sisi server. Membersihkan cookie di browser hanya merapikan.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "logout-204",
      label: "Log out: POST /logout mengembalikan 204",
      lab: "01",
      hint: "Klik Register, lalu Log in, lalu klik Log out. Console mengirim CSRF token untukmu. Lalu klik Whoami again untuk melihat session-nya sudah hilang.",
      match: (e) => e.req.method === "POST" && e.req.path === "/logout" && e.res.status === 204,
    },
  ],
  attacks: [{ id: "fixation", title: "Session fixation", kind: "live" }],
};

export default lesson;

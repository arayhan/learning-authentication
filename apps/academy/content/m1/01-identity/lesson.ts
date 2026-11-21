import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l1",
  module: "m1",
  slug: "identity",
  title: "Identity, Authentication, Authorization",
  minutes: 15,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "check", title: "Cek" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "User mengirim password yang benar. Apa yang baru saja ditetapkan sistem?",
          choices: [
            "Authentication: sistem tahu siapa pemanggilnya",
            "Authorization: sistem tahu apa yang boleh dilakukan pemanggil",
            "Keduanya, karena password sekaligus memberi permission",
            "Tidak keduanya, session harus ada dulu",
          ],
          answer: 0,
          why: "Password membuktikan identity. Apa yang boleh dilakukan identity itu adalah keputusan terpisah yang dibuat di setiap request.",
        },
        {
          prompt: "User yang sudah login membuka invoice milik customer lain dan kena 403. Pengecekan mana yang menolak request itu?",
          choices: ["Authentication", "Authorization", "Password hashing", "Rate limiting"],
          answer: 1,
          why: "Server tahu siapa pemanggilnya (authentication) dan memutuskan dia tidak boleh membaca invoice itu (authorization).",
        },
        {
          prompt: "Mana yang merupakan kegagalan authorization, bukan kegagalan authentication?",
          choices: [
            "Password tidak cocok dengan hash yang tersimpan",
            "Cookie session sudah kedaluwarsa",
            "User yang sudah login memanggil endpoint khusus admin",
            "Alamat email belum terdaftar",
          ],
          answer: 2,
          why: "Tiga lainnya adalah kegagalan membuktikan siapa pemanggilnya. Cuma panggilan ke endpoint admin yang melibatkan pemanggil dikenal tapi tidak diizinkan.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

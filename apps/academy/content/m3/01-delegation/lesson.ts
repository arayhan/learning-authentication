import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l1",
  module: "m3",
  slug: "delegation",
  title: "Masalah Delegasi",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Konsep" },
    { id: "roles", title: "Empat role" },
    { id: "check", title: "Cek" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Sebuah situs cetak foto mau membaca fotomu di service lain. Pendekatan mana yang justru masalah yang mau dihilangkan OAuth 2.0?",
          choices: [
            "Memberi situs cetak password akun layanan fotomu",
            "Memberi situs cetak sebuah token yang hanya mengizinkan membaca foto",
            "Menyetujui layar consent yang ditampilkan layanan foto",
            "Membiarkan token kedaluwarsa setelah beberapa menit",
          ],
          answer: 0,
          why: "Password yang dibagikan menyerahkan segalanya: situs itu bisa melakukan apa saja yang kamu bisa, kamu nggak bisa menarik aksesnya tanpa ganti password, dan breach di situs itu membocorkan passwordmu. OAuth menggantinya dengan token yang scoped, kedaluwarsa, dan revocable yang disetujui user.",
        },
        {
          prompt: "Dalam istilah RFC 6749, role mana yang menerbitkan access token?",
          choices: [
            "Resource owner, karena itu datanya sendiri",
            "Client, karena dia yang meminta akses",
            "Resource server, karena dia yang menyimpan foto",
            "Authorization server, setelah mengautentikasi user dan mendapat consent-nya",
          ],
          answer: 3,
          why: "RFC 6749 menamai empat role. Resource owner adalah user, client adalah app, resource server menyimpan data dan mengecek token, sedangkan authorization server mengautentikasi user, mengambil consent, dan menerbitkan token. Di sistem kecil dua yang terakhir bisa berbagi satu proses, tapi tetap role yang terpisah.",
        },
        {
          prompt: "Sebuah client menunjukkan access token valid dengan scope photos.read. Apa yang dikatakan token itu ke API?",
          choices: [
            "Bahwa orang yang memakai app baru saja mengetik passwordnya",
            "Bahwa sebuah otoritas memberi client ini akses sesuai scope-nya, untuk waktu terbatas",
            "Bahwa client ini bisa dipercaya dan boleh memanggil endpoint apa pun",
            "Bahwa user sedang hadir di depan keyboard",
          ],
          answer: 1,
          why: "OAuth 2.0 adalah framework authorization: token adalah pemberian akses ke sebuah client, bukan bukti bahwa user sedang hadir. Membuktikan siapa yang login itu pekerjaan lain, dikerjakan OpenID Connect di atas OAuth. Mencampuradukkan keduanya adalah kesalahan desain klasik.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

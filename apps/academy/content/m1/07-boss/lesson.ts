import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l7",
  module: "m1",
  slug: "boss",
  title: "Boss Module 1",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "Sebuah request GET /me datang tanpa session cookie sama sekali. Response mana yang benar?",
          choices: ["403 Forbidden", "401 Unauthorized", "404 Not Found", "200 dengan body kosong"],
          answer: 1,
          why: "Tidak ada bukti siapa yang memanggil, jadi server tidak bisa bilang pemanggilnya dikenal. 401 artinya belum terautentikasi. 403 untuk pemanggil yang dikenal tapi tidak diizinkan.",
        },
        {
          prompt: "Mana cara yang benar untuk menyimpan password user?",
          choices: [
            "Encrypt dengan AES dan simpan key-nya di config app",
            "Hash sekali dengan SHA-256",
            "Hash dengan argon2id dan salt acak yang unik, disimpan sebagai PHC string",
            "Simpan plaintext tapi kunci akses database",
          ],
          answer: 2,
          why: "Password butuh hash satu arah, sengaja lambat, dan di-salt. Encryption bisa dibalik, SHA-256 cukup cepat untuk di-brute-force, dan plaintext mengubah kebocoran apa pun jadi bencana.",
        },
        {
          prompt: "Kenapa salt disimpan langsung di dalam PHC string, di sebelah hash?",
          choices: [
            "Verifier membutuhkannya untuk menghitung ulang hash, dan salt bukan rahasia",
            "Ia adalah secret key, dan menyimpannya di situ adalah trade-off yang disengaja",
            "Supaya string-nya lebih pendek",
            "Supaya user bisa melihat hash mereka sendiri",
          ],
          answer: 0,
          why: "Salt memang publik by design. Tugasnya menjaga keunikan, yang menggagalkan precomputed table. Verifikasi butuh salt yang sama, jadi ia ikut bersama hash.",
        },
        {
          prompt: "Atribut cookie mana yang mencegah JavaScript di halaman membaca session id?",
          choices: ["Secure", "SameSite=Lax", "Path=/", "HttpOnly"],
          answer: 3,
          why: "HttpOnly menghapus cookie dari document.cookie. Secure membatasi transport ke HTTPS, SameSite mengatur pengiriman lintas situs, dan Path hanya membatasi URL.",
        },
        {
          prompt: "Seorang developer mengatur session cookie jadi sid=<id numerik user>. Apa masalah utamanya?",
          choices: [
            "Cookie terlalu pendek untuk dikirim",
            "Siapa pun bisa mengatur sid=42 dan jadi user 42, karena nilainya bisa ditebak",
            "Cookie numerik tidak bisa HttpOnly",
            "Server tidak bisa mencari angka dengan cepat",
          ],
          answer: 1,
          why: "Session id adalah bearer secret dan harus tidak bisa ditebak. Id yang bisa ditebak memungkinkan attacker menyamar jadi user mana pun cukup dengan mengubah nilainya. Pakai 32 byte acak tanpa makna.",
        },
        {
          prompt: "Sebuah situs mempertahankan session id apa pun yang dikirim browser, bahkan setelah login. Serangan mana yang dimungkinkan?",
          choices: ["CSRF", "Credential stuffing", "Session fixation", "Account enumeration"],
          answer: 2,
          why: "Kalau id bertahan setelah login, attacker yang sudah menanamnya sebelumnya sekarang memegang session yang terautentikasi. Menerbitkan id baru saat login mencegahnya.",
        },
        {
          prompt: "User mengganti password karena curiga ada orang yang tahu passwordnya. Apa yang seharusnya dilakukan server terhadap session?",
          choices: [
            "Tidak ada: session tidak bergantung pada password",
            "Logout user dari perangkat saat ini saja",
            "Perpanjang semua session supaya user tidak terganggu",
            "Akhiri semua session lain dan terbitkan session id baru untuk perangkat saat ini",
          ],
          answer: 3,
          why: "Session yang dibuka dengan password lama mungkin milik orang yang dikhawatirkan user. Menghancurkan yang lain dan me-rotate id saat ini menutup celah itu.",
        },
        {
          prompt: "Mana yang TIDAK membantu melawan POST lintas situs yang dipalsukan?",
          choices: [
            "Menandai session cookie sebagai HttpOnly",
            "SameSite=Lax pada session cookie",
            "Mewajibkan CSRF token per session di header",
            "Mengecek header Origin pada request yang tidak aman",
          ],
          answer: 0,
          why: "HttpOnly menyembunyikan cookie dari script, tapi browser tetap menempelkannya ke request palsu. Tiga lainnya masing-masing memblokir pemalsuan di titik yang berbeda.",
        },
        {
          prompt: "Login untuk email tidak dikenal kembali seketika, sementara password salah butuh sekitar 50 ms. Apa masalah dan perbaikannya?",
          choices: [
            "Jalur tidak dikenal terlalu cepat: lewati hashing untuk email yang dikenal juga",
            "Timing membocorkan email mana yang ada: verifikasi terhadap dummy hash untuk email tidak dikenal",
            "Jalur password salah terlalu lambat: turunkan cost argon2id sampai sama",
            "Tidak ada masalah: body response-nya sama",
          ],
          answer: 1,
          why: "Body yang sama tidak membantu kalau timing-nya beda. Attacker bisa mengukur selisihnya lewat banyak request. Meng-hash nilai dummy membuat kedua jalur berbiaya hampir sama.",
        },
        {
          prompt: "Attacker mencoba password 'Summer2024!' sekali ke masing-masing dari 50.000 akun. Tidak ada akun yang melihat lebih dari satu kegagalan. Pertahanan mana yang tepat sasaran untuk ini?",
          choices: [
            "Batas 5 kegagalan per akun",
            "Masa hidup session yang lebih panjang",
            "Batas per IP dan pemantauan tingkat kegagalan keseluruhan, plus menolak password umum",
            "CSRF token di /login",
          ],
          answer: 2,
          why: "Ini password spraying. Batas per akun tidak pernah terpicu, jadi kamu butuh batas lintas akun (per IP atau perangkat), alert pada tingkat kegagalan keseluruhan, dan screening terhadap password yang bocor dan umum.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

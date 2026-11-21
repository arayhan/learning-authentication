import type { LessonMeta } from "@/lib/course/types";

/** The JSON `error` field of a traced response body, or undefined. */
const errorOf = (body?: string): unknown => {
  try {
    return (JSON.parse(body ?? "") as { error?: unknown }).error;
  } catch {
    return undefined;
  }
};

const lesson: LessonMeta = {
  id: "m1-l6",
  module: "m1",
  slug: "rate-limit-enumeration",
  title: "Rate Limiting & Enumeration",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "guessing", title: "Serangan tebak-tebakan" },
    { id: "enumeration", title: "Account enumeration" },
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
          prompt: "Pasangan response login mana yang memungkinkan attacker mencari tahu email mana yang punya akun?",
          choices: [
            "401 invalid credentials untuk password salah, dan 401 yang sama untuk email tidak dikenal",
            "401 no such user untuk email tidak dikenal, dan 401 wrong password untuk yang dikenal",
            "429 too many attempts untuk email yang dikenal maupun tidak",
            "200 untuk login yang benar dan 401 untuk yang salah",
          ],
          answer: 1,
          why: "Perbedaan apa pun yang bisa diamati attacker, di pesan, status, atau timing, adalah oracle untuk keberadaan akun. Satu pesan generik untuk kedua kasus menutupnya. 200 versus 401 untuk credentials benar dan salah tidak bisa dihindari dan tidak membocorkan apa pun soal akun lain.",
        },
        {
          prompt: "Kenapa lab memverifikasi password terhadap dummy hash ketika emailnya tidak dikenal?",
          choices: [
            "Untuk melindungi database dari query yang tidak valid",
            "Supaya email tidak dikenal memakan waktu selama password salah, dan timing tidak membocorkan email mana yang ada",
            "Untuk mencatat tebakan attacker agar bisa ditinjau nanti",
            "Karena argon2id menolak berjalan tanpa hash",
          ],
          answer: 1,
          why: "Memverifikasi hash asli butuh puluhan milidetik, sementara langsung return untuk email tidak dikenal hampir tidak butuh waktu. Selisih itu terukur lewat banyak request. Menghabiskan waktu yang sama di dummy hash membuat kedua jalur terlihat sama.",
        },
        {
          prompt: "Kenapa batas kegagalan per akun saja tidak cukup?",
          choices: [
            "Batas per akun terlalu lambat untuk dicek",
            "Attacker bisa mengunci korban, jadi batas seharusnya tidak ada",
            "Password spraying: satu password umum dicoba ke banyak akun tidak pernah memicu batas satu akun pun",
            "Batas per akun hanya bekerja untuk password yang lebih pendek dari 8 karakter",
          ],
          answer: 2,
          why: "Spraying dan credential stuffing menyebar percobaan tipis-tipis: beberapa kali per akun di ribuan akun. Tambahkan batas per IP atau perangkat, pantau tingkat kegagalan keseluruhan, cek password terhadap breach list, dan tawarkan MFA.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "login-429",
      label: "Picu rate limit: percobaan login mengembalikan 429",
      lab: "01",
      hint: "Klik Register, lalu klik Password salah enam kali. Percobaan keenam di dalam window ditolak dengan 429.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 429,
    },
    {
      id: "generic-401",
      label: 'Login yang gagal mengembalikan body 401 generik {"error":"invalid credentials"}',
      lab: "01",
      hint: "Klik Password salah lalu Email tidak dikenal, dan bandingkan kedua response di Inspector. Keduanya harus identik.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 401 && errorOf(e.res.body) === "invalid credentials",
    },
  ],
  attacks: [],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l3",
  module: "m2",
  slug: "access-refresh",
  title: "Access & Refresh Token",
  minutes: 30,
  steps: [
    { id: "hook", title: "Pembuka" },
    { id: "concept", title: "Konsep" },
    { id: "rotation", title: "Rotation" },
    { id: "check", title: "Cek pemahaman" },
    { id: "lab", title: "Lab" },
    { id: "reuse", title: "Reuse detection" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Kenapa di lab access token cuma hidup 5 menit, sedangkan refresh token 14 hari?",
          choices: [
            "Access token dikirim di setiap request dan diverifikasi offline, jadi yang dicuri harus cepat berhenti berfungsi. Refresh token jarang dipakai dan server bisa me-revoke-nya",
            "Token yang umurnya pendek lebih cepat diverifikasi",
            "Browser menghapus cookie setelah 5 menit kecuali itu refresh token",
            "Kedua masa berlaku itu asal pilih dan nggak memengaruhi keamanan",
          ],
          answer: 0,
          why: "Access token yang self-contained nggak bisa ditarik kembali, jadi masa berlakunya adalah jendela risiko. Refresh token jarang dikirim, tersimpan di tabel yang dicek server, dan bisa di-revoke, jadi boleh berumur panjang.",
        },
        {
          prompt: "Refresh token di lab berupa string acak yang disimpan sebagai sha256 di database, bukan JWT. Kenapa?",
          choices: [
            "String acak lebih susah ditebak daripada JWT",
            "JWT nggak bisa ditaruh di cookie",
            "JWT terlalu besar untuk header Set-Cookie",
            "Server harus bisa me-lookup dan me-revoke-nya, dan penyimpanan berupa hash berarti kebocoran database nggak menghasilkan token yang bisa dipakai",
          ],
          answer: 3,
          why: "Tugas utama refresh token adalah menjadi credential yang stateful dan bisa di-revoke. Nilai opaque yang di-lookup server memberikan itu. Di-hash berarti dump database yang dicuri nggak bisa dipakai ulang, alasannya sama dengan session id di Module 1.",
        },
        {
          prompt: "Refresh token yang sudah dipakai (dan sudah diganti) disodorkan lagi. Apa yang harus dilakukan server?",
          choices: [
            "Tetap terbitkan access token baru, karena token-nya asli",
            "Balas 401 untuk request itu saja dan jangan ubah apa pun lagi",
            "Balas 401 dan revoke seluruh token family, karena token lama yang muncul lagi berarti sudah disalin",
            "Abaikan dan tunggu client yang asli melakukan refresh",
          ],
          answer: 2,
          why: "Dengan rotation, setiap token dipakai tepat sekali. Pemakaian kedua berarti ada dua pihak yang memegangnya, sehingga server nggak bisa membedakan pencuri dari korban. Me-revoke family memaksa login ulang dan memutus si pencuri. Inilah reuse detection, yang direkomendasikan OAuth 2.0 Security BCP.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "login-access-token",
      label: "Login dan dapatkan access token (POST /login mengembalikan 200 dengan access_token)",
      lab: "02",
      hint: "Klik Login. User bawaannya alice@example.com. Body response berisi access_token, token_type Bearer, dan expires_in 300.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 200 && (e.res.body ?? "").includes("access_token"),
    },
    {
      id: "refresh-rotated",
      label: "Rotate refresh token (POST /refresh mengembalikan 200 dan cookie rt baru)",
      lab: "02",
      hint: "Klik Login, lalu Refresh. Buka baris POST /refresh di Inspector dan lihat tab Cookies: nilai rt-nya baru.",
      match: (e) => {
        const raw = e.res.headers["set-cookie"];
        return e.req.method === "POST" && e.req.path === "/refresh" && e.res.status === 200 && [raw ?? []].flat().some((c) => /^rt=[^;]+/.test(c));
      },
    },
    {
      id: "refresh-reuse-401",
      label: "Putar ulang refresh token yang sudah terpakai dan dapatkan 401 dari POST /refresh",
      lab: "02",
      hint: "Browser nggak bisa memutar ulang cookie lama, jadi pakai perintah curl di langkah Reuse detection: refresh dua kali dengan rt yang sama.",
      match: (e) => e.req.method === "POST" && e.req.path === "/refresh" && e.res.status === 401,
    },
  ],
  attacks: [],
};

export default lesson;

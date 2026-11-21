import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l5",
  module: "m3",
  slug: "scopes-state-redirect",
  title: "Scope, State & Redirect",
  minutes: 35,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Scope" },
    { id: "state", title: "State" },
    { id: "redirect", title: "Redirect URI" },
    { id: "check", title: "Cek" },
    { id: "lab", title: "Lab" },
    { id: "breakit", title: "Break it" },
    { id: "code", title: "Kode" },
    { id: "recap", title: "Rangkuman" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Sebuah token hanya membawa scope=profile, sedangkan endpoint foto di API butuh photos.read. Di mana hal itu diputuskan, dan apa jawaban API?",
          choices: [
            "Di halaman consent, yang menyembunyikan endpoint dari client",
            "Di resource server, pada setiap request, dari scope token. Dia menjawab 403 dengan error=insufficient_scope",
            "Oleh client, yang berjanji nggak akan memanggil endpoint itu",
            "Di resource server, yang menjawab 401 invalid_token",
          ],
          answer: 1,
          why: "Scope cuma sebuah claim di token. Dia nggak melindungi apa-apa sampai resource server membacanya dan menolak yang nggak tercakup. RFC 6750 section 3.1 memakai 403 insufficient_scope untuk token valid yang kekurangan scope, dan 401 invalid_token untuk token yang sama sekali nggak valid.",
        },
        {
          prompt: "Apa yang harus dilakukan client dengan parameter state?",
          choices: [
            "Mengikat nilai yang nggak bisa ditebak ke session browser user sebelum redirect, dan menolak callback mana pun yang state-nya nggak cocok",
            "Mengirimnya lalu mengabaikan jawabannya, karena server yang memverifikasi",
            "Memakai id user sebagai state supaya server bisa mencari user-nya",
            "Memakai satu state tetap untuk semua user supaya bisa di-cache",
          ],
          answer: 0,
          why: "State mengikat response ke request yang benar-benar dimulai browser ini. Tanpa pengecekan itu, attacker bisa menyodorkan ke browser korban URL callback yang membawa code milik attacker, dan korban berakhir login sebagai attacker. Nilainya harus nggak bisa ditebak dan terikat ke session.",
        },
        {
          prompt: "Redirect URI terdaftar adalah https://app.example/callback. Server exact-match membandingkan redirect_uri tiap request dengannya. Mana yang diterima?",
          choices: [
            "https://app.example/callback/../evil",
            "https://app.example/callback.evil",
            "https://app.example/callback",
            "https://app.example/callback?next=//evil.example",
          ],
          answer: 2,
          why: "RFC 6749 dan OAuth 2.1 mewajibkan perbandingan exact string. Prefix, wildcard, dan substring matching adalah cara attacker menyelundupkan URI tiruan melewati pengecekan dan membuat code terkirim ke URL yang mereka kendalikan.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "api-403-scope",
      label: "Panggil API dengan token yang nggak punya photos.read dan dapat 403 insufficient_scope",
      lab: "03",
      hint: "Minta scope=profile saja, selesaikan flow dengan curl seperti di langkah Lab, lalu panggil GET /api/photos dengan token itu.",
      match: (e) => e.role === "api" && e.req.method === "GET" && e.req.path === "/api/photos" && e.res.status === 403 && (e.res.body ?? "").includes("insufficient_scope"),
    },
    {
      id: "authorize-400-redirect",
      label: "Kirim redirect_uri yang tidak terdaftar dan dapat halaman error, bukan redirect (GET /authorize mengembalikan 400)",
      lab: "03",
      hint: "Isi redirect_uri yang tidak terdaftar, misalnya yang .evil, di URL builder, biarkan vulnerable mode tidak dicentang, lalu buka.",
      match: (e) => e.role === "as" && e.req.method === "GET" && e.req.path === "/authorize" && e.res.status === 400,
    },
  ],
  attacks: [{ id: "redirect-prefix", title: "Prefix match pada redirect URI", kind: "live" }],
};

export default lesson;

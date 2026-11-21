import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l7",
  module: "m3",
  slug: "summary-boss",
  title: "Rangkuman OAuth 2.1 & Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "Di authorization code flow, komponen mana yang boleh melihat password user?",
          choices: [
            "Client, supaya bisa login atas nama user",
            "Hanya authorization server, tempat user login",
            "Resource server, untuk mengeceknya di setiap panggilan API",
            "Client dan authorization server, keduanya",
          ],
          answer: 1,
          why: "Menjauhkan password dari client adalah inti delegasi. User login di authorization server, dan client hanya menerima code lalu token yang dibatasi sesuai yang disetujui user.",
        },
        {
          prompt: "Langkah mana di authorization code flow yang memakai back channel?",
          choices: [
            "Redirect ke /authorize",
            "Halaman login dan consent",
            "Redirect balik ke client dengan ?code=",
            "POST /token dari client yang menukar code dengan token",
          ],
          answer: 3,
          why: "Tiga langkah pertama lewat browser user, yaitu front channel. Token request adalah panggilan HTTP langsung dari client ke authorization server, jadi access token nggak pernah muncul di URL.",
        },
        {
          prompt: "Dengan PKCE, nilai mana yang tetap di dalam client dan mana yang dikirim ke /authorize?",
          choices: [
            "Challenge tetap di client, verifier dikirim",
            "Verifier tetap di client sampai /token, dan hanya hash S256-nya, yaitu challenge, yang dikirim ke /authorize",
            "Keduanya dikirim ke /authorize",
            "Tidak keduanya: nilai PKCE hanya dikirim ke /token",
          ],
          answer: 1,
          why: "Challenge adalah komitmen, verifier adalah buktinya. Bukti hanya ditunjukkan pada request back channel, setelah code diterbitkan, jadi orang yang melihat front channel punya komitmen tapi nggak bisa membuat buktinya.",
        },
        {
          prompt: "Daftar mana yang merupakan perubahan OAuth 2.1 (draft) dibanding OAuth 2.0 seperti tertulis di RFC 6749?",
          choices: [
            "PKCE wajib untuk authorization code flow, grant implicit dan password dihapus, dan redirect URI dicocokkan secara persis",
            "Access token JWT wajib, dan refresh token dihapus",
            "State dihapus, karena PKCE menggantikannya dalam setiap kasus",
            "Client credentials dihapus, dan semua client harus public",
          ],
          answer: 0,
          why: "OAuth 2.1 menggabungkan RFC 6749 dengan pelajaran dari RFC 7636 dan RFC 9700. Dia nggak mewajibkan format token, tetap mempertahankan refresh token dan client credentials, dan tetap mengharapkan client melindungi diri dari callback palsu, dengan state atau PKCE.",
        },
        {
          prompt: "Apa yang bisa dilakukan attacker pada client yang nggak pernah mengecek state di callback?",
          choices: [
            "Membaca password user dari URL callback",
            "Men-decrypt access token",
            "Menyodorkan ke browser korban URL callback dengan code milik attacker sendiri, sehingga korban login ke akun attacker",
            "Mengubah scope yang disetujui user",
          ],
          answer: 2,
          why: "Tanpa pengecekan yang mengikat response ke request yang dimulai browser ini, client nggak bisa membedakan response miliknya dari yang dipalsukan. Apa pun yang lalu disimpan korban lewat client masuk ke akun attacker.",
        },
        {
          prompt: "Sebuah server membandingkan redirect URI dengan prefix, dan yang terdaftar adalah https://app.example/callback. Apa yang diminta attacker?",
          choices: [
            "URI yang sama dengan scope berbeda",
            "URI tiruan seperti https://app.example/callback.evil, supaya code terkirim ke URL yang mereka kendalikan",
            "URI yang hanya beda di http, bukan https",
            "Tidak ada: prefix matching aman kalau HTTPS dipakai",
          ],
          answer: 1,
          why: "Pengecekan prefix, wildcard, dan substring menerima URI yang nggak pernah didaftarkan pemiliknya. Exact string comparison diwajibkan RFC 6749, diulang di RFC 9700 dan OAuth 2.1. Vulnerable mode di lab menunjukkan bypass-nya.",
        },
        {
          prompt: "Sebuah token valid punya scope=profile, dan API butuh photos.read untuk GET /api/photos. Apa yang seharusnya dikembalikan API?",
          choices: [
            "401 dengan error=invalid_token",
            "200 dengan daftar kosong",
            "302 ke authorization server",
            "403 dengan error=insufficient_scope",
          ],
          answer: 3,
          why: "Token-nya valid, jadi ini bukan kegagalan authentication. RFC 6750 section 3.1 menyediakan 401 untuk token yang hilang atau tidak valid dan 403 insufficient_scope untuk token valid yang kekurangan scope yang dibutuhkan.",
        },
        {
          prompt: "Pernyataan mana tentang client credentials grant yang benar?",
          choices: [
            "Butuh user menyetujui di halaman consent",
            "Mengembalikan ID token yang menyebut nama user",
            "Memungkinkan confidential client mendapat token untuk dirinya sendiri, diautentikasi dengan secret-nya sendiri, tanpa user",
            "Grant yang direkomendasikan untuk single-page app",
          ],
          answer: 2,
          why: "Subject token adalah client, nggak ada resource owner dan nggak ada consent. Cocok untuk panggilan server-to-server, dan nggak boleh dipakai dari kode yang nggak bisa menyimpan secret, seperti app browser.",
        },
        {
          prompt: "Apa yang diminta RFC 8252 dari native app untuk proses login?",
          choices: [
            "Menampilkan halaman login authorization server di dalam embedded web view, supaya app mengendalikan layarnya",
            "Mengumpulkan password di app dan mengirimnya ke token endpoint",
            "Memakai implicit flow, karena HP nggak bisa melakukan panggilan back channel",
            "Memakai system browser dengan authorization code flow dan PKCE, serta redirect yang hanya bisa diterima app itu, sebaiknya link https yang diklaim",
          ],
          answer: 3,
          why: "Embedded web view membuat app bisa membaca password dan cookie user. System browser menjaga proses login di luar jangkauan app, dan PKCE menangani kasus di mana app lain ikut menerima redirect, seperti yang dimungkinkan custom scheme.",
        },
        {
          prompt: "Sebuah authorization code diajukan ke /token untuk kedua kalinya. Apa yang harus dilakukan server?",
          choices: [
            "Tolak, dan kalau bisa cabut token yang sudah diterbitkan dari code itu",
            "Terbitkan token baru, karena code-nya asli",
            "Kembalikan token yang sama lagi supaya retry nggak berbahaya",
            "Terima kalau request kedua datang dari IP address yang sama",
          ],
          answer: 0,
          why: "Code itu sekali pakai. Pengulangan berarti ada orang lain yang juga melihatnya, jadi respons yang aman adalah menolak dan menarik apa yang dihasilkan penukaran pertama. Lab melakukannya dan menjawab invalid_grant.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l7",
  module: "m2",
  slug: "boss",
  title: "Boss Module 2",
  minutes: 15,
  steps: [{ id: "intro", title: "Pengantar" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "Seorang developer menaruh alamat rumah dan tanggal lahir user di payload JWT 'karena token-nya di-sign'. Apa yang salah?",
          choices: [
            "Token yang di-sign nggak bisa membawa lebih dari tiga claims",
            "Signature nggak akan lolos verifikasi lagi kalau data pribadi ditambahkan",
            "Payload cuma di-encode, jadi semua orang yang memegang token bisa membaca alamat dan tanggal lahirnya",
            "Data pribadi harus ditaruh di header, bukan payload",
          ],
          answer: 2,
          why: "Signing memberi integritas, bukan kerahasiaan. Payload JWT biasa adalah JSON base64url yang bisa di-decode siapa pun yang memegang token. Jauhkan dari data sensitif, atau pakai token terenkripsi atau lookup di sisi server.",
        },
        {
          prompt: "API menerima token dengan signature valid dari issuer yang benar, dan exp di masa depan. Tapi aud-nya menyebut service lain. Apa yang harus dilakukan API?",
          choices: [
            "Tolak: token diterbitkan untuk audience lain",
            "Terima: signature dan issuer-nya benar",
            "Terima, tapi catat warning di log",
            "Tolak hanya kalau user-nya administrator",
          ],
          answer: 0,
          why: "aud menyebut token itu untuk API mana. Tanpa pengecekan itu, token yang dibuat untuk satu service dari sebuah issuer membuka semua service lain dari issuer yang sama. RFC 8725 mewajibkan audience divalidasi.",
        },
        {
          prompt: "Satu identity provider menerbitkan token dan enam service independen harus memverifikasinya. Pilihan mana yang membatasi kerusakan kalau satu service bobol?",
          choices: [
            "HS256 dengan secret yang sama di keenam service",
            "HS256 dengan secret berbeda di tiap service, semuanya diketahui provider",
            "Token tanpa signature lewat TLS",
            "RS256 atau ES256, dengan hanya provider yang memegang private key dan service-service memakai public key",
          ],
          answer: 3,
          why: "Shared secret HMAC membuat setiap verifier bisa memalsukan token. Dengan pasangan asimetris, service yang bobol hanya membocorkan public key yang nggak bisa men-sign.",
        },
        {
          prompt: "Dari mana API sebaiknya mendapat key yang dipakai untuk memverifikasi token yang masuk?",
          choices: [
            "Dari header jku di token, yang menyebut key set yang benar",
            "Dari URL JWKS yang dikonfigurasi untuk issuer terpercaya, di-cache dan diambil ulang saat kid asing",
            "Dari header jwk yang tertanam di token",
            "Dari query parameter pada request",
          ],
          answer: 1,
          why: "Semua yang ada di token dikontrol attacker sampai diverifikasi, termasuk header jku, x5u, dan jwk yang tertanam. Key harus berasal dari trust yang kamu konfigurasi. kid di token hanya memilih di antara key yang sudah kamu percaya.",
        },
        {
          prompt: "Issuer sedang me-rotate signing key-nya. Urutan mana yang menghindari downtime?",
          choices: [
            "Hapus key lama, lalu tambahkan key baru ke JWKS",
            "Pindah men-sign dengan key baru, lalu publikasikan public key-nya",
            "Publikasikan public key baru, mulai men-sign dengannya, dan pensiunkan key lama setelah token lama expired",
            "Pakai ulang kid lama untuk key baru supaya nggak ada yang berubah buat verifier",
          ],
          answer: 2,
          why: "Verifier harus bisa menemukan key baru sebelum token yang di-sign dengannya muncul, dan key lama harus tetap ada sampai token yang di-sign dengannya expired. kid yang berbeda untuk tiap key itulah yang membuat keduanya bisa hidup berdampingan.",
        },
        {
          prompt: "Kenapa cookie refresh di lab dibatasi dengan Path=/refresh?",
          choices: [
            "Supaya cookie dienkripsi oleh browser",
            "Karena cookie tanpa Path ditolak browser",
            "Supaya cookie bertahan lebih lama",
            "Supaya browser hanya mengirimnya ke endpoint refresh dan logout, bukan di setiap API call",
          ],
          answer: 3,
          why: "Refresh token itu kuat dan hanya dibutuhkan di satu tempat. Membatasi path menjauhkannya dari request API biasa, jadi dia nggak bisa bocor lewat banyak handler dan log yang nggak pernah membutuhkannya.",
        },
        {
          prompt: "Di aplikasi browser yang mengikuti pola lab, di mana kedua token disimpan?",
          choices: [
            "Keduanya di localStorage supaya bertahan setelah reload",
            "Access token di memory, refresh token di cookie HttpOnly",
            "Access token di cookie HttpOnly, refresh token di localStorage",
            "Keduanya di global JavaScript supaya kode mudah mengaksesnya",
          ],
          answer: 1,
          why: "Memory dan cookie HttpOnly nggak bisa dibaca script suntikan. Access token berumur pendek dan dibuat ulang setelah reload lewat panggilan refresh, sedangkan cookie membawa token yang berumur panjang.",
        },
        {
          prompt: "Pernyataan mana tentang XSS dan cookie HttpOnly yang benar?",
          choices: [
            "HttpOnly membuat aplikasi kebal terhadap XSS",
            "HttpOnly mencegah script memanggil API",
            "HttpOnly mencegah script membaca cookie, tapi script tetap bisa membuat request yang membawanya selama halaman terbuka",
            "Cookie HttpOnly nggak dikirim pada request yang dibuat script",
          ],
          answer: 2,
          why: "HttpOnly menghilangkan cookie dari document.cookie, jadi nggak bisa disalin. Request dari halaman tetap membawanya, jadi bug XSS bisa bertindak sebagai user selama halaman terbuka.",
        },
        {
          prompt: "Verifier kamu memanggil verify(token, publicKey) tanpa daftar algoritma yang diizinkan. Attacker mengirim token HS256 yang di-sign dengan public key kamu sebagai secret. Kenapa token itu bisa diterima?",
          choices: [
            "Public key RSA selalu valid sebagai secret HMAC",
            "Library hanya mengecek signature kalau algoritmanya RS256",
            "Signature HMAC nggak dicek oleh library",
            "Library menurut pada header alg token, jadi dia menghitung HMAC dengan byte key yang sama dengan yang dipakai attacker",
          ],
          answer: 3,
          why: "Itulah key confusion. Public key itu publik, jadi attacker bisa men-sign dengannya. Verifier yang membiarkan header memilih algoritma dan memakai satu variabel key untuk semuanya akan menghitung ulang HMAC yang sama. Mem-pin algoritma menutup celah ini.",
        },
        {
          prompt: "Akun admin yang bobol harus berhenti berfungsi dalam hitungan detik, padahal access token berumur lima menit. Desain mana yang memenuhinya?",
          choices: [
            "Cek deny list atau timestamp valid-after per user di setiap API call, selain me-revoke refresh token",
            "Revoke refresh token saja: itu membatalkan access token juga",
            "Minta user membersihkan browser storage-nya",
            "Persingkat umur refresh token jadi satu hari",
          ],
          answer: 0,
          why: "Me-revoke refresh token menghentikan access token baru, tapi yang sudah ada hidup sampai exp. Hanya pengecekan di sisi server pada setiap request yang bisa menolak token yang masih valid lebih awal. Biayanya satu lookup per call, yang sepadan untuk akun berisiko tinggi.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;

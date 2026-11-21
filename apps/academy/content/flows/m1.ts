import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 01 HTTP contract (labs/01-sessions): JSON bodies, `sid` cookie, 401/403/429 bodies.
const SID = "Xk3q9ZmB1vW8eYrT5uLpA7sD0fGhJcN4iOaE6bQwVyU";
const SID2 = "q8LzT0vN2cYp5HsK9dWm3RbX7eJgA1uFoZiE4tQhB6c";
const CSRF = "n7PqR2sV5xYb8CdF1gHj4KmL6tWz9AeUoI3yT0uQ_vE";
const HOST = "Host: localhost:4101";
const JSON_HDR = "Content-Type: application/json";
const cookie = (sid: string) => `Set-Cookie: sid=${sid}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
const login = (email: string, password: string, extra = "") =>
  `POST /login HTTP/1.1\n${HOST}\n${JSON_HDR}${extra}\n\n{"email":"${email}","password":"${password}"}`;
const ok = (sid: string, csrf = CSRF) => `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n${cookie(sid)}\n\n{"csrfToken":"${csrf}"}`;
const generic401 = `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid credentials"}`;

const whoIsWho: Flow = {
  id: "whoIsWho",
  title: "Authentication sekali, authorization setiap kali",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: login("sam@example.com", "correct horse battery"), note: "Authentication dimulai: pemanggil mengaku sebagai Sam dan menyodorkan bukti." },
    { from: "server", to: "db", label: "ambil hash Sam", note: "Server mencari akunnya dan mencocokkan bukti dengan hash yang tersimpan." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Bukti diterima. Server sekarang tahu siapa yang memanggil, dan memberi cookie session supaya ingat di request berikutnya." },
    {
      from: "browser",
      to: "server",
      label: "GET /invoices/42",
      http: `GET /invoices/42 HTTP/1.1\n${HOST}\nCookie: sid=${SID}`,
      note: "Request setelahnya. Cookie menjawab 'ini siapa?'. Ia tidak menjawab 'boleh nggak Sam membaca invoice ini?'.",
    },
    { from: "server", to: "db", label: "Sam boleh baca 42?", note: "Authorization: server mencocokkan pemilik invoice 42 dengan Sam. Pengecekan ini diulang di setiap request." },
    {
      from: "server",
      to: "browser",
      label: "403 forbidden",
      http: `HTTP/1.1 403 Forbidden\n${JSON_HDR}\n\n{"error":"forbidden"}`,
      note: "User dikenal, tapi tidak diizinkan. 401 berarti 'aku nggak tahu kamu siapa'.",
    },
  ],
};

const registerLogin: Flow = {
  id: "registerLogin",
  title: "Register lalu log in: apa yang terjadi pada password",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /register", http: `POST /register HTTP/1.1\n${HOST}\n${JSON_HDR}\n\n{"email":"alice@example.com","password":"correct horse battery"}`, note: "Password plaintext lewat sekali, lewat HTTPS, dan tidak pernah disimpan." },
    { from: "server", to: "server", label: "argon2id(pw, salt)", note: "Salt acak 16 byte yang baru, lalu argon2id dengan m=19456 KiB, t=2, p=1. Lambat dan rakus memory, memang disengaja." },
    { from: "server", to: "db", label: "INSERT user", note: "Yang disimpan: email dan satu PHC string, $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>. Passwordnya sendiri sudah hilang." },
    { from: "server", to: "browser", label: "201 Created", http: `HTTP/1.1 201 Created\n${JSON_HDR}\nCache-Control: no-store\n\n{"id":"6f1c2b9e-3a4d-4e8f-9b1a-7c5d2e0f8a34","email":"alice@example.com"}`, note: "Response tidak pernah mengembalikan hash." },
    { from: "browser", to: "server", label: "POST /login", http: login("alice@example.com", "correct horse battery"), note: "Nanti: password yang sama datang lagi." },
    { from: "server", to: "db", label: "SELECT hash", note: "Server membaca PHC string, yang membawa salt dan parameter cost-nya sendiri." },
    { from: "server", to: "server", label: "hash ulang lalu bandingkan", note: "Server meng-hash input dengan salt yang tersimpan dan membandingkan secara constant-time. Hash yang sama berarti password cocok." },
    { from: "server", to: "db", label: "INSERT session", note: "Baris session baru, dikunci dengan sha256 dari token acak yang baru." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Login selesai. Hash tidak pernah keluar dari database." },
  ],
};

const sessionCookie: Flow = {
  id: "sessionCookie",
  title: "Cookie session, dari Set-Cookie sampai request berikutnya",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: login("alice@example.com", "correct horse battery"), note: "Credentials masuk, seperti tadi." },
    { from: "server", to: "db", label: "INSERT sha256(sid)", note: "Server hanya menyimpan sha256 dari token. Dump database yang bocor tidak berisi cookie yang bisa dipakai." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Cookie adalah tiketnya: 32 byte acak, HttpOnly, SameSite=Lax, satu jam." },
    { from: "browser", to: "browser", label: "simpan cookie", note: "Browser menyimpan cookie untuk situs ini dan mengirimnya otomatis mulai sekarang." },
    { from: "browser", to: "server", label: "GET /me", http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=${SID}`, note: "Kali ini tanpa password. Cookie ikut terkirim sendiri." },
    { from: "server", to: "db", label: "SELECT by sha256(sid)", note: "Hash cookie-nya, cari hash itu, cek expiry." },
    { from: "server", to: "browser", label: "200 {email}", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"email":"alice@example.com"}`, note: "Server mengenali tiketnya dan menjawab sebagai Alice." },
    { from: "browser", to: "browser", label: "document.cookie", note: "Script di halaman membaca document.cookie dan tidak melihat sid. HttpOnly menjaga tiket tetap di luar jangkauan JavaScript yang disusupkan." },
  ],
};

const sessionRotation: Flow = {
  id: "sessionRotation",
  title: "Rotate session id saat login",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login (old sid)", http: login("alice@example.com", "correct horse battery", `\nCookie: sid=${SID}`), note: "Browser sudah memegang session id sejak sebelum login." },
    { from: "server", to: "server", label: "verifikasi password", note: "Rate limit dan pengecekan password lolos dulu." },
    { from: "server", to: "db", label: "DELETE session lama", note: "Id yang dibawa client dihapus. Siapa pun yang tahu id itu kehilangan akses." },
    { from: "server", to: "db", label: "INSERT session baru", note: "Token acak baru, disimpan sebagai sha256-nya, dengan CSRF token baru." },
    { from: "server", to: "browser", label: "200 + Set-Cookie baru", http: ok(SID2), note: "Browser mengganti cookie-nya dengan id yang baru." },
    { from: "browser", to: "server", label: "GET /me (old sid)", http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=${SID}`, note: "Siapa pun yang memutar ulang id lama sekarang..." },
    { from: "server", to: "browser", label: "401 unauthorized", http: `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"unauthorized"}`, note: "...tidak dapat apa-apa. Perubahan privilege (anonim jadi sudah login) datang bersama id baru." },
  ],
};

const fixation: Flow = {
  id: "fixation",
  title: "Session fixation terhadap server yang mempertahankan id yang masuk",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "browser", label: "Browser korban", kind: "browser" },
    { id: "server", label: "Server (rentan)", kind: "server" },
  ],
  steps: [
    {
      from: "attacker",
      to: "server",
      label: "plant sid=ATTACKER",
      http: `POST /__attack/plant-sid HTTP/1.1\n${HOST}\n${JSON_HDR}\nX-Lab-Mode: vulnerable\n\n{"sid":"attacker-chosen-sid"}`,
      danger: true,
      note: "Attacker memilih sebuah id. Serangan nyata memasukkannya ke browser korban lewat subdomain tetangga, script yang disusupkan, atau URL. Lab ini melakukannya lewat helper.",
    },
    { from: "server", to: "browser", label: "Set-Cookie: sid=ATTACKER", http: `HTTP/1.1 200 OK\n${JSON_HDR}\n${cookie("attacker-chosen-sid")}\n\n{"ok":true}`, danger: true, note: "Browser korban sekarang membawa session id yang diketahui attacker." },
    { from: "browser", to: "server", label: "POST /login", http: login("victim@example.com", "correct horse battery", "\nX-Lab-Mode: vulnerable\nCookie: sid=attacker-chosen-sid"), note: "Korban login seperti biasa. Ia tidak sadar apa-apa." },
    { from: "server", to: "server", label: "pertahankan sid yang masuk", danger: true, note: "RENTAN: alih-alih menerbitkan id baru, server menaikkan id yang diberikan menjadi session terautentikasi." },
    { from: "server", to: "browser", label: "200 OK", http: ok("attacker-chosen-sid"), note: "Korban sudah login, memakai id milik attacker." },
    {
      from: "attacker",
      to: "server",
      label: "GET /me (sid=ATTACKER)",
      http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=attacker-chosen-sid`,
      danger: true,
      note: "Attacker tidak pernah melihat password atau cookie korban. Ia cuma butuh id yang ia pilih.",
    },
    { from: "server", to: "attacker", label: "200 {victim}", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"email":"victim@example.com"}`, danger: true, note: "Akun diambil alih. Di mode aman response terakhir ini 401, karena login me-rotate id." },
  ],
};

const csrfAttack: Flow = {
  id: "csrfAttack",
  title: "CSRF: request palsu yang membawa cookie korban",
  actors: [
    { id: "browser", label: "Browser korban", kind: "browser" },
    { id: "bank", label: "bank.example", kind: "server" },
    { id: "evil", label: "evil.example", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "bank", label: "POST /login", http: login("sam@example.com", "correct horse battery"), note: "Sam login ke bank. Browser menyimpan cookie session." },
    { from: "bank", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Bank juga memberikan CSRF token per session di response body." },
    { from: "browser", to: "evil", label: "GET evil.example", http: "GET /free-cruise HTTP/1.1\nHost: evil.example", note: "Di tab lain, Sam membuka halaman yang dikuasai attacker." },
    { from: "evil", to: "browser", label: "form auto-submit", danger: true, note: "Halaman berisi form tersembunyi yang mengarah ke bank dan men-submit-nya saat dimuat." },
    {
      from: "browser",
      to: "bank",
      label: "POST /transfer (forged)",
      http: `POST /transfer HTTP/1.1\nHost: bank.example\nOrigin: https://evil.example\nContent-Type: application/x-www-form-urlencoded\nCookie: sid=${SID}\n\nto=mallory&amount=500`,
      danger: true,
      note: "Browser menempelkan cookie bank ke setiap request yang menuju bank, apa pun halaman yang memicunya. Header Origin adalah satu-satunya petunjuk.",
    },
    { from: "bank", to: "browser", label: "200: uang pindah", http: `HTTP/1.1 200 OK\n${JSON_HDR}\n\n{"ok":true}`, danger: true, note: "Tanpa token, tanpa Origin check, tanpa SameSite: bank tidak bisa membedakan klik Sam dari form attacker." },
    {
      from: "browser",
      to: "bank",
      label: "POST /transfer (tanpa token)",
      http: `POST /transfer HTTP/1.1\n${HOST}\n${JSON_HDR}\nCookie: sid=${SID}\n\n{"to":"mallory","amount":500}`,
      note: "Dengan pertahanan lab menyala, bentuk request palsu yang sama datang tanpa header secret.",
    },
    { from: "bank", to: "browser", label: "403 csrf", http: `HTTP/1.1 403 Forbidden\n${JSON_HDR}\n\n{"error":"csrf"}`, note: "Attacker bisa mengirim cookie tapi tidak bisa membaca token, jadi request-nya mati di sini." },
  ],
};

const bruteForce: Flow = {
  id: "bruteForce",
  title: "Menebak password ke /login",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "attacker", to: "server", label: "POST /login (tebakan 1)", http: login("alice@example.com", "password1"), danger: true, note: "Satu tebakan ke satu akun." },
    { from: "server", to: "db", label: "hitung kegagalan terbaru", note: "Dalam satu transaksi, di-lock per email: berapa kegagalan dalam 15 menit terakhir?" },
    { from: "server", to: "attacker", label: "401 invalid credentials", http: generic401, note: "Password salah. Pesannya tidak menyebut apakah email itu ada." },
    { from: "attacker", to: "server", label: "tebakan 2 sampai 5", danger: true, note: "Empat tebakan salah lagi, empat 401 identik lagi. Setiap kegagalan dicatat." },
    { from: "attacker", to: "server", label: "POST /login (tebakan 6)", http: login("alice@example.com", "letmein"), danger: true, note: "Percobaan keenam di dalam window." },
    { from: "server", to: "db", label: "5 kegagalan: diblokir", note: "Hitungannya sudah 5, jadi password bahkan tidak dicek. Password yang benar pun akan ditolak sekarang." },
    { from: "server", to: "attacker", label: "429 + Retry-After", http: `HTTP/1.1 429 Too Many Requests\n${JSON_HDR}\nRetry-After: 900\nCache-Control: no-store\n\n{"error":"too many attempts"}`, note: "Menebak tidak lagi murah. Batas yang sama berlaku untuk email tidak dikenal, jadi limiter tidak membocorkan akun mana yang ada." },
    { from: "attacker", to: "server", label: "POST /login (email tidak dikenal)", http: login("nobody@example.com", "password1"), danger: true, note: "Akun ini ada nggak? Attacker mencoba mencari tahu." },
    { from: "server", to: "server", label: "verifikasi argon2 dummy", note: "Tidak ada akunnya, jadi server tetap meng-hash input terhadap dummy hash. Email tidak dikenal dan password salah memakan waktu yang sama." },
    { from: "server", to: "attacker", label: "401 invalid credentials", http: generic401, note: "Response yang sama persis byte demi byte dengan password salah. Tidak ada yang bisa di-enumerate." },
  ],
};

export const m1Flows = { whoIsWho, registerLogin, sessionCookie, sessionRotation, fixation, csrfAttack, bruteForce } satisfies Record<string, Flow>;

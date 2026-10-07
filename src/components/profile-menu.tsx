"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "./logout-button";

export interface ProfileSummary { name: string; email: string; initial: string; typeName: string; scopes: string[] }

/** Header profile (D221): who is signed in, one account type, where they work, and the account / sign-out actions. */
export function ProfileMenu({ profile, onNavigate }: { profile: ProfileSummary; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), menuId = useId();
  const place = profile.scopes[0] ?? "";
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const close = () => { setOpen(false); onNavigate?.(); };
  return <div className="profile-menu" ref={root}>
    <button ref={button} type="button" className="profile-trigger" aria-haspopup="true" aria-expanded={open} aria-controls={menuId}
      aria-label={`บัญชี ${profile.name} · ${profile.typeName}`} onClick={() => setOpen(!open)}>
      <span className="profile-badge" aria-hidden="true">{profile.initial}</span>
      {/* The account type is what tells people what they can do; the full name is in the panel and the label. */}
      <span className="profile-text" aria-hidden="true">{profile.typeName}</span>
      <ChevronDown size={16} aria-hidden="true" className="profile-chevron" />
    </button>
    {open && <div id={menuId} className="profile-panel">
      <div className="profile-panel-head">
        <span className="profile-badge profile-badge-large" aria-hidden="true">{profile.initial}</span>
        <div><strong>{profile.name}</strong>{profile.email && <span className="muted">{profile.email}</span>}</div>
      </div>
      <dl className="profile-facts">
        <div><dt>ประเภทบัญชี</dt><dd><span className="type-chip">{profile.typeName}</span></dd></div>
        <div><dt>ขอบเขตข้อมูล</dt><dd>{place || "-"}{profile.scopes.length > 1 && <span className="muted"> · {profile.scopes.slice(1).join(", ")}</span>}</dd></div>
      </dl>
      <div className="profile-actions">
        <Link href="/account" onClick={close}><UserRound size={17} aria-hidden="true" />บัญชีของฉัน</Link>
        <Link href="/guide#account-types" onClick={close}><BookOpen size={17} aria-hidden="true" />ประเภทบัญชีทำอะไรได้บ้าง</Link>
        <button type="button" className="profile-signout" disabled={busy} onClick={async () => { setBusy(true); setError(""); const m = await signOut(); if (m) { setError(m); setBusy(false); } }}>
          <LogOut size={17} aria-hidden="true" />{busy ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>}
  </div>;
}

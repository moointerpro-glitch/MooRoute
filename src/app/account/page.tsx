import Link from "next/link";
import { UserRound } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { myAccount } from "@/server/services/account";
import { PasswordForm, ProfileForm } from "@/components/account-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "บัญชีของฉัน" };

/** Self-service account page (D220/D221). Account type and scopes are shown, never edited here. */
export default async function AccountPage() {
  const actor = await requirePageActor();
  const account = await myAccount(getDatabase(), actor.id);
  return <section className="container admin-page account-page">
    <header className="account-head">
      <span className="profile-badge profile-badge-large" aria-hidden="true">{account.initial}</span>
      <div><p className="eyebrow"><UserRound size={15} aria-hidden="true" />บัญชีของฉัน</p><h1>{account.name}</h1><p className="muted">{account.email}</p></div>
    </header>
    <div className="admin-card account-facts">
      <h2>สิทธิ์การใช้งาน</h2>
      <dl>
        <div><dt>ประเภทบัญชี</dt><dd><span className="type-chip">{account.typeName}</span>{account.typeDoes && <span className="type-does">{account.typeDoes}</span>}</dd></div>
        <div><dt>ขอบเขตข้อมูล</dt><dd>{account.scopes.join(", ") || "-"}</dd></div>
      </dl>
      <p className="muted">ประเภทบัญชีและขอบเขตกำหนดโดยผู้ดูแลระบบ หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ · <Link href="/guide#account-types">ดูว่าแต่ละประเภททำอะไรได้บ้าง</Link></p>
    </div>
    <ProfileForm account={account} />
    <PasswordForm />
  </section>;
}

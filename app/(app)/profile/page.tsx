import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAvatarUrlById } from "@/lib/avatar";
import AvatarUploadForm from "@/components/AvatarUploadForm";
import DeleteAccountForm from "@/components/DeleteAccountForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, avatarById] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("name, email, role, store_id, department")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    user ? fetchAvatarUrlById(supabase, [user.id]) : Promise.resolve(new Map()),
  ]);

  // 마스터(대표) = 매장·부서 없이 전 매장을 보는 owner. 지점장 = 매장이 배정된 owner.
  const isMaster = profile?.role === "owner" && !profile.store_id && !profile.department;
  const isManager = profile?.role === "owner" && !!profile.store_id;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="flex items-center gap-1 text-sm font-medium text-muted">
        <span aria-hidden>←</span> 홈으로
      </Link>

      <section className="flex flex-col gap-1">
        <h1 className="text-lg font-bold">프로필 사진</h1>
        <p className="text-sm text-muted">
          게시판·달력 댓글에 표시되는 사진이에요. 등록하지 않으면 이름 첫 글자로 대신 보여줘요.
        </p>
      </section>

      <AvatarUploadForm
        name={profile?.name ?? "-"}
        avatarUrl={user ? avatarById.get(user.id) ?? null : null}
      />

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="font-bold">내 계정</h2>
        <div className="flex justify-between gap-4">
          <span className="text-muted">이름</span>
          <span className="font-medium">{profile?.name ?? "-"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">이메일</span>
          <span className="truncate font-medium">{profile?.email ?? user?.email ?? "-"}</span>
        </div>
        <p className="pt-1 text-xs text-muted">
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          {" · "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
        </p>
      </section>

      <DeleteAccountForm isMaster={isMaster} isManager={isManager} />
    </div>
  );
}

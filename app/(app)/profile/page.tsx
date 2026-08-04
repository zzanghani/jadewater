import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAvatarUrlById } from "@/lib/avatar";
import AvatarUploadForm from "@/components/AvatarUploadForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, avatarById] = await Promise.all([
    user
      ? supabase.from("profiles").select("name").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user ? fetchAvatarUrlById(supabase, [user.id]) : Promise.resolve(new Map()),
  ]);

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
    </div>
  );
}

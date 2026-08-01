import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import BoardPostForm from "@/components/BoardPostForm";
import { NOTICE, WORK_CATEGORIES } from "@/lib/board";
import type { BoardCategory } from "@/lib/types";

const CATEGORIES: BoardCategory[] = [NOTICE, ...WORK_CATEGORIES];

export default async function NewBoardPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;

  const supabase = await createClient();
  const [{ data: profiles }, { stores }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    getStoreContext(supabase),
    supabase.auth.getUser(),
  ]);

  const { data: profile } = user
    ? await supabase.from("profiles").select("department").eq("id", user.id).single()
    : { data: null };
  const isMaster = stores.length > 1 && !profile?.department;

  const requestedCategory = CATEGORIES.includes(categoryParam as BoardCategory)
    ? (categoryParam as BoardCategory)
    : CATEGORIES[0];
  const defaultCategory: BoardCategory =
    requestedCategory === NOTICE && !isMaster ? WORK_CATEGORIES[0] : requestedCategory;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/board?category=${encodeURIComponent(defaultCategory)}`}
        className="flex items-center gap-1 text-sm font-medium text-muted"
      >
        <span aria-hidden>←</span> 목록으로
      </Link>

      <section>
        <h1 className="mb-3 text-lg font-bold">글쓰기</h1>
        <BoardPostForm profiles={profiles ?? []} defaultCategory={defaultCategory} isMaster={isMaster} />
      </section>
    </div>
  );
}

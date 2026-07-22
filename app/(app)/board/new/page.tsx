import { createClient } from "@/lib/supabase/server";
import BoardPostForm from "@/components/BoardPostForm";
import type { BoardCategory } from "@/lib/types";

const CATEGORIES: BoardCategory[] = ["공지사항", "마케팅", "운영HR", "디자인", "R&D"];

export default async function NewBoardPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const defaultCategory: BoardCategory = CATEGORIES.includes(categoryParam as BoardCategory)
    ? (categoryParam as BoardCategory)
    : CATEGORIES[0];

  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("id, name");

  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">글쓰기</h1>
      <BoardPostForm profiles={profiles ?? []} defaultCategory={defaultCategory} />
    </section>
  );
}

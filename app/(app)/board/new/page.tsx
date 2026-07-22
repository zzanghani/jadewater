import { createClient } from "@/lib/supabase/server";
import BoardPostForm from "@/components/BoardPostForm";

export default async function NewBoardPostPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("id, name");

  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">글쓰기</h1>
      <BoardPostForm profiles={profiles ?? []} />
    </section>
  );
}

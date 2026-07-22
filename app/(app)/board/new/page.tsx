import BoardPostForm from "@/components/BoardPostForm";

export default function NewBoardPostPage() {
  return (
    <section>
      <h1 className="mb-3 text-lg font-bold">글쓰기</h1>
      <BoardPostForm />
    </section>
  );
}

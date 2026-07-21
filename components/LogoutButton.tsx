import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-brand-light hover:text-brand"
      >
        로그아웃
      </button>
    </form>
  );
}

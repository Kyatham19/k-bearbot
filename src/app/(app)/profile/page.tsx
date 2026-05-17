import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/profile-editor";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "User";

  const email = user.email || "No email available";

  return (
    <ProfileEditor
      fullName={fullName}
      email={email}
      userId={user.id}
      createdAt={user.created_at ?? ""}
      emailVerified={!!user.email_confirmed_at}
            
    />
  );
}

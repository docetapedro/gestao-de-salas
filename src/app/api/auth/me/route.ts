import { getSession } from "@/lib/auth";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return json({ user: null }, 401);
    return json({
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

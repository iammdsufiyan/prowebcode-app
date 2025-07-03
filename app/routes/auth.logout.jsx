import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    // This will handle the logout process
    const { session } = await authenticate.admin(request);
    
    if (session) {
      // The session will be automatically cleaned up
      // Redirect to login with shop parameter if available
      const url = new URL(request.url);
      const shop = session.shop || url.searchParams.get("shop");
      
      if (shop) {
        return redirect(`/auth/login?shop=${shop}`);
      }
    }
  } catch (error) {
    // If authentication fails, user is already logged out
  }
  
  return redirect("/auth/login");
};

export const action = async ({ request }) => {
  return loader({ request });
};
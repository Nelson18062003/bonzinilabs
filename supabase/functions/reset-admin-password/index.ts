import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random temporary password
function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create client with user's token to verify permissions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super_admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!callerRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Seul un Super Admin peut réinitialiser les mots de passe" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "L'ID de l'utilisateur cible est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target is an admin
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role, email")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Utilisateur admin non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target's profile for logging
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const targetName = targetProfile
      ? `${targetProfile.first_name} ${targetProfile.last_name}`
      : 'Admin';

    // Generate new temporary password
    const tempPassword = generateTempPassword();

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de la réinitialisation du mot de passe" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    const { error: logError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_user_id: user.id,
        action_type: "reset_admin_password",
        target_type: "admin_user",
        target_id: targetUserId,
        details: {
          description: `Réinitialisation du mot de passe de ${targetName}`,
          target_role: targetRole.role,
        },
      });

    if (logError) {
      console.error("Audit log error:", logError);
    }

    console.log(`Successfully reset password for admin ${targetUserId}`);

    return new Response(
      JSON.stringify({
        success: true,
        tempPassword,
        message: `Mot de passe réinitialisé pour ${targetName}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

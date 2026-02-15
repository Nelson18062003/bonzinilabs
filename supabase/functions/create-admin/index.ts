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
        JSON.stringify({ success: false, error: "Seul un Super Admin peut créer des administrateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, firstName, lastName, role } = await req.json();

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return new Response(
        JSON.stringify({ success: false, error: "Tous les champs sont requis (email, firstName, lastName, role)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ['super_admin', 'ops', 'support', 'customer_success', 'cash_agent'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: `Rôle invalide. Valeurs acceptées: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Check if user already has an admin role
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({ success: false, error: `Cet utilisateur est déjà un admin avec le rôle: ${existingRole.role}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // User exists but has no admin role - this shouldn't happen for admins
      return new Response(
        JSON.stringify({ success: false, error: "Cet email est déjà utilisé par un compte client" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create new user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      console.error("Create user error:", createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Échec de création du compte" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;
    console.log(`Created new admin user ${email} with id ${userId}`);

    // Ensure profile exists
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      // Clean up: delete the user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de la création du profil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role,
        email: email.toLowerCase().trim(),
        is_disabled: false,
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      // Clean up: delete the user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de l'attribution du rôle" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action to audit logs
    const { error: logError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_user_id: user.id,
        action_type: "create_admin",
        target_type: "admin_user",
        target_id: userId,
        details: {
          description: `Création de l'admin ${firstName} ${lastName} (${email})`,
          role: role,
          email: email,
        },
      });

    if (logError) {
      console.error("Audit log error:", logError);
      // Don't fail the request for logging errors
    }

    console.log(`Successfully created admin ${email} with role ${role}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email: email.toLowerCase().trim(),
        tempPassword,
        message: `Admin ${firstName} ${lastName} créé avec succès`,
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

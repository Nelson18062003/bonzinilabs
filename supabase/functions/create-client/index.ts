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

// Clean and validate phone number
function cleanPhoneNumber(phone: string): string {
  // Remove spaces, dashes, dots, parentheses
  return phone.replace(/[\s\-\.\(\)]/g, '');
}

function isValidPhoneNumber(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone);
  // Should start with optional + and have 8-15 digits
  return /^\+?[0-9]{8,15}$/.test(cleaned);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      console.error("No auth header provided");
      return jsonResponse({ success: false, error: "Non authentifié" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user");
      return jsonResponse({ success: false, error: "Non authentifié" }, 401);
    }

    console.log(`Admin ${user.id} (${user.email}) calling create-client`);

    // Check if caller is any admin
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return jsonResponse({ success: false, error: "Erreur lors de la vérification des permissions" }, 500);
    }

    if (!callerRole) {
      console.error(`User ${user.id} is not an admin`);
      return jsonResponse({ success: false, error: "Seul un administrateur peut créer des clients" }, 403);
    }

    console.log(`Admin role: ${callerRole.role}`);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Invalid JSON body:", e);
      return jsonResponse({ success: false, error: "Corps de requête invalide" }, 400);
    }

    const {
      firstName,
      lastName,
      company,
      gender,
      whatsappNumber,
      email,
      country,
      city
    } = body;

    console.log(`Creating client: ${firstName} ${lastName}, phone: ${whatsappNumber}, country: ${country}`);

    // Validate required fields
    if (!firstName || !lastName || !whatsappNumber || !country || !gender) {
      const missing = [];
      if (!firstName) missing.push('prénom');
      if (!lastName) missing.push('nom');
      if (!whatsappNumber) missing.push('whatsapp');
      if (!country) missing.push('pays');
      if (!gender) missing.push('genre');
      console.error(`Missing fields: ${missing.join(', ')}`);
      return jsonResponse({
        success: false,
        error: `Champs requis manquants: ${missing.join(', ')}`
      }, 400);
    }

    // Validate gender
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];
    if (!validGenders.includes(gender)) {
      console.error(`Invalid gender: ${gender}`);
      return jsonResponse({
        success: false,
        error: `Genre invalide. Valeurs acceptées: ${validGenders.join(', ')}`
      }, 400);
    }

    // Clean and validate phone number
    const cleanedPhone = cleanPhoneNumber(whatsappNumber);
    if (!isValidPhoneNumber(whatsappNumber)) {
      console.error(`Invalid phone format: ${whatsappNumber} -> cleaned: ${cleanedPhone}`);
      return jsonResponse({
        success: false,
        error: "Format de numéro WhatsApp invalide. Utilisez le format international (+237XXXXXXXXX)"
      }, 400);
    }

    // Check if WhatsApp number is already used (check both cleaned and original)
    const { data: existingProfile, error: phoneCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id")
      .eq("phone", cleanedPhone)
      .maybeSingle();

    if (phoneCheckError) {
      console.error("Phone check error:", phoneCheckError.message);
      return jsonResponse({
        success: false,
        error: "Erreur lors de la vérification du numéro"
      }, 500);
    }

    if (existingProfile) {
      console.error(`Phone ${cleanedPhone} already used by user ${existingProfile.user_id}`);
      return jsonResponse({
        success: false,
        error: "Ce numéro WhatsApp est déjà utilisé par un autre client"
      }, 400);
    }

    // Also check with original format in case it was stored differently
    if (cleanedPhone !== whatsappNumber.trim()) {
      const { data: existingProfile2 } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id")
        .eq("phone", whatsappNumber.trim())
        .maybeSingle();

      if (existingProfile2) {
        console.error(`Phone ${whatsappNumber} already used by user ${existingProfile2.user_id}`);
        return jsonResponse({
          success: false,
          error: "Ce numéro WhatsApp est déjà utilisé par un autre client"
        }, 400);
      }
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create the authentication email (use WhatsApp number if no email provided)
    const authEmail = email
      ? email.toLowerCase().trim()
      : `${cleanedPhone.replace(/[^0-9]/g, '')}@bonzini-client.local`;

    console.log(`Auth email: ${authEmail}`);

    // Create new user with admin API
    // The handle_new_user trigger will create profile and wallet when is_client = true
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        is_client: true,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: cleanedPhone,
      },
    });

    if (createError) {
      console.error("Create user error:", createError.message);

      // Handle specific known errors
      if (createError.message.includes("already been registered") ||
          createError.message.includes("already exists")) {
        return jsonResponse({
          success: false,
          error: email
            ? "Cet email est déjà utilisé par un autre compte"
            : "Ce numéro de téléphone est déjà associé à un compte"
        }, 400);
      }

      return jsonResponse({ success: false, error: createError.message }, 400);
    }

    if (!newUser.user) {
      console.error("User creation returned no user object");
      return jsonResponse({ success: false, error: "Échec de création du compte" }, 500);
    }

    const userId = newUser.user.id;
    console.log(`Created new client user with id ${userId}`);

    // Wait for the trigger to create profile and wallet
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify profile was created, update with phone if needed
    const { data: profile, error: profileCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileCheckError) {
      console.error("Profile check error:", profileCheckError.message);
    }

    if (profile) {
      // Update profile with phone number if not already set by trigger
      if (!profile.phone || profile.phone !== cleanedPhone) {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: cleanedPhone,
          })
          .eq("user_id", userId);

        if (profileError) {
          console.error("Profile update error:", profileError.message);
        }
      }
    } else {
      console.error(`Profile not found for user ${userId} after 1 second wait`);
      // Try to create profile manually
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: cleanedPhone,
        });

      if (insertError) {
        console.error("Manual profile insert error:", insertError.message);
      }

      // Also create wallet if missing
      const { data: existingWallet } = await supabaseAdmin
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingWallet) {
        const { error: walletError } = await supabaseAdmin
          .from("wallets")
          .insert({ user_id: userId, balance_xaf: 0 });

        if (walletError) {
          console.error("Manual wallet insert error:", walletError.message);
        }
      }
    }

    // Log the action to audit logs (non-blocking)
    try {
      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_user_id: user.id,
          action_type: "create_client",
          target_type: "client",
          target_id: userId,
          details: {
            description: `Création du client ${firstName} ${lastName}`,
            firstName,
            lastName,
            company: company || null,
            gender,
            whatsappNumber: cleanedPhone,
            email: email || null,
            country,
            city: city || null,
          },
        });
    } catch (logError) {
      console.error("Audit log error:", logError);
    }

    // Get wallet ID for the response
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("id, balance_xaf")
      .eq("user_id", userId)
      .maybeSingle();

    console.log(`Successfully created client ${firstName} ${lastName} (${userId})`);

    return jsonResponse({
      success: true,
      clientId: userId,
      walletId: wallet?.id || null,
      email: email || null,
      authEmail: authEmail,
      tempPassword,
      message: `Client ${firstName} ${lastName} créé avec succès`,
    }, 200);
  } catch (error) {
    console.error("Unexpected error:", error?.message || error);
    return jsonResponse({ success: false, error: "Erreur inattendue du serveur" }, 500);
  }
});

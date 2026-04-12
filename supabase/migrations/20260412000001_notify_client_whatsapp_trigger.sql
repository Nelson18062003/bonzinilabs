-- ─── Client WhatsApp/SMS Notification via Twilio (Direct SQL) ─────────────────
-- Calls Twilio API directly from SQL using the http extension.
-- No Edge Function needed — everything runs inside the database.
--
-- After running this migration, configure Twilio credentials:
--   UPDATE app_config SET value = 'ACxxxxx' WHERE key = 'TWILIO_ACCOUNT_SID';
--   UPDATE app_config SET value = 'xxxxx'  WHERE key = 'TWILIO_AUTH_TOKEN';
--   UPDATE app_config SET value = 'whatsapp:+14155238886' WHERE key = 'TWILIO_WHATSAPP_FROM';
--   UPDATE app_config SET value = '+1234567890' WHERE key = 'TWILIO_SMS_FROM';

-- ─── 1. Enable http extension ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ─── 2. Config table (RLS with zero policies = blocked from API) ─────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Insert placeholder values (user updates them later via SQL Editor)
INSERT INTO public.app_config (key, value) VALUES
  ('TWILIO_ACCOUNT_SID',  'REMPLACER_PAR_TON_SID'),
  ('TWILIO_AUTH_TOKEN',    'REMPLACER_PAR_TON_TOKEN'),
  ('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886'),
  ('TWILIO_SMS_FROM',      'REMPLACER_PAR_TON_NUMERO')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. URL-encode helper ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._urlencode(input text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT string_agg(
    CASE
      WHEN c ~ '[A-Za-z0-9_.~-]' THEN c
      ELSE '%' || upper(encode(convert_to(c, 'UTF8'), 'hex'))
    END,
    ''
  )
  FROM regexp_split_to_table(input, '') AS c;
$$;

-- ─── 4. Trigger function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_client_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone        text;
  v_client_name  text;
  v_msg_body     text;
  v_account_sid  text;
  v_auth_token   text;
  v_wa_from      text;
  v_sms_from     text;
  v_auth_header  text;
  v_url          text;
  v_form_body    text;
  v_response     record;
BEGIN
  -- Get client phone number
  SELECT phone,
         COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), 'Client')
  INTO v_phone, v_client_name
  FROM clients
  WHERE user_id = NEW.user_id;

  -- No phone → skip
  IF v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize phone: remove spaces, add +237 if needed
  v_phone := regexp_replace(v_phone, '\s+', '', 'g');
  IF v_phone NOT LIKE '+%' THEN
    IF v_phone LIKE '237%' THEN
      v_phone := '+' || v_phone;
    ELSE
      v_phone := '+237' || v_phone;
    END IF;
  END IF;

  -- Read Twilio config
  SELECT value INTO v_account_sid FROM app_config WHERE key = 'TWILIO_ACCOUNT_SID';
  SELECT value INTO v_auth_token  FROM app_config WHERE key = 'TWILIO_AUTH_TOKEN';
  SELECT value INTO v_wa_from     FROM app_config WHERE key = 'TWILIO_WHATSAPP_FROM';
  SELECT value INTO v_sms_from    FROM app_config WHERE key = 'TWILIO_SMS_FROM';

  -- Not configured yet → skip silently
  IF v_account_sid IS NULL OR v_account_sid LIKE 'REMPLACER%' THEN
    RETURN NEW;
  END IF;

  -- Build message text
  v_msg_body := 'Bonjour ' || v_client_name || E',\n\n' ||
                COALESCE(NEW.title, 'Notification') || E'\n' ||
                COALESCE(NEW.message, '') || E'\n\n' ||
                chr(8212) || ' Bonzini';

  -- Build auth header (Basic base64)
  v_auth_header := 'Basic ' || encode(convert_to(v_account_sid || ':' || v_auth_token, 'UTF8'), 'base64');
  v_url := 'https://api.twilio.com/2010-04-01/Accounts/' || v_account_sid || '/Messages.json';

  -- ── Try WhatsApp first ──────────────────────────────────────────────────────
  IF v_wa_from IS NOT NULL AND v_wa_from NOT LIKE 'REMPLACER%' THEN
    v_form_body := 'From=' || _urlencode(v_wa_from) ||
                   '&To='  || _urlencode('whatsapp:' || v_phone) ||
                   '&Body=' || _urlencode(v_msg_body);

    SELECT status INTO v_response
    FROM extensions.http((
      'POST',
      v_url,
      ARRAY[extensions.http_header('Authorization', v_auth_header)],
      'application/x-www-form-urlencoded',
      v_form_body
    )::extensions.http_request);

    -- 201 = Created (Twilio success)
    IF v_response.status = 201 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ── Fallback to SMS ─────────────────────────────────────────────────────────
  IF v_sms_from IS NOT NULL AND v_sms_from NOT LIKE 'REMPLACER%' THEN
    v_form_body := 'From=' || _urlencode(v_sms_from) ||
                   '&To='  || _urlencode(v_phone) ||
                   '&Body=' || _urlencode(v_msg_body);

    PERFORM extensions.http((
      'POST',
      v_url,
      ARRAY[extensions.http_header('Authorization', v_auth_header)],
      'application/x-www-form-urlencoded',
      v_form_body
    )::extensions.http_request);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original operation if the HTTP call fails
  RAISE WARNING 'notify_client_whatsapp failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── 5. Trigger ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_notification_created_whatsapp ON public.notifications;
CREATE TRIGGER on_notification_created_whatsapp
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_client_whatsapp();

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('alipay', 'wechat', 'bank_transfer', 'cash');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM (
  'created',
  'waiting_beneficiary_info',
  'ready_for_payment',
  'processing',
  'completed',
  'rejected'
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference TEXT NOT NULL,
  amount_xaf BIGINT NOT NULL,
  amount_rmb NUMERIC(15,2) NOT NULL,
  exchange_rate NUMERIC(15,6) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'created',
  
  -- Beneficiary info (depends on method)
  beneficiary_name TEXT,
  beneficiary_phone TEXT,
  beneficiary_email TEXT,
  beneficiary_qr_code_url TEXT,
  beneficiary_bank_name TEXT,
  beneficiary_bank_account TEXT,
  beneficiary_notes TEXT,
  
  -- Cash specific
  cash_qr_code TEXT,
  
  -- Admin fields
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_comment TEXT,
  client_visible_comment TEXT,
  
  -- Balance tracking
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment proofs table
CREATE TABLE public.payment_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('client', 'admin')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment timeline events table
CREATE TABLE public.payment_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments beneficiary info" ON public.payments
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('created', 'waiting_beneficiary_info'));

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (is_admin(auth.uid()));

-- RLS Policies for payment_proofs
CREATE POLICY "Users can view own payment proofs" ON public.payment_proofs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM payments p WHERE p.id = payment_proofs.payment_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can upload proofs for own payments" ON public.payment_proofs
  FOR INSERT WITH CHECK (
    uploaded_by_type = 'client' AND
    EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_proofs.payment_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all payment proofs" ON public.payment_proofs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can upload payment proofs" ON public.payment_proofs
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for payment_timeline_events
CREATE POLICY "Users can view own payment timeline" ON public.payment_timeline_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM payments p WHERE p.id = payment_timeline_events.payment_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all payment timelines" ON public.payment_timeline_events
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can insert payment timeline events" ON public.payment_timeline_events
  FOR INSERT WITH CHECK (true);

-- Create function to generate payment reference
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.payments
  WHERE created_at >= date_trunc('year', now());
  
  v_reference := 'BZ-PY-' || v_year || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- Create function to create payment with balance deduction
CREATE OR REPLACE FUNCTION public.create_payment(
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  
  -- Generate reference
  v_reference := generate_payment_reference();
  
  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );
  
  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;
  
  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after
  ) VALUES (
    v_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance
  ) RETURNING id INTO v_payment_id;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'payment', p_amount_xaf, v_wallet.balance_xaf, v_new_balance,
    v_payment_id, 'payment', 'Paiement ' || v_reference, v_user_id
  );
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_payment_id, 'created', 'Paiement créé - Montant réservé', v_user_id);
  
  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_user_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

-- Create function to process payment (admin)
CREATE OR REPLACE FUNCTION public.process_payment(p_payment_id UUID, p_action TEXT, p_comment TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  IF p_action = 'start_processing' THEN
    IF v_payment.status NOT IN ('ready_for_payment') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement ne peut pas être traité');
    END IF;
    
    UPDATE public.payments
    SET status = 'processing', processed_by = v_admin_id, updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'processing', 'Paiement en cours de traitement', v_admin_id);
    
  ELSIF p_action = 'complete' THEN
    IF v_payment.status NOT IN ('processing') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement doit être en cours de traitement');
    END IF;
    
    UPDATE public.payments
    SET status = 'completed', processed_at = now(), client_visible_comment = p_comment, updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'completed', 'Paiement effectué avec succès', v_admin_id);
    
  ELSIF p_action = 'reject' THEN
    IF v_payment.status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Impossible de refuser un paiement déjà effectué');
    END IF;
    
    IF p_comment IS NULL OR p_comment = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une raison est requise pour le refus');
    END IF;
    
    -- Refund the balance
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;
    
    -- Record the refund operation
    INSERT INTO public.wallet_operations (
      wallet_id, operation_type, amount_xaf, balance_before, balance_after,
      reference_id, reference_type, description, performed_by
    )
    SELECT 
      w.id, 'refund', v_payment.amount_xaf, w.balance_xaf - v_payment.amount_xaf, w.balance_xaf,
      p_payment_id, 'payment_refund', 'Remboursement paiement refusé - ' || v_payment.reference, v_admin_id
    FROM public.wallets w WHERE w.user_id = v_payment.user_id;
    
    UPDATE public.payments
    SET status = 'rejected', rejection_reason = p_comment, processed_by = v_admin_id, processed_at = now(), updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'rejected', 'Paiement refusé: ' || p_comment, v_admin_id);
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action non reconnue');
  END IF;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, p_action || '_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'amount_xaf', v_payment.amount_xaf,
      'amount_rmb', v_payment.amount_rmb,
      'user_id', v_payment.user_id,
      'comment', p_comment
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true);

-- Storage policies for payment proofs
CREATE POLICY "Users can upload payment proofs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view payment proofs" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-proofs');

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_timeline_events;
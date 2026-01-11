-- Make storage buckets private to prevent unauthorized access
UPDATE storage.buckets SET public = false WHERE id = 'deposit-proofs';
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';
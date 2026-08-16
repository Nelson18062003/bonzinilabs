-- ============================================================================
-- Durcissement des buckets de preuves : type MIME + taille imposés côté serveur
--
-- Contexte
-- --------
-- `validateUploadFile()` (src/lib/utils.ts) refuse tout ce qui n'est pas
-- JPG / PNG / WebP / PDF et tout fichier de plus de 10 Mo. Ce contrôle vit
-- uniquement dans le navigateur : les buckets `deposit-proofs` et
-- `payment-proofs` ont `allowed_mime_types = NULL` et `file_size_limit = NULL`,
-- c'est-à-dire AUCUNE limite. N'importe quelle session valide appelant l'API
-- Storage directement peut donc y déposer un exécutable, un HTML piégé ou un
-- fichier de plusieurs Go — le garde-fou frontend ne la voit jamais passer.
--
-- L'ajout du collage (Ctrl+V) multiplie les chemins d'entrée vers ces buckets,
-- d'où l'intérêt de faire respecter la même règle par le serveur.
--
-- Sûreté de l'application
-- -----------------------
-- Vérifié sur la base de production avant écriture : les 1 590 objets déjà
-- stockés dans ces deux buckets sont exclusivement image/jpeg (1 530),
-- image/png (58) et application/pdf (2), le plus volumineux pesant 2,2 Mo.
-- Aucun objet existant ne viole les nouvelles bornes, et de toute façon
-- `allowed_mime_types` / `file_size_limit` ne s'appliquent qu'aux NOUVEAUX
-- envois : rien de déjà stocké ne devient illisible.
--
-- `image/webp` est inclus bien qu'aucun objet ne l'utilise encore : c'est un
-- des quatre types que `ALLOWED_UPLOAD_MIME_TYPES` autorise déjà côté client,
-- les deux listes doivent rester identiques.
--
-- Idempotent : réexécutable sans effet de bord.
-- ============================================================================

-- 10 Mo — la même valeur que MAX_UPLOAD_FILE_SIZE dans src/lib/utils.ts.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'application/pdf'
       ],
       file_size_limit = 10485760
 where id in ('deposit-proofs', 'payment-proofs');

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification — doit renvoyer 2 lignes, chacune avec les 4 types et 10485760.
-- ─────────────────────────────────────────────────────────────────────────────
select id,
       allowed_mime_types,
       file_size_limit,
       pg_size_pretty(file_size_limit::bigint) as taille_max
  from storage.buckets
 where id in ('deposit-proofs', 'payment-proofs')
 order by id;

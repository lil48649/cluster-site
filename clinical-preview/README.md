# Clinical Research Hub — Synthetic API Preview

This folder contains a **synthetic-data-only** preview of the protected clinical research database.
The source repository intentionally does not include patient data, real CSV files, or columns derived from the uploaded clinical CSV.

## Open the preview

https://lil48649.github.io/cluster-site/clinical-preview/

The preview reuses the existing Supabase member allowlist and TOTP second factor. No second enrollment is required for members whose verified account is still active.

## Database behavior

Only three authenticated, server-side RPCs are called:

- `public.clinical_preview_summary()`: aggregate statistics
- `public.clinical_preview_search(...)`: filtered, paginated records (maximum 50 per request)
- `public.clinical_preview_distribution(...)`: grouped counts

The 600 records in `clinical_preview.synthetic_cases` were generated exclusively by SQL and are not patient data. The table is stored in a non-exposed schema with RLS and membership/AAL2 validation. `anon` has neither direct table SELECT nor RPC execution rights.

The client does not expose a file-upload, CSV download, or arbitrary SQL interface. This does **not** prevent extraction of data the server already authorizes a client to see. A production clinical system needs field minimization, audited access, query limits/rate controls, and legal authorization for the database's physical hosting location.

The existing `/secure-preview/` and `/local-vault/` pages are separate and are not replaced.

**Do not add the real clinical CSV to this or any public GitHub repository.** Do not deploy patient data to Supabase before the data owner authorizes the transfer and the relevant privacy and cross-border requirements are addressed.

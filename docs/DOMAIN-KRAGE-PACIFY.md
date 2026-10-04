# Current domain: krage.pacify.site

Canonical metadata, sitemap, robots and social preview all use https://krage.pacify.site. The future krage.xyz migration is deferred.

- Add krage.pacify.site as a custom domain on the frontend host and follow its DNS/HTTPS instructions.
- Set room-service KRAGE_ORIGINS=https://krage.pacify.site,https://krage-frontend-n5rj.onrender.com during cutover. Existing environment settings override code defaults. Remove the old origin after redirecting that site.
- Keep NEXT_PUBLIC_ROOM_URL at the existing working WSS room endpoint. Deploy frontend and room server together (protocol 24).
- Supabase Site URL: https://krage.pacify.site; exact allowed redirect: https://krage.pacify.site/. Keep the same Supabase project and keys; Google redirects already use the current origin.
- Accounts remain in the same database. Browser-only guest saves and touch layouts do not automatically transfer from a different origin: connect/save on the old domain first.
- Verify quick play, invites, auth, cloud saves, /health, sitemap.xml and robots.txt. Submit the sitemap in Search Console.

DNS, hosting environment and Supabase dashboard settings require configuration outside this source build.

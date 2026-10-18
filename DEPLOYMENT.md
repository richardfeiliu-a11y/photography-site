# Deployment

Production runs on **Cloudflare Pages**, serving `https://gallery.mintnode.de` from the `main` branch.

## Release flow

Nothing is uploaded from a developer machine's build tree by hand. Each release is rebuilt from `main` and assembled into an immutable release directory:

```sh
# 1) Media pipeline + production build (Node 22)
npm run build:media

# 2) Assemble the candidate: build output + media derivatives, nine gates must pass
rm -rf /tmp/candidate && mkdir -p /tmp/candidate
cp -R dist/. /tmp/candidate/
cp -R generated/media /tmp/candidate/media
node --experimental-strip-types \
  scripts/release/assemble-release.mjs \
  --out releases/<timestamp> --dist /tmp/candidate --content .

# 3) Deploy the release directory to Pages
npx --yes wrangler@4.147.0 pages deploy releases/<timestamp> \
  --project-name <pages-project> --branch main \
  --commit-hash "$(git rev-parse --short HEAD)"
```

The release gates check, among other things: every published gallery/place page exists, every asset referenced by the HTML is present, no private sources or draft routes leak, no GPS metadata survives, the sitemap exactly matches the published canonical set, and every redirect target resolves. A failed gate leaves no release directory behind.

## Post-deploy verification

Never trust a dashboard alone — verify the published bytes:

```sh
curl -s https://gallery.mintnode.de/ | grep -o 'cover-stage\|home-cover-img\|application/ld+json'
curl -sI https://gallery.mintnode.de/about/     # expect 200
```

Then spot-check a gallery page for its rendered caption and a second theme via the Day / Night chips.

## Rollback

Cloudflare Pages keeps previous deployments. Roll back by promoting the previous deployment in the project dashboard (or redeploying the previous release directory). Keep the previous deployment id recorded next to every release.

## Notes

- `generated/` and `media/ingest-masters/` are not in Git; a deploy host needs the media masters or a previously derived media set.
- The privacy gate is part of the pipeline: if it fails, stop — do not deploy a partial media set.

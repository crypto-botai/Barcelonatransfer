> **NOT USED.** On 2026-10-13 the owner chose OpenRouteService (ORS) as the routing provider. Do not deploy or configure this folder. It is kept only as a reference and as a fallback plan if ORS is ever dropped. See `docs/ROUTING_ORS.md` in the apps repo.

# Self-hosted OSRM for EliteBCN

Nothing here is deployed by the repository. It is the recipe; creating the server, DNS name and TLS certificate needs your approval.

## 1. Server

Any Linux VPS (2 vCPU / 4 GB RAM / 20 GB disk, in the EU) is enough for Spain. Expected cost: about 5-20 EUR per month.

## 2. Map data (once, then monthly): `./prepare-data.sh` runs the commands below

```sh
mkdir -p data && cd data
wget https://download.geofabrik.de/europe/spain-latest.osm.pbf
docker run --rm -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-extract -p /opt/car.lua /data/spain-latest.osm.pbf
docker run --rm -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-partition /data/spain-latest.osrm
docker run --rm -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-customize /data/spain-latest.osrm
cd .. && docker compose up -d
```

The extract step needs about 8 GB of RAM for Spain; do it on a larger temporary machine or add swap. Re-run monthly from a cron job to keep roads current.

## 3. HTTPS

Put Caddy in front (automatic certificates):

```
routing.elitebcn.info {
  reverse_proxy 127.0.0.1:5000
}
```

Point a DNS A record for `routing.elitebcn.info` at the server. Restrict the proxy with a firewall rule if you can (Vercel's egress addresses are not fixed, so rate limiting in Caddy is the practical control).

## 4. Website configuration (Vercel, Production environment)

| Variable | Value |
| --- | --- |
| `ROUTING_BASE_URL` | `https://routing.elitebcn.info` |

There is no setting that allows the public OSRM demo in production: the website refuses it, and if `ROUTING_BASE_URL` is missing, invalid or plain http, routing is switched off: the apps then show a labelled straight-line estimate and no route line. Quotes use the same variable (unset keeps the existing quote behaviour).

## 5. Check it

Sign in as an administrator and open `/api/admin/routing-health`. Expected: `{"configured":true,"isDemo":false,"ok":true,"latencyMs":<number>,"breakerOpen":false}`. Add an uptime monitor on the same server's `/route/v1/driving/2.0785,41.2971;2.1686,41.3874?overview=false` (expects `"code":"Ok"`).

## Behaviour when the server is slow or down

Timeout 3.5 s, one retry on network errors and 5xx, circuit breaker (3 failed rounds, then 30 s without calls), at most 40 routing calls per minute per website instance, routes cached for 60 s and until the car has moved about 150 m. Failures show a labelled estimate; nothing is invented.

## Files in this folder

* `docker-compose.yml`: the OSRM container (bound to 127.0.0.1:5000, with a health check).
* `prepare-data.sh`: downloads Spain, builds the road graph, starts OSRM, runs a smoke test.
* `Caddyfile`: HTTPS reverse proxy that exposes only `/route/v1/driving/*` (rate limiting needs the caddy-ratelimit plugin; see the note in the file).

## Cut-over and rollback

1. Deploy and test the server first (section 5 check, plus `scripts/compare-quotes.mts` below).
2. Run `ROUTING_URL_PROPOSED=https://<your host> npx tsx scripts/compare-quotes.mts` from the website repo and review the price differences with the owner before changing anything.
3. Set `ROUTING_BASE_URL` in the Vercel **Preview** environment, deploy a preview, run the admin health check there.
4. Only then set it in Production and redeploy. Quotes and live tracking switch together.
5. Rollback: remove `ROUTING_BASE_URL` from Production and redeploy. Live tracking then shows labelled estimates (the public demo is refused in production); quotes return to their previous behaviour (the public demo), so prices are unchanged.

## Monitoring

Uptime monitor on `https://<host>/route/v1/driving/2.0785,41.2971;2.1686,41.3874?overview=false` expecting `"code":"Ok"`; alert by email. Disk and RAM alerts on the VPS. The website's own check is `/api/admin/routing-health` (administrator only).

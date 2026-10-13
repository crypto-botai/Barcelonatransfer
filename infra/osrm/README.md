# Self-hosted OSRM for EliteBCN

Nothing here is deployed by the repository. It is the recipe; creating the server, DNS name and TLS certificate needs your approval.

## 1. Server

Any Linux VPS (2 vCPU / 4 GB RAM / 20 GB disk, in the EU) is enough for Spain. Expected cost: about 5-20 EUR per month.

## 2. Map data (once, then monthly)

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

Do **not** set `ROUTING_ALLOW_PUBLIC_DEMO`. In production the website refuses the public OSRM demo and, if `ROUTING_BASE_URL` is missing or invalid, switches routing off: the apps then show a labelled straight-line estimate and no route line. Quotes use the same variable (unset keeps the existing quote behaviour).

## 5. Check it

Sign in as an administrator and open `/api/admin/routing-health`. Expected: `{"configured":true,"isDemo":false,"ok":true,"latencyMs":<number>,"breakerOpen":false}`. Add an uptime monitor on the same server's `/route/v1/driving/2.0785,41.2971;2.1686,41.3874?overview=false` (expects `"code":"Ok"`).

## Behaviour when the server is slow or down

Timeout 3.5 s, one retry on network errors and 5xx, circuit breaker (3 failed rounds, then 30 s without calls), at most 40 routing calls per minute per website instance, routes cached for 60 s and until the car has moved about 150 m. Failures show a labelled estimate; nothing is invented.

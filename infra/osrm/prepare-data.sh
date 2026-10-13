#!/usr/bin/env bash
# Builds the OSRM road graph for Spain. Run on the routing server (or a larger temporary machine) from infra/osrm.
# Needs Docker and about 8 GB of free RAM (or swap) for the extract step. Re-run monthly to keep roads current.
set -euo pipefail
IMAGE=ghcr.io/project-osrm/osrm-backend:v5.27.1
mkdir -p data
cd data
wget -N https://download.geofabrik.de/europe/spain-latest.osm.pbf
docker run --rm -v "$PWD:/data" "$IMAGE" osrm-extract -p /opt/car.lua /data/spain-latest.osm.pbf
docker run --rm -v "$PWD:/data" "$IMAGE" osrm-partition /data/spain-latest.osrm
docker run --rm -v "$PWD:/data" "$IMAGE" osrm-customize /data/spain-latest.osrm
cd ..
docker compose up -d
# Smoke test: airport to Plaça Catalunya should be about 14 km.
sleep 5
curl -fsS "http://127.0.0.1:5000/route/v1/driving/2.0785,41.2971;2.1686,41.3874?overview=false" | grep -q '"code":"Ok"' && echo "OSRM is answering"

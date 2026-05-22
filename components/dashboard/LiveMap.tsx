"use client";

import { useEffect, useRef, useState } from "react";

interface TrackingPoint {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  createdAt?: string;
}

interface Props {
  driverLat?: number;
  driverLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  trackingHistory?: TrackingPoint[];
  driverStatus?: string;
}

export default function LiveMap({
  driverLat, driverLng,
  pickupLat = 41.2974, pickupLng = 2.0833,
  dropoffLat = 41.3851, dropoffLng = 2.1734,
  trackingHistory = [],
  driverStatus,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const driverMarkerRef = useRef<unknown>(null);
  const routeLineRef = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const map = L.map(mapRef.current!, {
        center: [pickupLat, pickupLng],
        zoom: 12,
        zoomControl: false,
      });

      // Dark tile layer from CartoDB
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CartoDB",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Pickup marker (gold)
      const pickupIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#c9a84c;border:3px solid #fff;box-shadow:0 0 12px rgba(201,168,76,0.8);"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      L.marker([pickupLat, pickupLng], { icon: pickupIcon })
        .addTo(map)
        .bindPopup("<b>Pickup Location</b>");

      // Dropoff marker (white)
      const dropoffIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #c9a84c;box-shadow:0 0 8px rgba(255,255,255,0.4);"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      L.marker([dropoffLat, dropoffLng], { icon: dropoffIcon })
        .addTo(map)
        .bindPopup("<b>Drop-off Location</b>");

      // Driver marker
      if (driverLat && driverLng) {
        const driverIcon = L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#e4c97e);border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(201,168,76,0.5);font-size:18px;">🚗</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20], className: "",
        });
        driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon })
          .addTo(map)
          .bindPopup("<b>Your Driver</b><br>En route to pickup");
      }

      // Route line from tracking history or direct line
      if (trackingHistory.length > 1) {
        const coords = trackingHistory.map(p => [p.lat, p.lng] as [number, number]);
        routeLineRef.current = L.polyline(coords, {
          color: "#c9a84c",
          weight: 3,
          opacity: 0.8,
          dashArray: "8 4",
        }).addTo(map);
      } else {
        // Fallback: draw a direct line
        const directLine = L.polyline(
          [[pickupLat, pickupLng], [dropoffLat, dropoffLng]],
          { color: "#c9a84c30", weight: 2, dashArray: "6 6" }
        ).addTo(map);
        routeLineRef.current = directLine;
      }

      // Fit map to all markers
      const bounds: [number, number][] = [[pickupLat, pickupLng], [dropoffLat, dropoffLng]];
      if (driverLat && driverLng) bounds.push([driverLat, driverLng]);
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });

      mapInstanceRef.current = map;
    };

    initMap().catch(console.error);

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update driver marker position on change
  useEffect(() => {
    if (!mapInstanceRef.current || !driverMarkerRef.current || !driverLat || !driverLng) return;
    const marker = driverMarkerRef.current as { setLatLng: (pos: [number, number]) => void };
    marker.setLatLng([driverLat, driverLng]);
  }, [driverLat, driverLng]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-2xl overflow-hidden"
      style={{ minHeight: "300px", background: "#111" }}
    />
  );
}

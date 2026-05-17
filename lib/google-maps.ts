"use client";

export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];

export function getGoogleMapsApiUrl() {
  return `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry`;
}

export async function getDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [new google.maps.LatLng(origin.lat, origin.lng)],
        destinations: [new google.maps.LatLng(destination.lat, destination.lng)],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status === "OK" && response) {
          const element = response.rows[0]?.elements[0];
          if (element?.status === "OK") {
            resolve({
              distanceKm: element.distance.value / 1000,
              durationMin: Math.ceil(element.duration.value / 60),
            });
            return;
          }
        }
        resolve(null);
      }
    );
  });
}

export function initAutocomplete(
  input: HTMLInputElement,
  onSelect: (place: google.maps.places.PlaceResult) => void,
  options?: google.maps.places.AutocompleteOptions
) {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: ["es", "fr", "pt", "ad"] },
    fields: ["formatted_address", "geometry", "name", "place_id"],
    ...options,
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (place.geometry) onSelect(place);
  });
  return autocomplete;
}

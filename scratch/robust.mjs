const B="https://www.elitebcn.info", UA={"User-Agent":"EliteBCN-robust/1.0"};
const post=async(p,body)=>{try{
  const r=await fetch(B+p,{method:"POST",headers:{...UA,"Content-Type":"application/json"},body:typeof body==="string"?body:JSON.stringify(body)});
  return {s:r.status,t:(await r.text()).slice(0,120)};
}catch(e){return {s:0,t:e.message};}};
const getq=async(p)=>{try{const r=await fetch(B+p,{headers:UA});return {s:r.status,t:(await r.text()).slice(0,100)};}catch(e){return{s:0,t:e.message};}};

console.log("=== /api/quote with hostile input (must never 500) ===");
const cases=[
  ["malformed json","{not json"],
  ["empty object",{}],
  ["null coords",{pickupLat:null,pickupLng:null,vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00"}],
  ["NaN coords",{pickupLat:"NaN",pickupLng:"NaN",vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00"}],
  ["out-of-range coords",{pickupLat:999,pickupLng:-999,dropoffLat:500,dropoffLng:500,vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00"}],
  ["bad vehicle class",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"SPACESHIP",pickupDatetime:"2026-09-01T10:00"}],
  ["bad date",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",pickupDatetime:"not-a-date"}],
  ["past date",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",pickupDatetime:"2020-01-01T10:00"}],
  ["huge address",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00",pickupAddress:"A".repeat(50000)}],
  ["xss in address",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00",pickupAddress:"<script>alert(1)</script>"}],
  ["sqli in address",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",pickupDatetime:"2026-09-01T10:00",pickupAddress:"'; DROP TABLE bookings;--"}],
  ["negative passengers",{pickupLat:41.3,pickupLng:2.1,dropoffLat:41.4,dropoffLng:2.2,vehicleClass:"ECONOMY",passengers:-5,pickupDatetime:"2026-09-01T10:00"}],
];
let bad=0;
for(const [name,body] of cases){
  const r=await post("/api/quote",body);
  const ok=r.s>0&&r.s<500;
  if(!ok)bad++;
  console.log(`  ${String(r.s).padEnd(4)} ${name.padEnd(22)} ${ok?"":"<-- 5xx!"} ${r.s>=500?r.t:""}`);
}

console.log("\n=== /api/geo/search hostile input ===");
for(const q of ["","ab","%00","<script>alert(1)</script>","'"+"A".repeat(5000),"../../etc/passwd","%2e%2e%2f"]){
  const r=await getq(`/api/geo/search?q=${encodeURIComponent(q)}`);
  console.log(`  ${String(r.s).padEnd(4)} q="${q.slice(0,28)}"${r.s>=500?"  <-- 5xx!":""}`);
  if(r.s>=500)bad++;
}

console.log("\n=== /api/bookings hostile input (must reject, never 500) ===");
for(const [name,body] of [
  ["empty",{}],
  ["missing quote",{bookingType:"TRANSFER",pickupAddress:"T1",pickupLat:41.3,pickupLng:2.1,date:"2026-09-01",time:"10:00",passengers:1,luggage:0,vehicleClass:"ECONOMY",guestName:"A B",guestEmail:"a@b.co",guestPhone:"+34600000000"}],
  ["bad email",{bookingType:"TRANSFER",pickupAddress:"T1",pickupLat:41.3,pickupLng:2.1,dropoffAddress:"X",dropoffLat:41.4,dropoffLng:2.2,date:"2026-09-01",time:"10:00",passengers:1,luggage:0,vehicleClass:"ECONOMY",guestName:"A B",guestEmail:"not-an-email",guestPhone:"+34600000000",quote:{distanceKm:1,durationMin:1,baseFare:50,distanceFare:0,airportSurcharge:0,nightSurcharge:0,totalAmount:50}}],
  ["negative total (price tamper)",{bookingType:"TRANSFER",pickupAddress:"Terminal 1 El Prat",pickupLat:41.2971,pickupLng:2.0785,dropoffAddress:"Barcelona",dropoffLat:41.39,dropoffLng:2.16,date:"2026-12-01",time:"10:00",passengers:1,luggage:0,vehicleClass:"ECONOMY",guestName:"A B",guestEmail:"a@b.co",guestPhone:"+34600000000",quote:{distanceKm:1,durationMin:1,baseFare:-999,distanceFare:0,airportSurcharge:0,nightSurcharge:0,totalAmount:-999}}],
]){
  const r=await post("/api/bookings",body);
  const ok=r.s>0&&r.s<500;
  if(!ok)bad++;
  console.log(`  ${String(r.s).padEnd(4)} ${name.padEnd(30)} ${ok?"":"<-- 5xx!"} ${r.t.slice(0,70)}`);
}
console.log(`\n${bad} endpoints returned a server error`);

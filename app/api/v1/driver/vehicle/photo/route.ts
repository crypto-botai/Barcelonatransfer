import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireDriver } from "@/lib/api/v1/driver-rides";
import { parsePhoto, storePhoto } from "@/lib/api/v1/profile-photo";
import { vehiclePhotos } from "@/lib/api/v1/vehicle";

export const dynamic = "force-dynamic";

const side = z.enum(["front", "back"]);
const body = z.object({ side, image: z.string().min(32).max(700_000) });

const column = (s: z.infer<typeof side>) => (s === "front" ? "vehiclePhotoFront" : "vehiclePhotoBack");

/** PUT /api/v1/driver/vehicle/photo { side, image }: the front or back photo of the driver's car, checked like a profile photo. */
export const PUT = apiHandler(
  "driver.vehicle.photo.set",
  async ({ req, auth, requestId }) => {
    const input = await parseBody(req, body, 800_000);
    const driver = await requireDriver(auth!.userId);
    const url = await storePhoto(`${auth!.userId}-car-${input.side}`, parsePhoto(input.image));
    await prisma.driver.update({ where: { id: driver.id }, data: { [column(input.side)]: url } });
    await audit({ action: "API_V1_VEHICLE_PHOTO_SET", entity: "driver", entityId: driver.id, actorId: auth!.userId, actorRole: "DRIVER", requestId, ip: clientAddress(req), details: { side: input.side } });
    return vehiclePhotos(driver.id);
  },
  { auth: { roles: ["DRIVER"] } },
);

/** DELETE /api/v1/driver/vehicle/photo?side=front|back */
export const DELETE = apiHandler(
  "driver.vehicle.photo.remove",
  async ({ req, auth }) => {
    const checked = side.safeParse(new URL(req.url).searchParams.get("side"));
    if (!checked.success) throw new ApiError("VALIDATION_FAILED", "Say which photo: front or back.");
    const parsed = checked.data;
    const driver = await requireDriver(auth!.userId);
    await prisma.driver.update({ where: { id: driver.id }, data: { [column(parsed)]: null } });
    return vehiclePhotos(driver.id);
  },
  { auth: { roles: ["DRIVER"] } },
);

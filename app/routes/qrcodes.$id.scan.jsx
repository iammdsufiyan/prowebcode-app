import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import db from '../db.server';
import { getDestinationUrl } from "../models/QRCode.server";

export const loader = async ({ params }) => {
  // Validate that the ID exists in the route params
  invariant(params.id, "QR code ID is required");

  const id = params.id;

  // Look up the QR code in the database
  const qrCode = await db.qRCode.findFirst({ where: { id } });
  invariant(qrCode, "QR code not found");

  // Increment scan count
  await db.qRCode.update({
    where: { id },
    data: { scans: { increment: 1 } },
  });

  // Redirect to destination (product page or checkout)
  return redirect(getDestinationUrl(qrCode));
};

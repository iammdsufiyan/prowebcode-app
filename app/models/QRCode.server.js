import qrcode from "qrcode";
import invariant from "tiny-invariant";
import db from '../db.server';

export async function getQRCode(id, graphql) {
  const qrCode = await db.qRCode.findFirst({
    where: { id },
    include: {
      scanLogs: {
        orderBy: { scannedAt: 'desc' },
        take: 10 // Get last 10 scans for quick preview
      }
    }
  });

  if (!qrCode) {
    return null;
  }

  return supplementQRCode(qrCode, graphql);
}

export async function getQRCodes(shop, graphql) {
  const qrCodes = await db.qRCode.findMany({
    where: { shop },
    orderBy: { id: "desc" },
    include: {
      scanLogs: {
        orderBy: { scannedAt: 'desc' },
        take: 5 // Get last 5 scans for overview
      }
    }
  });

  if (qrCodes.length === 0) return [];

  return Promise.all(
    qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
  );
}

export function getQRCodeImage(id, customization = {}) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  
  // For now, use the basic qrcode library with some customization
  const options = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: customization.foregroundColor || '#000000',
      light: customization.backgroundColor || '#FFFFFF'
    },
    width: 156
  };
  
  return qrcode.toDataURL(url.href, options);
}

export async function getCustomQRCodeImage(id, customization = {}) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  
  // Enhanced QR code generation with logo support
  const options = {
    errorCorrectionLevel: customization.logoUrl ? 'H' : 'M', // High error correction for logos
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: customization.foregroundColor || '#000000',
      light: customization.backgroundColor || '#FFFFFF'
    },
    width: 300
  };
  
  // Generate base QR code
  const qrDataUrl = await qrcode.toDataURL(url.href, options);
  
  // If no logo, return basic QR code
  if (!customization.logoUrl) {
    return qrDataUrl;
  }
  
  // If logo is provided, we'll need to composite it
  // For now, return the basic version with a note
  // TODO: Implement server-side logo compositing using Canvas or similar
  return qrDataUrl;
}

export function getDestinationUrl(qrCode) {
  if (qrCode.destination === "product") {
    return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
  }

  const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
  invariant(match, "Unrecognized product variant ID");

  return `https://${qrCode.shop}/cart/${match[1]}:1`;
}

async function supplementQRCode(qrCode, graphql) {
  const customization = {
    foregroundColor: qrCode.foregroundColor,
    backgroundColor: qrCode.backgroundColor,
    logoUrl: qrCode.logoUrl,
    frameStyle: qrCode.frameStyle,
    callToAction: qrCode.callToAction,
    cornerRadius: qrCode.cornerRadius,
    dotStyle: qrCode.dotStyle,
    eyeStyle: qrCode.eyeStyle,
    gradientType: qrCode.gradientType,
    gradientColor1: qrCode.gradientColor1,
    gradientColor2: qrCode.gradientColor2,
  };
  
  const qrCodeImagePromise = getQRCodeImage(qrCode.id, customization);

  const response = await graphql(
    `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          media(first: 1) {
            nodes {
              preview {
                image {
                  altText
                  url
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: qrCode.productId,
      },
    }
  );

  const {
    data: { product },
  } = await response.json();

  return {
    ...qrCode,
    productDeleted: !product?.title,
    productTitle: product?.title,
    productImage: product?.media?.nodes[0]?.preview?.image?.url,
    productAlt: product?.media?.nodes[0]?.preview?.image?.altText,
    destinationUrl: getDestinationUrl(qrCode),
    image: await qrCodeImagePromise,
  };
}

export function validateQRCode(data) {
  const errors = {};

  if (!data.title) {
    errors.title = "Title is required";
  }

  if (!data.productId) {
    errors.productId = "Product is required";
  }

  if (!data.destination) {
    errors.destination = "Destination is required";
  }

  if (Object.keys(errors).length) {
    return errors;
  }
}

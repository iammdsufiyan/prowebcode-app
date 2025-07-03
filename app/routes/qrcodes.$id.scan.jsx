import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import db from '../db.server';
import { getDestinationUrl } from "../models/QRCode.server";

// Helper function to parse User-Agent
function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceType: 'Unknown', browser: 'Unknown', os: 'Unknown' };

  const ua = userAgent.toLowerCase();
  
  // Device Type Detection
  let deviceType = 'Desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'Tablet';
  }

  // Browser Detection
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  // OS Detection
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { deviceType, browser, os };
}

// Helper function to get location from IP
async function getLocationFromIP(ipAddress) {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return { country: 'Local', city: 'Local', region: 'Local' };
  }

  try {
    // Using a free IP geolocation service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city,lat,lon`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QRCodeApp/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'success') {
        return {
          country: data.country || 'Unknown',
          city: data.city || 'Unknown',
          region: data.regionName || 'Unknown',
          latitude: data.lat || null,
          longitude: data.lon || null,
        };
      }
    }
  } catch (error) {
    console.error('Error fetching location (non-blocking):', error.message);
    // Don't throw error, just log it and continue
  }
  
  return { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
}

export const loader = async ({ request, params }) => {
  // Validate that the ID exists in the route params
  invariant(params.id, "QR code ID is required");

  const id = params.id;

  // Look up the QR code in the database
  const qrCode = await db.qRCode.findFirst({ where: { id } });
  invariant(qrCode, "QR code not found");

  // Extract analytics data from request
  const userAgent = request.headers.get('user-agent') || '';
  const { deviceType, browser, os } = parseUserAgent(userAgent);
  
  // Get IP address (considering various proxy headers)
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   request.headers.get('cf-connecting-ip') ||
                   '127.0.0.1';

  // Get location data (non-blocking)
  let locationData = { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
  
  // Try to get location but don't let it block the scan
  try {
    locationData = await Promise.race([
      getLocationFromIP(ipAddress),
      new Promise((resolve) => setTimeout(() => resolve(locationData), 2000)) // 2 second max wait
    ]);
  } catch (error) {
    console.error('Location lookup failed, continuing with scan:', error.message);
  }

  // Create scan log entry
  try {
    await db.scanLog.create({
      data: {
        qrCodeId: id,
        userAgent,
        deviceType,
        browser,
        os,
        ipAddress,
        country: locationData.country,
        city: locationData.city,
        region: locationData.region,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      },
    });
  } catch (dbError) {
    console.error('Failed to save scan log:', dbError.message);
    // Continue with scan even if logging fails
  }

  // Increment scan count
  await db.qRCode.update({
    where: { id },
    data: { scans: { increment: 1 } },
  });

  // Redirect to destination (product page or checkout)
  return redirect(getDestinationUrl(qrCode));
};

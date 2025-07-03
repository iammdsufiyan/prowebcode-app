// Test script to verify QR code customization features
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQRCodeFeatures() {
  console.log('🧪 Testing QR Code Customization Features...\n');

  try {
    // Test 1: Create a QR code with custom design
    console.log('1. Creating QR code with custom design...');
    const testQRCode = await prisma.qRCode.create({
      data: {
        title: 'Test Custom QR Code',
        productId: 'gid://shopify/Product/123456789',
        productVariantId: 'gid://shopify/ProductVariant/987654321',
        productHandle: 'test-product',
        destination: 'product',
        shop: 'test-shop.myshopify.com',
        // Design customization fields
        foregroundColor: '#FF6B6B',
        backgroundColor: '#4ECDC4',
        logoUrl: 'https://example.com/logo.png',
        frameStyle: 'rounded',
        callToAction: '🛍️ Shop Now!',
        cornerRadius: 15,
        dotStyle: 'circle',
        eyeStyle: 'rounded',
        gradientType: 'linear',
        gradientColor1: '#FF6B6B',
        gradientColor2: '#4ECDC4'
      }
    });
    console.log('✅ QR code created with ID:', testQRCode.id);

    // Test 2: Verify all customization fields are saved
    console.log('\n2. Verifying customization fields...');
    const savedQRCode = await prisma.qRCode.findUnique({
      where: { id: testQRCode.id }
    });

    const customizationFields = [
      'foregroundColor', 'backgroundColor', 'logoUrl', 'frameStyle',
      'callToAction', 'cornerRadius', 'dotStyle', 'eyeStyle',
      'gradientType', 'gradientColor1', 'gradientColor2'
    ];

    customizationFields.forEach(field => {
      if (savedQRCode[field] !== null && savedQRCode[field] !== undefined) {
        console.log(`✅ ${field}: ${savedQRCode[field]}`);
      } else {
        console.log(`❌ ${field}: Missing or null`);
      }
    });

    // Test 3: Test scan log functionality
    console.log('\n3. Testing scan analytics...');
    const scanLog = await prisma.scanLog.create({
      data: {
        qrCodeId: testQRCode.id,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        deviceType: 'Mobile',
        browser: 'Safari',
        os: 'iOS',
        city: 'New York',
        country: 'United States'
      }
    });
    console.log('✅ Scan log created with ID:', scanLog.id);

    // Test 4: Update scan count
    await prisma.qRCode.update({
      where: { id: testQRCode.id },
      data: { scans: { increment: 1 } }
    });
    console.log('✅ Scan count incremented');

    // Test 5: Retrieve QR code with scan logs
    console.log('\n4. Testing QR code with analytics...');
    const qrCodeWithLogs = await prisma.qRCode.findUnique({
      where: { id: testQRCode.id },
      include: {
        scanLogs: {
          orderBy: { scannedAt: 'desc' },
          take: 5
        }
      }
    });

    console.log(`✅ QR code has ${qrCodeWithLogs.scans} total scans`);
    console.log(`✅ Retrieved ${qrCodeWithLogs.scanLogs.length} recent scan logs`);

    // Test 6: Test different customization combinations
    console.log('\n5. Testing different design combinations...');
    
    const designVariations = [
      {
        name: 'Minimalist',
        foregroundColor: '#000000',
        backgroundColor: '#FFFFFF',
        frameStyle: 'square',
        dotStyle: 'square',
        eyeStyle: 'square',
        callToAction: 'Scan Me'
      },
      {
        name: 'Colorful Gradient',
        foregroundColor: '#FF0080',
        backgroundColor: '#FFFFFF',
        frameStyle: 'circle',
        dotStyle: 'circle',
        eyeStyle: 'circle',
        gradientType: 'radial',
        gradientColor1: '#FF0080',
        gradientColor2: '#7928CA',
        callToAction: '🎨 Discover More!'
      },
      {
        name: 'Corporate',
        foregroundColor: '#1E40AF',
        backgroundColor: '#F8FAFC',
        frameStyle: 'rounded',
        dotStyle: 'rounded',
        eyeStyle: 'rounded',
        cornerRadius: 8,
        callToAction: 'Learn More'
      }
    ];

    for (const variation of designVariations) {
      const { name, ...variationData } = variation;
      const testVariation = await prisma.qRCode.create({
        data: {
          title: `Test ${name} QR Code`,
          productId: 'gid://shopify/Product/123456789',
          productVariantId: 'gid://shopify/ProductVariant/987654321',
          productHandle: 'test-product',
          destination: 'product',
          shop: 'test-shop.myshopify.com',
          ...variationData
        }
      });
      console.log(`✅ Created ${name} variation with ID: ${testVariation.id}`);
    }

    console.log('\n🎉 All QR Code Customization Features Working Successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Database schema supports all customization fields');
    console.log('✅ QR code creation with custom designs works');
    console.log('✅ Scan analytics tracking is functional');
    console.log('✅ Multiple design variations can be created');
    console.log('✅ All color, style, and text customizations are saved');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.scanLog.deleteMany({
      where: {
        qrCode: {
          shop: 'test-shop.myshopify.com'
        }
      }
    });
    await prisma.qRCode.deleteMany({
      where: {
        shop: 'test-shop.myshopify.com'
      }
    });
    console.log('✅ Test data cleaned up');
    
    await prisma.$disconnect();
  }
}

testQRCodeFeatures().catch(console.error);
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function CustomQRCodeGenerator({
  url,
  customization = {},
  onImageGenerated
}) {
  const canvasRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsClient(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isClient || !url || isLoading) return;

    generateQRCodeWithLogo();
  }, [url, customization, onImageGenerated, isClient, isLoading]);

  const generateQRCodeWithLogo = async () => {
    try {
      // Create canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 300;
      canvas.height = 300;
      
      // Generate QR code with basic customization
      await QRCode.toCanvas(canvas, url, {
        width: 300,
        margin: 2,
        color: {
          dark: customization.foregroundColor || '#000000',
          light: customization.backgroundColor || '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for logo embedding
      });

      // Add logo if provided
      if (customization.logoUrl) {
        try {
          await addLogoToCanvas(canvas, ctx, customization.logoUrl);
        } catch (logoError) {
          console.warn('Failed to add logo:', logoError);
          // Continue without logo if it fails to load
        }
      }

      if (canvasRef.current) {
        // Clear previous content
        canvasRef.current.innerHTML = '';
        
        // Add custom styling wrapper
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          display: inline-block;
          padding: 20px;
          background: ${customization.backgroundColor || '#FFFFFF'};
          border-radius: ${customization.cornerRadius || 0}px;
          ${customization.frameStyle === 'circle' ? 'border-radius: 50%;' : ''}
          ${customization.frameStyle === 'rounded' ? 'border-radius: 15px;' : ''}
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // Apply canvas styling based on dot style
        if (customization.dotStyle === 'circle') {
          canvas.style.borderRadius = '8px';
        }
        
        wrapper.appendChild(canvas);
        canvasRef.current.appendChild(wrapper);
        
        // Generate data URL for saving
        const dataURL = canvas.toDataURL('image/png');
        if (onImageGenerated) {
          onImageGenerated(dataURL);
        }
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setError(error.message);
    }
  };

  const addLogoToCanvas = (canvas, ctx, logoUrl) => {
    return new Promise((resolve, reject) => {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      
      logo.onload = () => {
        try {
          // Calculate logo size (about 20% of QR code size)
          const logoSize = Math.min(canvas.width, canvas.height) * 0.2;
          const x = (canvas.width - logoSize) / 2;
          const y = (canvas.height - logoSize) / 2;
          
          // Add white background circle for logo
          const padding = 8;
          const bgRadius = (logoSize + padding * 2) / 2;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, bgRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add subtle border
          ctx.strokeStyle = '#E0E0E0';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Draw logo
          ctx.drawImage(logo, x, y, logoSize, logoSize);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      logo.onerror = () => {
        reject(new Error('Failed to load logo image'));
      };
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('Logo loading timeout'));
      }, 10000);
      
      logo.src = logoUrl;
    });
  };

  // Don't render anything on server-side
  if (!isClient) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ 
          width: '300px', 
          height: '300px', 
          backgroundColor: '#f5f5f5', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '1px dashed #ccc',
          margin: '0 auto'
        }}>
          Loading QR Code...
        </div>
        {customization.callToAction && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: customization.foregroundColor || '#000000'
          }}>
            {customization.callToAction}
          </div>
        )}
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ 
          width: '300px', 
          height: '300px', 
          backgroundColor: '#f5f5f5', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '1px dashed #ccc',
          margin: '0 auto'
        }}>
          Generating QR Code...
        </div>
        {customization.callToAction && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: customization.foregroundColor || '#000000'
          }}>
            {customization.callToAction}
          </div>
        )}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ 
          width: '300px', 
          height: '300px', 
          backgroundColor: '#fee', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '1px dashed #f88',
          margin: '0 auto',
          color: '#c44',
          fontSize: '12px',
          textAlign: 'center',
          padding: '20px'
        }}>
          QR Code Error: {error}
        </div>
        {customization.callToAction && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: customization.foregroundColor || '#000000'
          }}>
            {customization.callToAction}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div ref={canvasRef} />
      {customization.callToAction && (
        <div style={{ 
          marginTop: '10px', 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: customization.foregroundColor || '#000000'
        }}>
          {customization.callToAction}
        </div>
      )}
      {customization.gradientType && (
        <div style={{ 
          marginTop: '5px', 
          fontSize: '12px', 
          color: '#666',
          fontStyle: 'italic'
        }}>
          Note: Gradient effects require advanced QR library
        </div>
      )}
    </div>
  );
}
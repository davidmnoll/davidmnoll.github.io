/**
 * QR-TCP Demo Post Component
 *
 * This is a thin wrapper that renders the Web Component.
 * The Web Component is framework-agnostic and defined in @/lib/qrmesh.
 */

import { useEffect, useRef } from 'react';
import { registerQRTCPElement } from '@/lib/qrmesh';

// Ensure the web component is registered
registerQRTCPElement();

// Declare the custom element for TypeScript/JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'qrtcp-demo': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export function QRTCPDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The web component auto-registers, but we ensure it's registered
    registerQRTCPElement();
  }, []);

  return (
    <div ref={containerRef}>
      <qrtcp-demo />
    </div>
  );
}

export default QRTCPDemo;

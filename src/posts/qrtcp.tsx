/* eslint-disable react-refresh/only-export-components */
import PostPage from './PostPage';
import { QRTCPDemo } from './post_resources/qrtcp';

export const meta = {
  title: 'TCP over QR Code',
  summary:
    'A demo of mesh peer discovery using QR codes as the physical layer. Point two devices at each other and watch them establish encrypted connections using TCP-like handshakes.',
  image: '/blog-images/qrtcp-thumb.svg',
  date: '2026-01-10',
};

export default function QRTCP() {
  return (
    <PostPage title={meta.title}>
      <div className="mb-4">
        <p className="mb-2">
          This demo implements a TCP-like protocol over QR codes. Each device displays
          QR codes containing protocol packets, and scans the other device's QR codes
          using the camera.
        </p>
        <p className="mb-2">
          <strong>To use:</strong> Open this page on two devices (e.g., phone and laptop),
          start the cameras, and point them at each other's screens. The devices will
          discover each other and you can establish encrypted connections.
        </p>
      </div>
      <QRTCPDemo />
    </PostPage>
  );
}

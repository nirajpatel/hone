import { useRef } from 'react';
import { Coffee } from '../types';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';
import { StandardDialog } from './ui/standard-dialog';
import { QRCodeCanvas } from 'qrcode.react@4.1.0';

interface QRCodeDialogProps {
  coffee: Coffee | null;
  onClose: () => void;
}

export function QRCodeDialog({ coffee, onClose }: QRCodeDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!qrRef.current || !coffee) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get the canvas element and convert to data URL
    const canvasElement = qrRef.current.querySelector('canvas');
    if (!canvasElement) return;

    const imageData = canvasElement.toDataURL('image/png');

    // Format roast date - parse as local date to avoid timezone issues
    const roastDate = (() => {
      const dateStr = coffee.roastDate;
      if (dateStr.includes('T')) {
        // If it has a time component, use normal Date parsing
        return new Date(dateStr).toLocaleDateString();
      } else {
        // If it's just a date string (YYYY-MM-DD), parse as local date
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString();
      }
    })();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${coffee.roaster} ${coffee.name}</title>
          <style>
            @page {
              size: 2in 3in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              width: 2in;
              height: 3in;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              font-family: system-ui, -apple-system, sans-serif;
              box-sizing: border-box;
            }
            .container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 0.15in;
              box-sizing: border-box;
            }
            h1 {
              font-size: 13pt;
              margin: 0 0 3px 0;
              font-weight: 600;
              line-height: 1.2;
              text-align: center;
            }
            h2 {
              font-size: 11pt;
              margin: 0 0 3px 0;
              font-weight: 500;
              color: #444;
              line-height: 1.2;
              text-align: center;
            }
            .date {
              font-size: 8pt;
              margin: 0 0 8px 0;
              color: #666;
              line-height: 1.2;
              text-align: center;
            }
            img {
              display: block;
              width: 1.5in;
              height: 1.5in;
              margin: 0 auto;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${coffee.roaster}</h1>
            <h2>${coffee.name}</h2>
            <div class="date">Roasted ${roastDate}</div>
            <img src="${imageData}" alt="QR Code" />
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  if (!coffee) return null;

  // Helper function to format date correctly
  const formatRoastDate = (dateStr: string) => {
    if (dateStr.includes('T')) {
      // If it has a time component, use normal Date parsing
      return new Date(dateStr).toLocaleDateString();
    } else {
      // If it's just a date string (YYYY-MM-DD), parse as local date
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString();
    }
  };

  return (
    <StandardDialog 
      open={!!coffee} 
      onOpenChange={onClose}
      title="Label"
      maxWidth="28rem"
    >
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <div className="font-medium text-gray-900">{coffee.roaster}</div>
          <div className="text-gray-700">{coffee.name}</div>
          <div className="text-sm text-gray-500">
            Roasted {formatRoastDate(coffee.roastDate)}
          </div>
        </div>
        <div className="flex justify-center bg-white p-4 rounded border" ref={qrRef}>
          <QRCodeCanvas value={coffee.id} size={256} level="H" />
        </div>
        <div className="text-sm text-gray-600 text-center">
          This label can be used to track beans and scanned whenever adding a new brew.
        </div>
        <Button onClick={handlePrint} className="w-full cursor-pointer">
          <Printer className="w-4 h-4 mr-2" />
          Print Label
        </Button>
      </div>
    </StandardDialog>
  );
}
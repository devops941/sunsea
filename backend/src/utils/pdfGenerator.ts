import puppeteer from 'puppeteer';

export const generatePdfFromHtml = async (htmlContent: string): Promise<Buffer> => {
    // Launch headless browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Set HTML content
        await page.setContent(htmlContent, { waitUntil: 'load' });
        // Give Tailwind CDN time to process and inject styles
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
};

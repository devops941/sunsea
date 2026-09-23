import puppeteer from 'puppeteer';

export const generatePdfFromHtml = async (htmlContent: string): Promise<Buffer> => {
    // Launch headless browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Load HTML via a data URL so we can use networkidle0
        const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`;
        await page.goto(dataUrl, { waitUntil: 'networkidle0', timeout: 15000 });

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
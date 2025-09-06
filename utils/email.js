const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send a notification email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 */
async function sendNotificationEmail(to, subject, text, html = null) {
    try {
        if (!process.env.SMTP_USER) {
            console.log('📧 Email not configured, skipping email to:', to);
            return;
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: `[Suara Samudra] ${subject}`,
            text,
            html: html || generateHtmlTemplate(subject, text)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

/**
 * Send story contribution confirmation email
 * @param {string} to - Recipient email address
 * @param {string} contributionId - Contribution ID
 * @param {string} storyTitle - Story title
 */
async function sendContributionConfirmation(to, contributionId, storyTitle) {
    const subject = 'Story Contribution Received';
    const text = `
Thank you for sharing your story "${storyTitle}" with Suara Samudra.

Your contribution (ID: ${contributionId}) has been received and will be reviewed by our team. We appreciate you taking the time to share your experience with our community.

You can check the status of your contribution at any time by visiting our website.

Best regards,
The Suara Samudra Team
    `;

    return sendNotificationEmail(to, subject, text);
}

/**
 * Send quiz completion certificate email
 * @param {string} to - Recipient email address
 * @param {string} userName - User name
 * @param {number} score - Quiz score
 * @param {number} percentage - Score percentage
 */
async function sendQuizCertificate(to, userName, score, percentage) {
    const subject = 'Quiz Completion Certificate';
    const text = `
Congratulations ${userName}!

You have successfully completed the Disaster Preparedness Quiz with a score of ${score}/30 (${percentage}%).

${percentage >= 70 ? 'You have earned a certificate of completion!' : 'Keep learning and try again to earn your certificate!'}

Thank you for participating in our educational program.

Best regards,
The Suara Samudra Team
    `;

    return sendNotificationEmail(to, subject, text);
}

/**
 * Generate HTML email template
 * @param {string} title - Email title
 * @param {string} content - Email content
 * @returns {string} HTML template
 */
function generateHtmlTemplate(title, content) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #006994 0%, #00b4d8 50%, #90e0ef 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8f9fa;
            padding: 30px 20px;
            border-radius: 0 0 10px 10px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .tagline {
            font-size: 14px;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🌊 Suara Samudra</div>
        <div class="tagline">AI-Powered Story Archive of Aceh</div>
    </div>
    <div class="content">
        <h2>${title}</h2>
        <div style="white-space: pre-line;">${content}</div>
    </div>
    <div class="footer">
        <p>This email was sent by Suara Samudra</p>
        <p>© 2024 Suara Samudra. All rights reserved.</p>
    </div>
</body>
</html>
    `;
}

module.exports = {
    sendNotificationEmail,
    sendContributionConfirmation,
    sendQuizCertificate,
    generateHtmlTemplate
};
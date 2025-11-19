const mailjet = require('node-mailjet').apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

// Email sending function (same signature as before)
const sendEmail = async (to, subject, text, html = null) => {
  try {
    const request = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL,
              Name: process.env.MAILJET_FROM_NAME || 'Recipe Box'
            },
            To: [
              {
                Email: to,
                Name: to.split('@')[0]
              }
            ],
            Subject: subject,
            TextPart: text,
            HTMLPart: html || text
          }
        ]
      });

    console.log('Mailjet email sent:', request.body.Messages[0].To[0].MessageID);
    return { 
      success: true, 
      messageId: request.body.Messages[0].To[0].MessageID 
    };
  } catch (error) {
    console.error('Mailjet email sending failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Verify connection configuration
const verifyConnection = async () => {
  try {
    const request = await mailjet
      .get('user')
      .request();
    console.log('Mailjet connection verified');
    return true;
  } catch (error) {
    console.error('Mailjet connection error:', error);
    return false;
  }
};

// Test connection on startup
verifyConnection();

module.exports = { sendEmail };
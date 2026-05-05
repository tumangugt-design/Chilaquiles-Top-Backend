
export const sendWhatsAppOTP = async (phone, code) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'verification_code';

    if (!token || !phoneNumberId) {
        console.error('WhatsApp credentials missing in .env');
        return false;
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    // Standard WhatsApp Authentication Template payload
    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: 'es'
            },
            components: [
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: code
                        }
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        {
                            type: 'text',
                            text: code
                        }
                    ]
                }
            ]
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('WhatsApp API Error:', data);
            return false;
        }

        return true;
    } catch (error) {
        console.error('WhatsApp sending failed:', error);
        return false;
    }
};

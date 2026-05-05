
export const sendWhatsAppOTP = async (phone, code) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'verification_code';

    if (!token || !phoneNumberId) {
        console.error('WhatsApp credentials missing in .env');
        return { success: false, error: 'Configuración de WhatsApp incompleta' };
    }

    // Normalize phone number (E.164 without +)
    let cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
    
    // If it's a Guatemala number without country code (8 digits)
    if (cleanPhone.length === 8) {
        cleanPhone = '502' + cleanPhone;
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: 'en_US'
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
            console.error('WhatsApp API Error:', JSON.stringify(data, null, 2));
            return { 
                success: false, 
                error: data.error?.message || 'Error en la API de WhatsApp',
                details: data
            };
        }

        return { success: true };
    } catch (error) {
        console.error('WhatsApp sending failed:', error);
        return { success: false, error: error.message };
    }
};

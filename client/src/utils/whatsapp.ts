
export const getWhatsAppLink = (phone: string, message: string) => {
    // Remove non-numeric characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Add country code if missing (assuming BR +55)
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

    const encodedMessage = encodeURIComponent(message);

    return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
};

export const generateMessage = (template: 'PROPOSAL' | 'FOLLOWUP' | 'COLLECTION', context: any) => {
    const { clientName, vehicle, link } = context;
    const firstName = clientName.split(' ')[0];

    switch (template) {
        case 'PROPOSAL':
            return `Olá ${firstName}, tudo bem? Aqui é da FlashCred. Tenho uma condição especial pré-aprovada para você levar o ${vehicle}. Podemos conversar?`;

        case 'FOLLOWUP':
            return `Oi ${firstName}, vi que você simulou o ${vehicle} conosco recentemente. Consegui uma taxa diferenciada hoje. Tem interesse em ver a proposta?`;

        case 'COLLECTION':
            return `Olá ${firstName}, tentei te ligar referente ao seu financiamento. Pode me retornar por aqui?`;

        default:
            return `Olá ${firstName}, tudo bem?`;
    }
};

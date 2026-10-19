const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Farmer lookup that accepts either a phone number (USSD, phone accounts) or the farmer's id
 * (accounts created with an email have no phone). Phone numbers never look like UUIDs.
 */
export const farmerWhere = (key: string): { id: string } | { phone: string } =>
  UUID.test(key) ? { id: key } : { phone: key };

// Generate 4-digit PIN for farmers
export const generateFarmerPIN = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Generate 8-character password for restaurants (Capital + small + symbol + numbers)
export const generateRestaurantPassword = (): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining 4 characters randomly
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 0; i < 4; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

import { sendMessage } from './sms.utility';

// Send password via SMS using existing Twilio service
export const sendPasswordSMS = async (phone: string, password: string, userType: 'farmer' | 'restaurant'): Promise<void> => {
 const message =
   userType === "farmer"
     ? `Your account PIN is: ${password}. Please keep it secure. You can now log in at https://www.food.rw/login.`
     : `Your account password is: ${password}. Please keep it secure. You can now log in at https://www.food.rw/login.`;
  
  
  try {
    await sendMessage(message, phone);
  } catch (error: any) {
    throw new Error(`SMS sending failed: ${error.message}`);
  }
};
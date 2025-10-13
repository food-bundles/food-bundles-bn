export function validateTIN(tin: string): boolean {
  const tinRegex = /^[0-9]{9}$/;
  return tinRegex.test(tin) && tin !== "000000000";
}

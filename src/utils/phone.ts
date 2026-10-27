// Every common way a Rwandan mobile number is written, so a lookup matches
// whichever form was stored at registration (e.g. 788963267 vs 0788963267).
export const phoneVariants = (phone: string): string[] => {
  const cleaned = phone.replace(/[\s-]/g, "");
  const national = cleaned.replace(/^(\+?250|0)/, "");

  if (!/^7\d{8}$/.test(national)) return [cleaned];

  return [
    national,
    `0${national}`,
    `250${national}`,
    `+250${national}`,
  ];
};

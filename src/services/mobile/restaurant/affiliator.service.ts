import {
  getRestaurantAffiliatorsService,
  createAffiliatorService,
  deleteAffiliatorService,
  updateAffiliatorService,
  getAffiliatorByIdService,
} from "../../affiliator.service";

export const mobileGetAffiliators = (restaurantId: string) =>
  getRestaurantAffiliatorsService(restaurantId);

export const mobileCreateAffiliator = (data: {
  name: string;
  email?: string;
  phone?: string;
  restaurantId: string;
}) => createAffiliatorService(data);

export const mobileDeleteAffiliator = (affiliatorId: string) =>
  deleteAffiliatorService(affiliatorId);

export const mobileUpdateAffiliator = (
  affiliatorId: string,
  data: { name?: string; phone?: string },
) => updateAffiliatorService(affiliatorId, data);

export const mobileGetAffiliatorById = (affiliatorId: string) =>
  getAffiliatorByIdService(affiliatorId);

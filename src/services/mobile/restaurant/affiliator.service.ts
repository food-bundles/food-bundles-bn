import {
  getRestaurantAffiliatorsService,
  createAffiliatorService,
  deleteAffiliatorService,
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

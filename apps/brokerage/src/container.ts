import { getDb } from "./db/client";
import {
  PgBrokerRepository,
  PgDealRepository,
  PgInquiryRepository,
  PgListingRepository,
} from "./db/repositories";
import { Queryable } from "./db/types";
import { BrokerService } from "./modules/brokers/service";
import { DealService } from "./modules/deals/service";
import { InquiryService } from "./modules/inquiries/service";
import { VehicleCatalog } from "./modules/vehicles/catalog";
import { VehicleService } from "./modules/vehicles/service";
import { createSaleorRequest } from "./saleor/graphql-client";
import { SaleorVehicleCatalog } from "./saleor/saleor-catalog";

export interface Services {
  brokers: BrokerService;
  vehicles: VehicleService;
  inquiries: InquiryService;
  deals: DealService;
}

/** Wires repositories and the Saleor catalog into services. Used by API routes and tests. */
export function createServices(db: Queryable, catalog: VehicleCatalog, now?: () => Date): Services {
  const brokerRepo = new PgBrokerRepository(db);
  const listingRepo = new PgListingRepository(db);
  const inquiryRepo = new PgInquiryRepository(db);
  const dealRepo = new PgDealRepository(db);

  const vehicles = new VehicleService(listingRepo, brokerRepo, catalog, now);
  return {
    brokers: new BrokerService(brokerRepo, now),
    vehicles,
    inquiries: new InquiryService(inquiryRepo, brokerRepo, vehicles, now),
    deals: new DealService(dealRepo, brokerRepo, inquiryRepo, vehicles, now),
  };
}

export const channelSlug = () => process.env.SALEOR_CHANNEL_SLUG ?? "default-channel";

/** Services that talk to Saleor with the app token stored at install time. */
export async function servicesFor(authData: {
  saleorApiUrl: string;
  token: string;
}): Promise<Services> {
  const catalog = new SaleorVehicleCatalog(
    createSaleorRequest(authData.saleorApiUrl, authData.token),
    channelSlug()
  );
  return createServices(await getDb(), catalog);
}

/**
 * Fills a fresh installation with demo data so the dashboard and storefront
 * have something to show: brokers, a consigning customer, vehicles with
 * photos, and a few storefront inquiries. Safe to re-run: existing VINs and
 * brokers are skipped.
 *
 *   pnpm seed:demo                     photos from Wikimedia Commons
 *   pnpm seed:demo --images-dir=./pics photos from local files named <VIN>.jpg/.png
 *
 * Needs the app installed in Saleor (it uses the app token) and `pnpm provision` done.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { channelSlug, createServices } from "../src/container";
import { getDb } from "../src/db/client";
import { VehicleSpecs } from "../src/modules/vehicles/catalog";
import { SupplyType } from "../src/modules/vehicles/domain";
import { createSaleorRequest, uploadProductImage } from "../src/saleor/graphql-client";
import { SaleorVehicleCatalog } from "../src/saleor/saleor-catalog";
import { saleorApp } from "../src/saleor-app";

interface DemoVehicle {
  vin: string;
  specs: VehicleSpecs;
  askingPriceCents: number;
  minimumPriceCents?: number;
  supplyType: SupplyType;
  status: "draft" | "listed" | "reserved";
  /** Wikimedia Commons search used to find a photo. */
  photoQuery: string;
}

const VEHICLES: DemoVehicle[] = [
  {
    vin: "JTDKN3DU0A0000001",
    specs: {
      make: "Toyota",
      model: "Prius",
      year: 2020,
      mileageKm: 48_000,
      bodyType: "Hatchback",
      fuelType: "Hybrid",
      transmission: "Automatic",
      exteriorColor: "Silver",
      condition: "Used",
    },
    askingPriceCents: 1_950_000,
    minimumPriceCents: 1_800_000,
    supplyType: "dealer_stock",
    status: "listed",
    photoQuery: "Toyota Prius fourth generation",
  },
  {
    vin: "5YJ3E1EA0KF000002",
    specs: {
      make: "Tesla",
      model: "Model 3",
      year: 2019,
      mileageKm: 61_000,
      bodyType: "Sedan",
      fuelType: "Electric",
      transmission: "Automatic",
      exteriorColor: "White",
      condition: "Used",
    },
    askingPriceCents: 2_750_000,
    minimumPriceCents: 2_500_000,
    supplyType: "consignment",
    status: "listed",
    photoQuery: "Tesla Model 3",
  },
  {
    vin: "WBA5R1C50KA000003",
    specs: {
      make: "BMW",
      model: "330i",
      year: 2021,
      mileageKm: 35_000,
      bodyType: "Sedan",
      fuelType: "Petrol",
      transmission: "Automatic",
      exteriorColor: "Black",
      condition: "Certified pre-owned",
    },
    askingPriceCents: 3_290_000,
    minimumPriceCents: 3_100_000,
    supplyType: "dealer_stock",
    status: "listed",
    photoQuery: "BMW 3 Series G20 330i",
  },
  {
    vin: "1FTEW1EP5MF000004",
    specs: {
      make: "Ford",
      model: "F-150",
      year: 2021,
      mileageKm: 52_000,
      bodyType: "Pickup",
      fuelType: "Petrol",
      transmission: "Automatic",
      exteriorColor: "Blue",
      condition: "Used",
    },
    askingPriceCents: 3_850_000,
    supplyType: "consignment",
    status: "listed",
    photoQuery: "Ford F-150 fourteenth generation",
  },
  {
    vin: "JHMFC1F30LX000005",
    specs: {
      make: "Honda",
      model: "Civic",
      year: 2020,
      mileageKm: 40_000,
      bodyType: "Sedan",
      fuelType: "Petrol",
      transmission: "Manual",
      exteriorColor: "Red",
      condition: "Used",
    },
    askingPriceCents: 1_690_000,
    minimumPriceCents: 1_550_000,
    supplyType: "dealer_stock",
    status: "reserved",
    photoQuery: "Honda Civic tenth generation sedan",
  },
  {
    vin: "WVWZZZAUZLW000006",
    specs: {
      make: "Volkswagen",
      model: "Golf",
      year: 2020,
      mileageKm: 29_000,
      bodyType: "Hatchback",
      fuelType: "Diesel",
      transmission: "Manual",
      exteriorColor: "Grey",
      condition: "Used",
    },
    askingPriceCents: 1_890_000,
    supplyType: "dealer_stock",
    status: "listed",
    photoQuery: "Volkswagen Golf Mk7",
  },
  {
    vin: "JN1TANT31U0000007",
    specs: {
      make: "Nissan",
      model: "Patrol",
      year: 2018,
      mileageKm: 98_000,
      bodyType: "SUV",
      fuelType: "Petrol",
      transmission: "Automatic",
      exteriorColor: "White",
      condition: "Used",
    },
    askingPriceCents: 4_200_000,
    minimumPriceCents: 3_900_000,
    supplyType: "consignment",
    status: "listed",
    photoQuery: "Nissan Patrol Y62",
  },
  {
    vin: "SALGA2AE0LA000008",
    specs: {
      make: "Land Rover",
      model: "Range Rover",
      year: 2022,
      mileageKm: 12_000,
      bodyType: "SUV",
      fuelType: "Plug-in hybrid",
      transmission: "Automatic",
      exteriorColor: "Green",
      condition: "Certified pre-owned",
    },
    askingPriceCents: 9_800_000,
    supplyType: "dealer_stock",
    status: "draft",
    photoQuery: "Range Rover L405",
  },
];

const USER_AGENT = "car-brokerage-demo-seed/0.1 (demo data loader)";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const apiUrl = process.env.SALEOR_API_URL;
  if (!apiUrl) throw new Error("SALEOR_API_URL is not set");
  const auth = await saleorApp.apl.get(apiUrl);
  if (!auth)
    throw new Error("The app is not installed in Saleor yet. Install it from the dashboard first.");

  const request = createSaleorRequest(apiUrl, auth.token);
  const db = await getDb();
  const services = createServices(db, new SaleorVehicleCatalog(request, channelSlug()));

  // Brokers
  const brokers = await services.brokers.list();
  const ensureBroker = async (name: string, email: string, rateBp: number) =>
    brokers.find((b) => b.email === email) ??
    (await services.brokers.create({ name, email, defaultCommissionRateBp: rateBp }));
  const amina = await ensureBroker("Amina Odhiambo", "amina@example.com", 300);
  const brian = await ensureBroker("Brian Mwangi", "brian@example.com", 250);

  // A customer who consigns cars
  const sellerEmail = "dana.seller@example.com";
  const found = await request(
    `query($email: String!) { customers(first: 1, filter: { search: $email }) { edges { node { id email } } } }`,
    { email: sellerEmail }
  );
  const sellerId: string =
    found.customers.edges.find((e: any) => e.node.email === sellerEmail)?.node.id ??
    (
      await request(
        `mutation($input: UserCreateInput!) { customerCreate(input: $input) { user { id } errors { field message code } } }`,
        { input: { email: sellerEmail, firstName: "Dana", lastName: "Seller", isActive: true } }
      )
    ).customerCreate.user.id;

  const imagesDir = arg("images-dir");
  const localImages = imagesDir ? await readdir(imagesDir) : [];

  for (const [i, v] of VEHICLES.entries()) {
    const label = `${v.specs.year} ${v.specs.make} ${v.specs.model}`;
    const existing = (await services.vehicles.list()).find((l) => l.vin === v.vin);
    if (existing) {
      console.log(`skip ${label} (already exists)`);
      continue;
    }
    const listing = await services.vehicles.register({
      vin: v.vin,
      specs: v.specs,
      askingPriceCents: v.askingPriceCents,
      minimumPriceCents: v.minimumPriceCents ?? null,
      supplyType: v.supplyType,
      sellerCustomerId: v.supplyType === "consignment" ? sellerId : null,
      brokerId: i % 2 === 0 ? amina.id : brian.id,
    });

    try {
      const photo = imagesDir
        ? await localPhoto(imagesDir, localImages, v.vin)
        : await commonsPhoto(v.photoQuery);
      if (photo) {
        await uploadProductImage(apiUrl, auth.token, {
          productId: listing.productId,
          image: photo.blob,
          fileName: photo.fileName,
          alt: photo.credit ? `${label}. Photo: ${photo.credit}` : label,
        });
      } else {
        console.warn(`  no photo found for ${label}`);
      }
    } catch (err) {
      console.warn(`  photo for ${label} failed: ${(err as Error).message}`);
    }

    if (v.status !== "draft") await services.vehicles.changeStatus(listing.productId, "listed");
    if (v.status === "reserved")
      await services.vehicles.changeStatus(listing.productId, "reserved");
    console.log(`added ${label} (${v.status})`);
  }

  // Storefront activity on the first listed vehicles
  const listed = await services.vehicles.list({ status: "listed" });
  if (listed.length >= 2 && (await services.inquiries.list()).length === 0) {
    const [a, b] = listed;
    const buyer = {
      contactName: "Sam Buyer",
      contactEmail: "sam@example.com",
      contactPhone: "+254 700 000 000",
    };
    await services.inquiries.submit({
      ...buyer,
      productId: a.productId,
      kind: "question",
      message: "Is the service history available?",
    });
    await services.inquiries.submit({
      ...buyer,
      productId: a.productId,
      kind: "test_drive",
      preferredDate: "Saturday 10:00",
    });
    await services.inquiries.submit({
      ...buyer,
      productId: b.productId,
      kind: "offer",
      offerCents: Math.round((b.minimumPriceCents ?? 2_000_000) * 0.95),
    });
    console.log("added 3 inquiries");
  }

  await db.end();
  console.log("Demo data ready.");
}

async function localPhoto(dir: string, files: string[], vin: string) {
  const file = files.find((f) => f.toUpperCase().startsWith(vin) && /\.(jpe?g|png|webp)$/i.test(f));
  if (!file) return null;
  const type = file.toLowerCase().endsWith(".png")
    ? "image/png"
    : file.toLowerCase().endsWith(".webp")
    ? "image/webp"
    : "image/jpeg";
  return {
    blob: new Blob([new Uint8Array(await readFile(path.join(dir, file)))], { type }),
    fileName: file,
    credit: null,
  };
}

/** Finds a freely licensed JPEG on Wikimedia Commons and downloads a 1280px rendition. */
async function commonsPhoto(query: string) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1280",
  }).forEach(([k, v]) => api.searchParams.set(k, v));

  const res = await fetch(api, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons search returned HTTP ${res.status}`);
  const pages = Object.values((await res.json())?.query?.pages ?? {}) as any[];
  const pick = pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => p.imageinfo?.[0])
    .find((info) => info?.mime === "image/jpeg" && info.thumburl);
  if (!pick) return null;

  const img = await fetch(pick.thumburl, { headers: { "user-agent": USER_AGENT } });
  if (!img.ok) throw new Error(`photo download returned HTTP ${img.status}`);
  const meta = pick.extmetadata ?? {};
  const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  const credit = [
    strip(meta.Artist?.value),
    strip(meta.LicenseShortName?.value),
    "Wikimedia Commons",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    blob: new Blob([await img.arrayBuffer()], { type: "image/jpeg" }),
    fileName: "photo.jpg",
    credit,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

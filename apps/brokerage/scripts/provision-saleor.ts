/**
 * Prepares a Saleor instance for vehicles. Idempotent: safe to run again.
 *
 *   SALEOR_API_URL=http://localhost:8000/graphql/ \
 *   SALEOR_STAFF_EMAIL=admin@example.com SALEOR_STAFF_PASSWORD=admin pnpm provision
 *
 * Creates (when missing): the vehicle attributes, the "Vehicle" product type,
 * the "Vehicles" category, the sales channel and the "Brokerage yard"
 * warehouse assigned to that channel.
 */
import { createSaleorRequest, GraphQLRequest } from "../src/saleor/graphql-client";
import {
  VEHICLE_ATTRIBUTES,
  VEHICLE_CATEGORY_SLUG,
  VEHICLE_PRODUCT_TYPE_SLUG,
  VEHICLE_WAREHOUSE_SLUG,
} from "../src/saleor/vehicle-schema";

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};

async function staffToken(apiUrl: string): Promise<string> {
  if (process.env.SALEOR_TOKEN) return process.env.SALEOR_TOKEN;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query:
        "mutation($email: String!, $password: String!) { tokenCreate(email: $email, password: $password) { token errors { message } } }",
      variables: { email: env("SALEOR_STAFF_EMAIL"), password: env("SALEOR_STAFF_PASSWORD") },
    }),
  });
  const body = await res.json();
  const token = body.data?.tokenCreate?.token;
  if (!token)
    throw new Error(
      `Could not sign in: ${JSON.stringify(body.data?.tokenCreate?.errors ?? body.errors)}`
    );
  return token;
}

async function ensureAttributes(gql: GraphQLRequest): Promise<string[]> {
  const slugs = Object.values(VEHICLE_ATTRIBUTES).map((a) => a.slug);
  const existing = await gql(
    `query($slugs: [String!]) { attributes(first: 50, filter: { slugs: $slugs }) { edges { node { id slug } } } }`,
    { slugs }
  );
  const ids = new Map<string, string>(
    existing.attributes.edges.map((e: any) => [e.node.slug, e.node.id])
  );

  for (const def of Object.values(VEHICLE_ATTRIBUTES)) {
    if (ids.has(def.slug)) continue;
    const created = await gql(
      `mutation($input: AttributeCreateInput!) { attributeCreate(input: $input) { attribute { id } errors { field message code } } }`,
      {
        input: {
          name: def.name,
          slug: def.slug,
          type: "PRODUCT_TYPE",
          inputType: def.inputType,
          valueRequired: def.valueRequired,
          visibleInStorefront: true,
          ...("unit" in def ? { unit: def.unit } : {}),
          ...("choices" in def ? { values: def.choices.map((name) => ({ name })) } : {}),
        },
      }
    );
    ids.set(def.slug, created.attributeCreate.attribute.id);
    console.log(`created attribute ${def.slug}`);
  }
  return slugs.map((s) => ids.get(s)!);
}

async function ensureProductType(gql: GraphQLRequest, attributeIds: string[]) {
  const found = await gql(
    `query($slugs: [String!]) { productTypes(first: 1, filter: { slugs: $slugs }) { edges { node { id productAttributes { id } } } } }`,
    { slugs: [VEHICLE_PRODUCT_TYPE_SLUG] }
  );
  const node = found.productTypes.edges[0]?.node;
  if (!node) {
    await gql(
      `mutation($input: ProductTypeInput!) { productTypeCreate(input: $input) { productType { id } errors { field message code } } }`,
      {
        input: {
          name: "Vehicle",
          slug: VEHICLE_PRODUCT_TYPE_SLUG,
          kind: "NORMAL",
          isShippingRequired: false,
          productAttributes: attributeIds,
        },
      }
    );
    console.log("created product type Vehicle");
    return;
  }
  const assigned = new Set(node.productAttributes.map((a: { id: string }) => a.id));
  const missing = attributeIds.filter((id) => !assigned.has(id));
  if (missing.length) {
    await gql(
      `mutation($id: ID!, $ops: [ProductAttributeAssignInput!]!) { productAttributeAssign(productTypeId: $id, operations: $ops) { errors { field message code } } }`,
      { id: node.id, ops: missing.map((id) => ({ id, type: "PRODUCT" })) }
    );
    console.log(`assigned ${missing.length} attributes to Vehicle`);
  }
}

async function ensureCategory(gql: GraphQLRequest) {
  const found = await gql(
    `query($slugs: [String!]) { categories(first: 1, filter: { slugs: $slugs }) { edges { node { id } } } }`,
    {
      slugs: [VEHICLE_CATEGORY_SLUG],
    }
  );
  if (found.categories.edges.length) return;
  await gql(
    `mutation($input: CategoryInput!) { categoryCreate(input: $input) { category { id } errors { field message code } } }`,
    { input: { name: "Vehicles", slug: VEHICLE_CATEGORY_SLUG } }
  );
  console.log("created category Vehicles");
}

async function ensureChannelAndWarehouse(gql: GraphQLRequest) {
  const slug = env("SALEOR_CHANNEL_SLUG", "default-channel");
  const country = env("SALEOR_DEFAULT_COUNTRY", "US");
  let channel = (
    await gql(`query($slug: String!) { channel(slug: $slug) { id warehouses { slug } } }`, { slug })
  ).channel;
  if (!channel) {
    const created = await gql(
      `mutation($input: ChannelCreateInput!) { channelCreate(input: $input) { channel { id warehouses { slug } } errors { field message code } } }`,
      {
        input: {
          name: "Default channel",
          slug,
          currencyCode: env("SALEOR_CURRENCY", "USD"),
          defaultCountry: country,
        },
      }
    );
    channel = created.channelCreate.channel;
    console.log(`created channel ${slug}`);
  }

  const found = await gql(
    `query($slugs: [String!]) { warehouses(first: 1, filter: { slugs: $slugs }) { edges { node { id } } } }`,
    {
      slugs: [VEHICLE_WAREHOUSE_SLUG],
    }
  );
  let warehouseId: string | undefined = found.warehouses.edges[0]?.node.id;
  if (!warehouseId) {
    const created = await gql(
      `mutation($input: WarehouseCreateInput!) { createWarehouse(input: $input) { warehouse { id } errors { field message code } } }`,
      {
        input: {
          name: "Brokerage yard",
          slug: VEHICLE_WAREHOUSE_SLUG,
          address: {
            streetAddress1: env("WAREHOUSE_STREET", "1 Main Street"),
            city: env("WAREHOUSE_CITY", "New York"),
            postalCode: env("WAREHOUSE_POSTAL_CODE", "10001"),
            country,
            countryArea:
              process.env.WAREHOUSE_COUNTRY_AREA ?? (country === "US" ? "NY" : undefined),
          },
        },
      }
    );
    warehouseId = created.createWarehouse.warehouse.id as string;
    console.log("created warehouse Brokerage yard");
  }

  if (!channel.warehouses.some((w: { slug: string }) => w.slug === VEHICLE_WAREHOUSE_SLUG)) {
    await gql(
      `mutation($id: ID!, $input: ChannelUpdateInput!) { channelUpdate(id: $id, input: $input) { errors { field message code } } }`,
      { id: channel.id, input: { addWarehouses: [warehouseId] } }
    );
    console.log(`added warehouse to channel ${slug}`);
  }

  // Saleor only counts stock in warehouses that a shipping zone links to the
  // buyer's country, even for products that need no shipping (vehicle pickup).
  const zones = await gql(
    `query($channel: String!) { shippingZones(first: 100, channel: $channel) { edges { node { name warehouses { slug } } } } }`,
    { channel: slug }
  );
  const covered = zones.shippingZones.edges.some((e: any) =>
    e.node.warehouses.some((w: { slug: string }) => w.slug === VEHICLE_WAREHOUSE_SLUG)
  );
  if (!covered) {
    const countries = env("SALEOR_SALES_COUNTRIES", country)
      .split(",")
      .map((c) => c.trim());
    await gql(
      `mutation($input: ShippingZoneCreateInput!) { shippingZoneCreate(input: $input) { shippingZone { id } errors { field message code } } }`,
      {
        input: {
          name: "Vehicle pickup",
          countries,
          addWarehouses: [warehouseId],
          addChannels: [channel.id],
        },
      }
    );
    console.log(`created shipping zone Vehicle pickup for ${countries.join(", ")}`);
  }
}

async function main() {
  const apiUrl = env("SALEOR_API_URL");
  const gql = createSaleorRequest(apiUrl, await staffToken(apiUrl));
  const attributeIds = await ensureAttributes(gql);
  await ensureProductType(gql, attributeIds);
  await ensureCategory(gql);
  await ensureChannelAndWarehouse(gql);
  console.log("Saleor is ready for vehicles");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { fromCents, toCents } from "../modules/shared/money";
import { CatalogVehicle, VehicleCatalog, VehicleSpecs } from "../modules/vehicles/catalog";
import { GraphQLRequest, SaleorError } from "./graphql-client";
import {
  STATUS_METADATA_KEY,
  VEHICLE_ATTRIBUTES,
  VEHICLE_CATEGORY_SLUG,
  VEHICLE_PRODUCT_TYPE_SLUG,
  VEHICLE_WAREHOUSE_SLUG,
  VehicleAttributeKey,
} from "./vehicle-schema";

interface CatalogIds {
  productTypeId: string;
  categoryId: string;
  channelId: string;
  warehouseId: string;
  attributeIds: Record<string, string>;
}

const LOOKUP = /* GraphQL */ `
  query BrokerageCatalogIds(
    $productType: [String!]
    $category: [String!]
    $channel: String!
    $attributes: [String!]
    $warehouse: [String!]
  ) {
    productTypes(first: 1, filter: { slugs: $productType }) {
      edges {
        node {
          id
        }
      }
    }
    categories(first: 1, filter: { slugs: $category }) {
      edges {
        node {
          id
        }
      }
    }
    channel(slug: $channel) {
      id
    }
    warehouses(first: 1, filter: { slugs: $warehouse }) {
      edges {
        node {
          id
        }
      }
    }
    attributes(first: 50, filter: { slugs: $attributes }) {
      edges {
        node {
          id
          slug
        }
      }
    }
  }
`;

const PRODUCT_CREATE = /* GraphQL */ `
  mutation BrokerageProductCreate($input: ProductCreateInput!) {
    productCreate(input: $input) {
      product {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

const VARIANT_CREATE = /* GraphQL */ `
  mutation BrokerageVariantCreate($input: ProductVariantCreateInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

const VARIANT_PRICE = /* GraphQL */ `
  mutation BrokerageVariantPrice($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
    productVariantChannelListingUpdate(id: $id, input: $input) {
      errors {
        field
        message
        code
      }
    }
  }
`;

const PRODUCT_LISTING = /* GraphQL */ `
  mutation BrokerageProductListing($id: ID!, $input: ProductChannelListingUpdateInput!) {
    productChannelListingUpdate(id: $id, input: $input) {
      errors {
        field
        message
        code
      }
    }
  }
`;

const METADATA = /* GraphQL */ `
  mutation BrokerageMetadata($id: ID!, $input: [MetadataInput!]!) {
    updateMetadata(id: $id, input: $input) {
      errors {
        field
        message
        code
      }
    }
  }
`;

const PRODUCT = /* GraphQL */ `
  query BrokerageProduct($id: ID!, $channel: String!) {
    product(id: $id, channel: $channel) {
      id
      name
      productType {
        slug
      }
      variants {
        sku
        pricing {
          price {
            gross {
              amount
              currency
            }
          }
        }
        channelListings {
          channel {
            slug
          }
          price {
            amount
            currency
          }
        }
      }
    }
  }
`;

/** VehicleCatalog backed by the Saleor GraphQL API, using the app's token. */
export class SaleorVehicleCatalog implements VehicleCatalog {
  private ids?: Promise<CatalogIds>;

  constructor(private readonly request: GraphQLRequest, private readonly channelSlug: string) {}

  private catalogIds(): Promise<CatalogIds> {
    this.ids ??= (async () => {
      const data = await this.request(LOOKUP, {
        productType: [VEHICLE_PRODUCT_TYPE_SLUG],
        category: [VEHICLE_CATEGORY_SLUG],
        channel: this.channelSlug,
        warehouse: [VEHICLE_WAREHOUSE_SLUG],
        attributes: Object.values(VEHICLE_ATTRIBUTES).map((a) => a.slug),
      });
      const productTypeId = data.productTypes.edges[0]?.node.id;
      const categoryId = data.categories.edges[0]?.node.id;
      const warehouseId = data.warehouses.edges[0]?.node.id;
      if (!productTypeId || !categoryId || !warehouseId || !data.channel) {
        throw new SaleorError(
          "Saleor is not provisioned for vehicles. Run `pnpm provision` first."
        );
      }
      return {
        productTypeId,
        categoryId,
        warehouseId,
        channelId: data.channel.id,
        attributeIds: Object.fromEntries(
          data.attributes.edges.map((e: { node: { id: string; slug: string } }) => [
            e.node.slug,
            e.node.id,
          ])
        ),
      };
    })().catch((err) => {
      this.ids = undefined; // retry the lookup next time
      throw err;
    });
    return this.ids;
  }

  async createVehicle(input: {
    name: string;
    vin: string;
    specs: VehicleSpecs;
    askingPriceCents: number;
  }) {
    const ids = await this.catalogIds();
    const product = await this.request(PRODUCT_CREATE, {
      input: {
        productType: ids.productTypeId,
        category: ids.categoryId,
        name: input.name,
        attributes: toAttributeInputs(input.specs, ids.attributeIds),
        metadata: [{ key: STATUS_METADATA_KEY, value: "draft" }],
      },
    });
    const productId: string = product.productCreate.product.id;

    const variant = await this.request(VARIANT_CREATE, {
      input: {
        product: productId,
        sku: input.vin,
        name: input.vin,
        attributes: [],
        trackInventory: true,
        quantityLimitPerCustomer: 1,
        stocks: [{ warehouse: ids.warehouseId, quantity: 1 }],
      },
    });
    const variantId: string = variant.productVariantCreate.productVariant.id;

    await this.request(PRODUCT_LISTING, {
      id: productId,
      input: {
        updateChannels: [
          {
            channelId: ids.channelId,
            isPublished: false,
            visibleInListings: true,
            isAvailableForPurchase: false,
            addVariants: [variantId],
          },
        ],
      },
    });
    await this.request(VARIANT_PRICE, {
      id: variantId,
      input: [{ channelId: ids.channelId, price: fromCents(input.askingPriceCents) }],
    });
    return { productId };
  }

  async getVehicle(productId: string): Promise<CatalogVehicle | null> {
    const data = await this.request(PRODUCT, { id: productId, channel: this.channelSlug });
    const product = data.product;
    if (!product) return null;
    const variant = product.variants?.[0];
    const listing = variant?.channelListings?.find(
      (l: { channel: { slug: string } }) => l.channel.slug === this.channelSlug
    );
    return {
      productId: product.id,
      name: product.name,
      vin: variant?.sku ?? null,
      isVehicle: product.productType?.slug === VEHICLE_PRODUCT_TYPE_SLUG,
      askingPriceCents: listing?.price ? toCents(listing.price.amount) : null,
      currency: listing?.price?.currency ?? null,
    };
  }

  async applyStatus(
    productId: string,
    status: string,
    visibility: { isPublished: boolean; isAvailableForPurchase: boolean }
  ) {
    const ids = await this.catalogIds();
    await this.request(PRODUCT_LISTING, {
      id: productId,
      input: {
        updateChannels: [
          {
            channelId: ids.channelId,
            isPublished: visibility.isPublished,
            visibleInListings: visibility.isPublished,
            isAvailableForPurchase: visibility.isAvailableForPurchase,
          },
        ],
      },
    });
    await this.request(METADATA, {
      id: productId,
      input: [{ key: STATUS_METADATA_KEY, value: status }],
    });
  }
}

type AttributeValueInput =
  | { id: string; numeric: string }
  | { id: string; plainText: string }
  | { id: string; dropdown: { value: string } };

export function toAttributeInputs(
  specs: VehicleSpecs,
  attributeIds: Record<string, string>
): AttributeValueInput[] {
  return (Object.keys(VEHICLE_ATTRIBUTES) as VehicleAttributeKey[]).flatMap(
    (key): AttributeValueInput[] => {
      const def = VEHICLE_ATTRIBUTES[key];
      const value = specs[key];
      const id = attributeIds[def.slug];
      if (value === undefined || value === null || value === "" || !id) return [];
      switch (def.inputType) {
        case "NUMERIC":
          return [{ id, numeric: String(value) }];
        case "PLAIN_TEXT":
          return [{ id, plainText: String(value) }];
        case "DROPDOWN":
          return [{ id, dropdown: { value: String(value) } }];
      }
    }
  );
}

/**
 * Minimal server-side GraphQL client for Saleor. Throws on transport errors,
 * GraphQL errors and mutation `errors` arrays, so callers only see data.
 */
export class SaleorError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "SaleorError";
  }
}

export type GraphQLRequest = <T = any>(
  query: string,
  variables?: Record<string, unknown>
) => Promise<T>;

export function createSaleorRequest(apiUrl: string, token: string): GraphQLRequest {
  return async (query, variables) => {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new SaleorError(`Saleor responded with HTTP ${res.status}`);
    const body = (await res.json()) as { data?: any; errors?: { message: string }[] };
    if (body.errors?.length) {
      throw new SaleorError(body.errors.map((e) => e.message).join("; "), body.errors);
    }
    assertNoMutationErrors(body.data);
    return body.data;
  };
}

function assertNoMutationErrors(data: unknown) {
  if (!data || typeof data !== "object") return;
  for (const value of Object.values(data)) {
    const errors = (
      value as { errors?: { field?: string; message?: string; code?: string }[] } | null
    )?.errors;
    if (Array.isArray(errors) && errors.length) {
      const text = errors.map((e) => `${e.field ?? "error"}: ${e.message ?? e.code}`).join("; ");
      throw new SaleorError(text, errors);
    }
  }
}

/**
 * Uploads a product image using the GraphQL multipart request spec, which
 * Saleor supports for `Upload` arguments.
 */
export async function uploadProductImage(
  apiUrl: string,
  token: string,
  input: { productId: string; image: Blob; fileName: string; alt: string }
): Promise<void> {
  const form = new FormData();
  form.append(
    "operations",
    JSON.stringify({
      query: `mutation($product: ID!, $image: Upload!, $alt: String) {
        productMediaCreate(input: { product: $product, image: $image, alt: $alt }) {
          errors { field message code }
        }
      }`,
      variables: { product: input.productId, image: null, alt: input.alt },
    })
  );
  form.append("map", JSON.stringify({ "0": ["variables.image"] }));
  form.append("0", input.image, input.fileName);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new SaleorError(`Image upload failed with HTTP ${res.status}`);
  const body = (await res.json()) as { data?: any; errors?: { message: string }[] };
  const errors = body.errors ?? body.data?.productMediaCreate?.errors ?? [];
  if (errors.length)
    throw new SaleorError(`Image upload failed: ${JSON.stringify(errors)}`, errors);
}

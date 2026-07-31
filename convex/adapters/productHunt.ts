import { z } from "zod";

const postSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().url(),
  website: z.string().url().nullable().optional(),
  createdAt: z.string(),
  votesCount: z.number().optional(),
  thumbnail: z.object({ url: z.string().url() }).nullable().optional(),
  topics: z
    .object({
      edges: z.array(z.object({ node: z.object({ name: z.string() }) })),
    })
    .optional(),
});
const responseSchema = z.object({
  data: z
    .object({
      posts: z.object({
        edges: z.array(z.object({ cursor: z.string(), node: postSchema })),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          endCursor: z.string().nullable().optional(),
        }),
      }),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export type ProductHuntLaunch = z.infer<typeof postSchema>;

const query = `query DailyPosts($after: String, $postedAfter: DateTime!, $postedBefore: DateTime!) {
  posts(first: 50, after: $after, postedAfter: $postedAfter, postedBefore: $postedBefore, order: NEWEST) {
    edges { cursor node { id name tagline description url website createdAt votesCount thumbnail { url } topics(first: 10) { edges { node { name } } } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export async function fetchProductHuntLaunches(
  postedAfter: string,
  postedBefore: string,
) {
  const token = process.env.PRODUCT_HUNT_ACCESS_TOKEN;
  if (!token)
    throw new Error("Missing PRODUCT_HUNT_ACCESS_TOKEN in Convex Cloud");
  const launches: ProductHuntLaunch[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { after, postedAfter, postedBefore },
      }),
    });
    if (!response.ok)
      throw new Error(
        `Product Hunt request failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
      );
    const parsed = responseSchema.parse(await response.json());
    if (parsed.errors?.length)
      throw new Error(
        `Product Hunt GraphQL error: ${parsed.errors.map((error) => error.message).join("; ")}`,
      );
    const connection = parsed.data?.posts;
    if (!connection) throw new Error("Product Hunt response omitted posts");
    launches.push(...connection.edges.map((edge) => edge.node));
    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor)
      break;
    after = connection.pageInfo.endCursor;
  }
  return launches;
}

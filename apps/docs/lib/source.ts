import { docs } from "@/.source";
import { loader } from "fumadocs-core/source";

const mdxSource = docs.toFumadocsSource();
// fumadocs-mdx v11 returns files as a function; fumadocs-core v15 expects an array
const files =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof mdxSource.files === "function" ? (mdxSource.files as any)() : mdxSource.files;

export const source = loader({
  baseUrl: "/docs",
  source: { files },
});

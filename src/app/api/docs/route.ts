import { isAdminAvailable } from "@/lib/admin";

export const runtime = "nodejs";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bible Bench API Docs</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        layout: "BaseLayout",
        deepLinking: true,
      });
    </script>
  </body>
</html>`;

export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

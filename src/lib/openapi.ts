export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Bible Bench API",
    version: "v1",
    description:
      "Local/admin-only API surface for Bible Bench. Swagger UI is intended for development use.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    dbConnected: { type: "boolean" },
                    dbNameConfigured: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

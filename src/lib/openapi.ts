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
    "/api/admin/ingest/raw": {
      post: {
        summary: "Ingest raw chapter payload",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "rawChapterId",
                  "bibleId",
                  "bookId",
                  "chapterNumber",
                  "reference",
                  "rawPayload",
                  "hashRaw",
                  "source",
                ],
                properties: {
                  rawChapterId: { type: "integer" },
                  bibleId: { type: "integer" },
                  bookId: { type: "integer" },
                  chapterNumber: { type: "integer" },
                  reference: { type: "string" },
                  sourceRef: { type: "string" },
                  rawPayload: { type: "object" },
                  hashRaw: { type: "string" },
                  source: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Raw chapter ingested",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        rawChapterId: { type: "integer" },
                        created: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/ingest/kjv": {
      post: {
        summary: "Ingest KJV chapters from local files",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bibleId: { type: "integer" },
                  source: { type: "string" },
                  limit: { type: "integer" },
                  skip: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Ingested KJV chapters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        ingested: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/transform-profiles": {
      get: {
        summary: "List transform profiles",
        tags: ["admin"],
        responses: {
          "200": {
            description: "Transform profiles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          profileId: { type: "integer" },
                          name: { type: "string" },
                          scope: { type: "string", enum: ["canonical", "model_output"] },
                          version: { type: "integer" },
                          bibleId: { type: "integer", nullable: true },
                          isDefault: { type: "boolean" },
                          description: { type: "string", nullable: true },
                          steps: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                order: { type: "integer" },
                                type: { type: "string" },
                                enabled: { type: "boolean" },
                                params: { type: "object" },
                              },
                            },
                          },
                          isActive: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Upsert transform profile",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["profileId", "name", "scope", "steps", "isActive"],
                properties: {
                  profileId: { type: "integer" },
                  name: { type: "string" },
                  scope: { type: "string", enum: ["canonical", "model_output"] },
                  version: { type: "integer" },
                  bibleId: { type: "integer", nullable: true },
                  isDefault: { type: "boolean" },
                  description: { type: "string", nullable: true },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["order", "type", "enabled", "params"],
                      properties: {
                        order: { type: "integer" },
                        type: { type: "string" },
                        enabled: { type: "boolean" },
                        params: { type: "object" },
                      },
                    },
                  },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Transform profile saved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        profileId: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/transform/chapters": {
      post: {
        summary: "Transform raw chapters into canonical chapters",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["transformProfileId"],
                properties: {
                  transformProfileId: { type: "integer" },
                  rawChapterIds: {
                    type: "array",
                    items: { type: "integer" },
                  },
                  limit: { type: "integer" },
                  skip: { type: "integer" },
                  batchId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Chapters transformed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        processed: { type: "integer" },
                        chapterIds: {
                          type: "array",
                          items: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/transform/verses": {
      post: {
        summary: "Transform raw chapters into canonical verses",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["transformProfileId"],
                properties: {
                  transformProfileId: { type: "integer" },
                  rawChapterIds: {
                    type: "array",
                    items: { type: "integer" },
                  },
                  limit: { type: "integer" },
                  skip: { type: "integer" },
                  batchId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verses transformed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        processed: { type: "integer" },
                        verseIds: {
                          type: "array",
                          items: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/schema/validators": {
      post: {
        summary: "Apply MongoDB schema validators",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  dryRun: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Schema validators applied",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        runId: { type: "string" },
                        dryRun: { type: "boolean" },
                        startedAt: { type: "string", format: "date-time" },
                        completedAt: { type: "string", format: "date-time" },
                        success: { type: "boolean" },
                        results: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              action: { type: "string" },
                              ok: { type: "boolean" },
                              error: { type: "string", nullable: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/etl/run": {
      post: {
        summary: "Run ETL pipeline stages",
        tags: ["admin"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  runId: { type: "string" },
                  stages: {
                    type: "array",
                    items: { type: "string", enum: ["ingest", "chapters", "verses"] },
                  },
                  bibleId: { type: "integer" },
                  source: { type: "string" },
                  filepath: { type: "string" },
                  transformProfileId: { type: "integer" },
                  rawChapterIds: { type: "array", items: { type: "integer" } },
                  limit: { type: "integer" },
                  skip: { type: "integer" },
                  batchId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "ETL run summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        runId: { type: "string" },
                        ok: { type: "boolean" },
                        stages: { type: "object" },
                      },
                    },
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
